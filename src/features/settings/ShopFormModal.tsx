import { useMutation } from '@tanstack/react-query'
import { Alert, Form, Input, Modal } from 'antd'
import { getErrorMessage } from '../../services/api'
import * as shopsService from '../../services/shops.service'
import type { Shop, ShopInput } from '../../types/settings'

interface ShopFormModalProps {
  open: boolean
  /** null : nouvelle boutique ; sinon modification. */
  shop: Shop | null
  onCancel: () => void
  onSaved: (shop: Shop, created: boolean) => void
}

/** Création ou modification d'une boutique (nom, code des documents, coordonnées du ticket). */
export function ShopFormModal({ open, shop, onCancel, onSaved }: ShopFormModalProps) {
  const [form] = Form.useForm<ShopInput>()
  const isEdit = shop !== null

  const save = useMutation({
    mutationFn: (values: ShopInput) => {
      const input = { ...values, code: values.code.trim().toUpperCase() }
      return isEdit ? shopsService.updateShop(shop.id, input) : shopsService.createShop(input)
    },
    onSuccess: ({ shop: saved }) => onSaved(saved, !isEdit),
  })

  return (
    <Modal
      open={open}
      title={isEdit ? `Modifier ${shop.name}` : 'Nouvelle boutique'}
      okText={isEdit ? 'Enregistrer' : 'Créer la boutique'}
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={save.isPending}
      destroyOnHidden
    >
      <Form<ShopInput>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={shop ?? { name: '', code: '', address: '', phone: '' }}
        onFinish={(values) => save.mutate(values)}
        className="mt-4"
      >
        <Form.Item
          name="name"
          label="Nom"
          rules={[
            { required: true, whitespace: true, message: 'Indiquez le nom de la boutique' },
            { min: 2, max: 120, message: 'Entre 2 et 120 caractères' },
          ]}
        >
          <Input placeholder="Boutique du marché" />
        </Form.Item>
        <Form.Item
          name="code"
          label="Code"
          extra="Apparaît dans les numéros de tickets et de documents (ex. BTQ1-T-2026-000123)."
          normalize={(value: string) => value.toUpperCase()}
          rules={[
            { required: true, message: 'Indiquez un code' },
            { pattern: /^[A-Z0-9]{2,10}$/, message: '2 à 10 lettres majuscules ou chiffres' },
          ]}
        >
          <Input placeholder="BTQ2" maxLength={10} className="uppercase" />
        </Form.Item>
        <Form.Item name="address" label="Adresse" rules={[{ max: 255, message: '255 caractères maximum' }]}>
          <Input placeholder="Imprimée sur les tickets" />
        </Form.Item>
        <Form.Item name="phone" label="Téléphone" rules={[{ max: 30, message: '30 caractères maximum' }]}>
          <Input placeholder="+221 77 000 00 00" />
        </Form.Item>
        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}
