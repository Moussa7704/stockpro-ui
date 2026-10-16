import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { queryKeys } from '../../lib/queryKeys'
import { PAYMENT_TYPE_LABELS } from '../../constants/paymentMethods'
import { getErrorMessage } from '../../services/api'
import * as paymentMethodsService from '../../services/paymentMethods.service'
import { PAYMENT_METHOD_TYPES, type PaymentMethod, type PaymentMethodType } from '../../types/settings'
import { usePaymentMethods } from './queries'

interface MethodValues {
  code: string
  name: string
  type: PaymentMethodType
  sortOrder: number
}

/** Ajout (code et type définitifs) ou modification (nom et ordre d'affichage) d'un moyen de paiement. */
function PaymentMethodFormModal({
  method,
  onCancel,
  onSaved,
}: {
  method: PaymentMethod | null
  onCancel: () => void
  onSaved: (method: PaymentMethod, created: boolean) => void
}) {
  const [form] = Form.useForm<MethodValues>()
  const isEdit = method !== null

  const save = useMutation({
    mutationFn: (values: MethodValues) =>
      isEdit
        ? paymentMethodsService.updatePaymentMethod(method.id, { name: values.name, sortOrder: values.sortOrder })
        : paymentMethodsService.createPaymentMethod(values),
    onSuccess: ({ paymentMethod }) => onSaved(paymentMethod, !isEdit),
  })

  return (
    <Modal
      open
      title={isEdit ? `Modifier « ${method.name} »` : 'Nouveau moyen de paiement'}
      okText={isEdit ? 'Enregistrer' : 'Ajouter'}
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={save.isPending}
      destroyOnHidden
    >
      <Form<MethodValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={method ?? { code: '', name: '', type: 'mobile_money', sortOrder: 10 }}
        onFinish={(values) => save.mutate(values)}
        className="mt-4"
      >
        <Form.Item
          name="name"
          label="Nom affiché en caisse"
          rules={[
            { required: true, whitespace: true, message: 'Indiquez un nom' },
            { min: 2, max: 60, message: 'Entre 2 et 60 caractères' },
          ]}
        >
          <Input placeholder="Wave, Orange Money…" />
        </Form.Item>
        <Form.Item
          name="type"
          label="Type"
          extra={isEdit ? 'Le type ne change pas : il classe les ventes passées.' : '« Espèces » compte dans le tiroir-caisse à la clôture.'}
        >
          <Select disabled={isEdit} options={PAYMENT_METHOD_TYPES.map((type) => ({ value: type, label: PAYMENT_TYPE_LABELS[type] }))} aria-label="Type" />
        </Form.Item>
        <Form.Item
          name="code"
          label="Code interne"
          normalize={(value: string) => value.toLowerCase()}
          rules={isEdit ? [] : [{ required: true, pattern: /^[a-z0-9_]{2,30}$/, message: 'Lettres minuscules, chiffres et _ (2 à 30)' }]}
        >
          <Input disabled={isEdit} placeholder="wave" />
        </Form.Item>
        <Form.Item name="sortOrder" label="Ordre d’affichage en caisse" extra="Le plus petit apparaît en premier.">
          <InputNumber min={0} max={1000} className="w-32" aria-label="Ordre d’affichage" />
        </Form.Item>
        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}

/**
 * Onglet "Moyens de paiement" : ceux proposés en caisse. On ne les supprime pas (ils figurent
 * sur des ventes passées) : on les désactive.
 */
export function PaymentMethodsTab() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { data: methods = [], isPending, error } = usePaymentMethods({ includeInactive: true })
  // undefined : fenêtre fermée ; null : création ; PaymentMethod : modification
  const [formMethod, setFormMethod] = useState<PaymentMethod | null | undefined>(undefined)

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all })

  const toggle = useMutation({
    mutationFn: ({ method, active }: { method: PaymentMethod; active: boolean }) =>
      paymentMethodsService.updatePaymentMethod(method.id, { active }),
    onSuccess: ({ paymentMethod }) => {
      void refresh()
      message.success(paymentMethod.active ? `${paymentMethod.name} réactivé` : `${paymentMethod.name} désactivé`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  function handleSaved(method: PaymentMethod, created: boolean) {
    void refresh()
    setFormMethod(undefined)
    message.success(created ? `« ${method.name} » ajouté` : `« ${method.name} » mis à jour`)
  }

  const columns: TableColumnsType<PaymentMethod> = [
    {
      title: 'Moyen de paiement',
      key: 'name',
      render: (_, method) => (
        <div className="flex flex-col">
          <Typography.Text strong>{method.name}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {method.code}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 170,
      render: (type: PaymentMethodType) => <Tag color={type === 'cash' ? 'green' : 'blue'}>{PAYMENT_TYPE_LABELS[type]}</Tag>,
    },
    { title: 'Ordre', dataIndex: 'sortOrder', width: 80, align: 'right', responsive: ['md'] },
    {
      title: 'Actif en caisse',
      key: 'active',
      width: 130,
      render: (_, method) => (
        <Switch
          checked={method.active}
          loading={toggle.isPending && toggle.variables?.method.id === method.id}
          onChange={(active) => toggle.mutate({ method, active })}
          aria-label={`${method.name} actif en caisse`}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, method) => (
        <Space>
          <Tooltip title="Modifier">
            <Button icon={<EditOutlined />} size="small" onClick={() => setFormMethod(method)} aria-label={`Modifier ${method.name}`} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormMethod(null)}>
          Nouveau moyen de paiement
        </Button>
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<PaymentMethod>
          rowKey="id"
          columns={columns}
          dataSource={methods}
          loading={isPending}
          pagination={false}
          scroll={{ x: 560 }}
          rowClassName={(method) => (method.active ? '' : 'opacity-60')}
        />
      </Card>

      {formMethod !== undefined && (
        <PaymentMethodFormModal
          key={formMethod?.id ?? 'new'}
          method={formMethod}
          onCancel={() => setFormMethod(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
