import { UserAddOutlined, UserOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select, Tooltip } from 'antd'
import { useState } from 'react'
import { useDebouncedValue } from '../../hook/useDebouncedValue'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as posService from '../../services/pos.service'
import { formatMoney } from '../../utils/format'

interface CustomerPickerProps {
  value: { id: string; name: string } | null
  onChange: (customer: { id: string; name: string } | null) => void
}

/** Client de la vente (facultatif ; obligatoire pour une vente à crédit). Recherche par nom ou téléphone. */
export function CustomerPicker({ value, onChange }: CustomerPickerProps) {
  const canCreate = usePermission('customers.manage')
  const [term, setTerm] = useState('')
  const [creating, setCreating] = useState(false)
  const search = useDebouncedValue(term.trim(), 250)
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.pos.customers(search),
    queryFn: () => posService.searchCustomers(search),
    enabled: search.length > 0,
  })
  const results = search ? (data?.items ?? []) : []
  const options = results.map((customer) => ({
    value: customer.id,
    label: `${customer.name}${customer.phone ? ` · ${customer.phone}` : ''}${Number(customer.balance) > 0 ? ` · dette ${formatMoney(customer.balance)}` : ''}`,
    name: customer.name,
  }))
  // Le client choisi reste affiché même s'il ne fait plus partie des résultats
  if (value && !options.some((option) => option.value === value.id)) options.unshift({ value: value.id, label: value.name, name: value.name })

  return (
    <div className="flex gap-2">
      <Select
        showSearch={{ filterOption: false, onSearch: setTerm, searchValue: term }}
        allowClear
        value={value?.id}
        onChange={(id) => {
          const option = options.find((item) => item.value === id)
          onChange(option ? { id: option.value, name: option.name } : null)
          setTerm('')
        }}
        loading={isFetching}
        placeholder="Client (facultatif)"
        suffixIcon={<UserOutlined />}
        notFoundContent={search ? 'Aucun client' : 'Nom ou téléphone…'}
        options={options}
        className="min-w-0 flex-1"
        aria-label="Client"
      />
      {canCreate && (
        <Tooltip title="Nouveau client">
          <Button icon={<UserAddOutlined />} onClick={() => setCreating(true)} aria-label="Nouveau client" />
        </Tooltip>
      )}
      {creating && (
        <NewCustomerModal
          onCancel={() => setCreating(false)}
          onCreated={(customer) => {
            setCreating(false)
            onChange(customer)
          }}
        />
      )}
    </div>
  )
}

function NewCustomerModal({ onCancel, onCreated }: { onCancel: () => void; onCreated: (customer: { id: string; name: string }) => void }) {
  const [form] = Form.useForm<{ name: string; phone: string }>()
  const create = useMutation({
    mutationFn: (values: { name: string; phone: string }) => posService.createCustomer({ name: values.name.trim(), phone: values.phone?.trim() || null }),
    onSuccess: ({ customer }) => onCreated({ id: customer.id, name: customer.name }),
  })
  return (
    <Modal open title="Nouveau client" okText="Créer" cancelText="Annuler" onOk={() => form.submit()} onCancel={onCancel} confirmLoading={create.isPending}>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(values) => create.mutate(values)} className="mt-4">
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Indiquez le nom du client' }, { min: 2, max: 150 }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="phone" label="Téléphone" rules={[{ pattern: /^\+?[0-9 ]{6,20}$/, message: 'Téléphone invalide' }]}>
          <Input placeholder="+221 77 000 00 00" />
        </Form.Item>
        {create.error && <Alert type="error" title={getErrorMessage(create.error)} showIcon />}
      </Form>
    </Modal>
  )
}
