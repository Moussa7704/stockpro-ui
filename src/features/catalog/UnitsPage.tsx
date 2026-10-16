import { EditOutlined, InboxOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as catalogService from '../../services/catalog.service'
import type { Unit, UnitInput } from '../../types/catalog'
import { useUnits } from './queries'

function UnitFormModal({ unit, onCancel, onSaved }: { unit: Unit | null; onCancel: () => void; onSaved: (unit: Unit, created: boolean) => void }) {
  const [form] = Form.useForm<UnitInput>()
  const isEdit = unit !== null
  const save = useMutation({
    mutationFn: (values: UnitInput) =>
      isEdit ? catalogService.updateUnit(unit.id, { name: values.name, symbol: values.symbol }) : catalogService.createUnit(values),
    onSuccess: ({ unit: saved }) => onSaved(saved, !isEdit),
  })

  return (
    <Modal
      open
      title={isEdit ? `Modifier l’unité « ${unit.name} »` : 'Nouvelle unité'}
      okText={isEdit ? 'Enregistrer' : 'Créer l’unité'}
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={save.isPending}
    >
      <Form<UnitInput>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={unit ?? { name: '', symbol: '', allowsDecimal: false }}
        onFinish={(values) => save.mutate(values)}
        className="mt-4"
      >
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Indiquez un nom' }, { max: 40 }]}>
          <Input placeholder="Sac de 50 kg, Carton…" />
        </Form.Item>
        <Form.Item name="symbol" label="Symbole" rules={[{ required: true, whitespace: true, message: 'Indiquez un symbole' }, { max: 10 }]}>
          <Input placeholder="sac, ctn…" className="w-40" />
        </Form.Item>
        <Form.Item
          name="allowsDecimal"
          label="Quantités décimales"
          valuePropName="checked"
          extra={isEdit ? 'Fixé à la création : des stocks à 2,5 deviendraient invalides.' : 'Ex. 2,5 kg. Laissez désactivé pour compter à l’unité.'}
        >
          <Switch disabled={isEdit} aria-label="Quantités décimales" />
        </Form.Item>
        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}

/** Unités de vente (pièce, kg, litre…). Une unité utilisée n'est jamais supprimée : on l'archive. */
export function UnitsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canManage = usePermission('products.manage')
  const { data: units = [], isPending, error } = useUnits(true)
  const [showArchived, setShowArchived] = useState(false)
  const [formUnit, setFormUnit] = useState<Unit | null | undefined>(undefined)

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.units.all })

  const archive = useMutation({
    mutationFn: ({ unit, archived }: { unit: Unit; archived: boolean }) => catalogService.updateUnit(unit.id, { archived }),
    onSuccess: ({ unit }, { archived }) => {
      void refresh()
      message.success(archived ? `Unité « ${unit.name} » archivée` : `Unité « ${unit.name} » restaurée`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const visible = showArchived ? units : units.filter((unit) => !unit.archivedAt)

  const columns: TableColumnsType<Unit> = [
    { title: 'Unité', dataIndex: 'name', render: (name: string) => <Typography.Text strong>{name}</Typography.Text> },
    { title: 'Symbole', dataIndex: 'symbol', width: 120, render: (symbol: string) => <Tag>{symbol}</Tag> },
    {
      title: 'Quantités',
      dataIndex: 'allowsDecimal',
      width: 180,
      render: (allowsDecimal: boolean) => (allowsDecimal ? 'Décimales (2,5)' : 'Entières seulement'),
    },
    {
      title: 'Statut',
      key: 'status',
      width: 120,
      render: (_, unit) => (unit.archivedAt ? <Tag>Archivée</Tag> : <Tag color="green">Active</Tag>),
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: unknown, unit: Unit) => (
              <Space size={4}>
                <Tooltip title="Modifier">
                  <Button icon={<EditOutlined />} size="small" onClick={() => setFormUnit(unit)} aria-label={`Modifier ${unit.name}`} />
                </Tooltip>
                <Popconfirm
                  title={unit.archivedAt ? `Restaurer « ${unit.name} » ?` : `Archiver « ${unit.name} » ?`}
                  description={unit.archivedAt ? undefined : 'Elle ne sera plus proposée pour les nouveaux produits.'}
                  okText={unit.archivedAt ? 'Restaurer' : 'Archiver'}
                  cancelText="Annuler"
                  onConfirm={() => archive.mutate({ unit, archived: !unit.archivedAt })}
                >
                  <Button
                    icon={unit.archivedAt ? <UndoOutlined /> : <InboxOutlined />}
                    size="small"
                    aria-label={unit.archivedAt ? `Restaurer ${unit.name}` : `Archiver ${unit.name}`}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Unités
        </Typography.Title>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormUnit(null)}>
            Nouvelle unité
          </Button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch size="small" checked={showArchived} onChange={setShowArchived} aria-label="Afficher les unités archivées" />
        Afficher les unités archivées
      </label>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Unit>
          rowKey="id"
          columns={columns}
          dataSource={visible}
          loading={isPending}
          pagination={false}
          rowClassName={(unit) => (unit.archivedAt ? 'opacity-60' : '')}
        />
      </Card>

      {formUnit !== undefined && (
        <UnitFormModal
          key={formUnit?.id ?? 'new'}
          unit={formUnit}
          onCancel={() => setFormUnit(undefined)}
          onSaved={(unit, created) => {
            void refresh()
            setFormUnit(undefined)
            message.success(created ? `Unité « ${unit.name} » créée` : `Unité « ${unit.name} » mise à jour`)
          }}
        />
      )}
    </div>
  )
}
