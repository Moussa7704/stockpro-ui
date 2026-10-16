import { useMutation } from '@tanstack/react-query'
import { Alert, Form, Input, Modal, Switch } from 'antd'
import { AmountInput } from '../../components/AmountInput'
import { usePermission } from '../../hook/usePermission'
import { getErrorMessage } from '../../services/api'
import * as customersService from '../../services/customers.service'
import type { Customer, CustomerInput } from '../../types/customers'

interface CustomerValues {
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  allowCredit: boolean
  creditLimit: string | null
}

const emptyToNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)

/**
 * Création ou modification d'un client. Le plafond de crédit est une décision financière :
 * il n'est proposé qu'aux rôles qui voient les comptes (gérant, comptable, propriétaire).
 */
export function CustomerFormModal({ customer, onCancel, onSaved }: { customer: (Customer & { address?: string | null; notes?: string | null }) | null; onCancel: () => void; onSaved: (customer: Customer, created: boolean) => void }) {
  const [form] = Form.useForm<CustomerValues>()
  const canSetCredit = usePermission('reports.view')
  const allowCredit = Form.useWatch('allowCredit', form)
  const isEdit = customer !== null

  const save = useMutation({
    mutationFn: (values: CustomerValues) => {
      const input: CustomerInput = {
        name: values.name.trim(),
        phone: emptyToNull(values.phone),
        email: emptyToNull(values.email),
        address: emptyToNull(values.address),
        notes: emptyToNull(values.notes),
        // Sans le droit, on n'envoie pas le plafond (le serveur refuserait toute la modification)
        ...(canSetCredit && { creditLimit: values.allowCredit ? (values.creditLimit ?? '0') : null }),
      }
      return isEdit ? customersService.updateCustomer(customer.id, input) : customersService.createCustomer(input)
    },
    onSuccess: ({ customer: saved }) => onSaved(saved, !isEdit),
  })

  return (
    <Modal
      open
      title={isEdit ? `Modifier ${customer.name}` : 'Nouveau client'}
      okText={isEdit ? 'Enregistrer' : 'Créer le client'}
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={save.isPending}
      width={600}
    >
      <Form<CustomerValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          name: customer?.name ?? '',
          phone: customer?.phone ?? null,
          email: customer?.email ?? null,
          address: customer?.address ?? null,
          notes: customer?.notes ?? null,
          allowCredit: customer?.creditLimit !== null && customer?.creditLimit !== undefined,
          creditLimit: customer?.creditLimit ?? null,
        }}
        onFinish={(values) => save.mutate(values)}
        className="mt-4"
      >
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Indiquez le nom du client' }, { min: 2, max: 150 }]}>
          <Input autoFocus />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item name="phone" label="Téléphone" rules={[{ pattern: /^\+?[0-9 ]{6,20}$/, message: 'Téléphone invalide' }]}>
            <Input placeholder="+221 77 000 00 00" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email invalide' }]}>
            <Input />
          </Form.Item>
        </div>
        <Form.Item name="address" label="Adresse" rules={[{ max: 255 }]}>
          <Input />
        </Form.Item>
        {canSetCredit && (
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item name="allowCredit" label="Vente à crédit autorisée" valuePropName="checked">
              <Switch aria-label="Vente à crédit autorisée" />
            </Form.Item>
            {allowCredit && (
              <Form.Item name="creditLimit" label="Plafond de crédit" extra="Dette maximale que ce client peut avoir." rules={[{ required: true, message: 'Indiquez le plafond' }]}>
                <AmountInput aria-label="Plafond de crédit" />
              </Form.Item>
            )}
          </div>
        )}
        <Form.Item name="notes" label="Notes" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}
