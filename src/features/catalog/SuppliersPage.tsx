import { EditOutlined, InboxOutlined, PlusOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useDebouncedValue } from '../../hook/useDebouncedValue'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as catalogService from '../../services/catalog.service'
import type { Supplier, SupplierInput } from '../../types/catalog'
import { useSuppliers } from './queries'

const PAGE_SIZE = 20

function SupplierFormModal({
  supplier,
  onCancel,
  onSaved,
}: {
  supplier: Supplier | null
  onCancel: () => void
  onSaved: (supplier: Supplier, created: boolean) => void
}) {
  const [form] = Form.useForm<SupplierInput>()
  const isEdit = supplier !== null
  const save = useMutation({
    mutationFn: (values: SupplierInput) =>
      isEdit ? catalogService.updateSupplier(supplier.id, values) : catalogService.createSupplier(values),
    onSuccess: ({ supplier: saved }) => onSaved(saved, !isEdit),
  })

  return (
    <Modal
      open
      title={isEdit ? `Modifier « ${supplier.name} »` : 'Nouveau fournisseur'}
      okText={isEdit ? 'Enregistrer' : 'Créer le fournisseur'}
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={save.isPending}
      width={600}
    >
      <Form<SupplierInput>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={supplier ?? {}}
        onFinish={(values) => save.mutate(values)}
        className="mt-4"
      >
        <Form.Item name="name" label="Raison sociale" rules={[{ required: true, whitespace: true, message: 'Indiquez le nom du fournisseur' }, { min: 2, max: 150 }]}>
          <Input placeholder="Grossiste du port" />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item name="contactName" label="Contact" rules={[{ max: 100 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Téléphone" rules={[{ max: 30 }]}>
            <Input placeholder="+221 77 000 00 00" />
          </Form.Item>
        </div>
        <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email invalide' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="address" label="Adresse" rules={[{ max: 255 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="notes" label="Notes" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={3} placeholder="Délais de livraison, conditions de paiement…" />
        </Form.Item>
        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}

/** Fournisseurs : consultation avec products.view, gestion avec purchases.manage. */
export function SuppliersPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canManage = usePermission('purchases.manage')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [formSupplier, setFormSupplier] = useState<Supplier | null | undefined>(undefined)
  const debouncedSearch = useDebouncedValue(search.trim())

  const { data, isFetching, error } = useSuppliers({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    includeArchived,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })

  const archive = useMutation({
    mutationFn: ({ supplier, archived }: { supplier: Supplier; archived: boolean }) => catalogService.updateSupplier(supplier.id, { archived }),
    onSuccess: ({ supplier }, { archived }) => {
      void refresh()
      message.success(archived ? `« ${supplier.name} » archivé` : `« ${supplier.name} » restauré`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const columns: TableColumnsType<Supplier> = [
    {
      title: 'Fournisseur',
      key: 'name',
      render: (_, supplier) => (
        <div className="flex flex-col">
          <Space size={6}>
            <Typography.Text strong>{supplier.name}</Typography.Text>
            {supplier.archivedAt && <Tag>Archivé</Tag>}
          </Space>
          {supplier.contactName && (
            <Typography.Text type="secondary" className="text-xs">
              {supplier.contactName}
            </Typography.Text>
          )}
        </div>
      ),
    },
    { title: 'Téléphone', dataIndex: 'phone', width: 170, render: (phone: string | null) => phone ?? '—' },
    { title: 'Email', dataIndex: 'email', responsive: ['lg'], render: (email: string | null) => email ?? '—' },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: unknown, supplier: Supplier) => (
              <Space size={4}>
                <Tooltip title="Modifier">
                  <Button icon={<EditOutlined />} size="small" onClick={() => setFormSupplier(supplier)} aria-label={`Modifier ${supplier.name}`} />
                </Tooltip>
                <Popconfirm
                  title={supplier.archivedAt ? `Restaurer « ${supplier.name} » ?` : `Archiver « ${supplier.name} » ?`}
                  description={supplier.archivedAt ? undefined : 'Il ne sera plus proposé pour les nouvelles commandes.'}
                  okText={supplier.archivedAt ? 'Restaurer' : 'Archiver'}
                  cancelText="Annuler"
                  onConfirm={() => archive.mutate({ supplier, archived: !supplier.archivedAt })}
                >
                  <Button
                    icon={supplier.archivedAt ? <UndoOutlined /> : <InboxOutlined />}
                    size="small"
                    aria-label={supplier.archivedAt ? `Restaurer ${supplier.name}` : `Archiver ${supplier.name}`}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Fournisseurs
        </Typography.Title>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormSupplier(null)}>
            Nouveau fournisseur
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Rechercher un fournisseur…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="max-w-sm"
          aria-label="Rechercher un fournisseur"
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch
            size="small"
            checked={includeArchived}
            onChange={(checked) => {
              setIncludeArchived(checked)
              setPage(1)
            }}
            aria-label="Afficher les fournisseurs archivés"
          />
          Afficher les archivés
        </label>
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Supplier>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 600 }}
          rowClassName={(supplier) => (supplier.archivedAt ? 'opacity-60' : '')}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: debouncedSearch ? 'Aucun fournisseur ne correspond' : 'Aucun fournisseur' }}
        />
      </Card>

      {formSupplier !== undefined && (
        <SupplierFormModal
          key={formSupplier?.id ?? 'new'}
          supplier={formSupplier}
          onCancel={() => setFormSupplier(undefined)}
          onSaved={(supplier, created) => {
            void refresh()
            setFormSupplier(undefined)
            message.success(created ? `Fournisseur « ${supplier.name} » créé` : `Fournisseur « ${supplier.name} » mis à jour`)
          }}
        />
      )}
    </div>
  )
}
