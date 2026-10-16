import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, DatePicker, Descriptions, Drawer, Form, Input, Modal, Popconfirm, Select, Skeleton, Table, Tag, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useRef } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { Money } from '../../components/Money'
import { INVOICE_STATUS, SUPPLIER_PAYMENT_LABELS } from '../../constants/purchases'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage, newIdempotencyKey } from '../../services/api'
import * as purchasesService from '../../services/purchases.service'
import { SUPPLIER_PAYMENT_METHODS, type SupplierInvoice, type SupplierPayment, type SupplierPaymentMethod } from '../../types/purchases'
import { formatDate } from '../../utils/format'
import { SupplierSelect } from './SupplierSelect'

interface InvoiceValues {
  supplierId: string
  reference: string
  invoiceDate: Dayjs
  dueDate: Dayjs | null
  total: string | null
  notes: string
}

/** Enregistrement d'une facture fournisseur (montant, date, échéance). */
export function InvoiceFormModal({ onCancel, onSaved }: { onCancel: () => void; onSaved: (invoice: SupplierInvoice) => void }) {
  const [form] = Form.useForm<InvoiceValues>()
  const save = useMutation({
    mutationFn: (values: InvoiceValues) =>
      purchasesService.createInvoice({
        supplierId: values.supplierId,
        reference: values.reference.trim(),
        invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate ? values.dueDate.format('YYYY-MM-DD') : null,
        total: values.total!,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: ({ invoice }) => onSaved(invoice),
  })

  return (
    <Modal open title="Nouvelle facture fournisseur" okText="Enregistrer la facture" cancelText="Annuler" onOk={() => form.submit()} onCancel={onCancel} confirmLoading={save.isPending} width={600}>
      <Form<InvoiceValues> form={form} layout="vertical" requiredMark={false} initialValues={{ invoiceDate: dayjs() }} onFinish={(values) => save.mutate(values)} className="mt-4">
        <Form.Item name="supplierId" label="Fournisseur" rules={[{ required: true, message: 'Choisissez le fournisseur' }]}>
          <SupplierSelect />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item name="reference" label="N° de facture" rules={[{ required: true, whitespace: true, message: 'Indiquez le numéro de la facture' }, { max: 60 }]}>
            <Input placeholder="FA-2026-0451" />
          </Form.Item>
          <Form.Item name="total" label="Montant total" rules={[{ required: true, message: 'Indiquez le montant' }]}>
            <AmountInput aria-label="Montant total" />
          </Form.Item>
          <Form.Item name="invoiceDate" label="Date de la facture" rules={[{ required: true, message: 'Indiquez la date' }]}>
            <DatePicker format="DD/MM/YYYY" className="w-full" aria-label="Date de la facture" />
          </Form.Item>
          <Form.Item
            name="dueDate"
            label="Échéance"
            dependencies={['invoiceDate']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, value: Dayjs | null) =>
                  !value || !value.isBefore(getFieldValue('invoiceDate'), 'day') ? Promise.resolve() : Promise.reject(new Error('L’échéance précède la date de facture')),
              }),
            ]}
          >
            <DatePicker format="DD/MM/YYYY" className="w-full" aria-label="Échéance" />
          </Form.Item>
        </div>
        <Form.Item name="notes" label="Commentaire" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}

interface PaymentValues {
  amount: string | null
  method: SupplierPaymentMethod
  paidAt: Dayjs
  reference: string
}

/** Détail d'une facture : paiements déjà faits, nouveau paiement (jamais plus que le reste dû). */
export function InvoiceDetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (message: string) => void }) {
  const [form] = Form.useForm<PaymentValues>()
  // Une clé par paiement saisi : un double clic ou une coupure ne paie jamais deux fois
  const paymentKey = useRef(newIdempotencyKey())
  const { data: invoice, error, refetch } = useQuery({
    queryKey: queryKeys.purchases.invoice(id),
    queryFn: async () => (await purchasesService.getInvoice(id)).invoice,
  })

  const pay = useMutation({
    mutationFn: (values: PaymentValues) =>
      purchasesService.addPayment(
        id,
        { amount: values.amount!, method: values.method, paidAt: values.paidAt.format('YYYY-MM-DD'), reference: values.reference?.trim() || null },
        paymentKey.current,
      ),
    onSuccess: ({ invoice: updated }) => {
      paymentKey.current = newIdempotencyKey()
      form.resetFields()
      void refetch()
      onChanged(updated.status === 'paid' ? `Facture ${updated.reference} soldée` : `Paiement enregistré : reste ${Number(updated.remaining).toLocaleString('fr-FR')} FCFA`)
    },
  })

  const cancel = useMutation({
    mutationFn: () => purchasesService.cancelInvoice(id),
    onSuccess: ({ invoice: updated }) => {
      void refetch()
      onChanged(`Facture ${updated.reference} annulée`)
    },
  })

  const open = invoice && (invoice.status === 'unpaid' || invoice.status === 'partially_paid')

  return (
    <Drawer
      open
      title={invoice ? `Facture ${invoice.reference}` : 'Facture'}
      size={680}
      onClose={onClose}
      footer={
        invoice?.status === 'unpaid' && (
          <div className="flex justify-end">
            <Popconfirm title="Annuler cette facture ?" description="Seule une facture sans paiement peut être annulée." okText="Annuler la facture" okButtonProps={{ danger: true }} cancelText="Non" onConfirm={() => cancel.mutate()}>
              <Button danger loading={cancel.isPending}>
                Annuler la facture
              </Button>
            </Popconfirm>
          </div>
        )
      }
    >
      {(error || cancel.error) && <Alert type="error" title={getErrorMessage(error ?? cancel.error)} showIcon className="mb-4" />}
      {!invoice ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Fournisseur">{invoice.supplier?.name}</Descriptions.Item>
            <Descriptions.Item label="État">
              <Tag color={INVOICE_STATUS[invoice.status].color}>{INVOICE_STATUS[invoice.status].label}</Tag>
              {invoice.overdue && <Tag color="red">Échue</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Date">{formatDate(invoice.invoiceDate)}</Descriptions.Item>
            <Descriptions.Item label="Échéance">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</Descriptions.Item>
            <Descriptions.Item label="Montant">
              <Money value={invoice.total} />
            </Descriptions.Item>
            <Descriptions.Item label="Déjà payé">
              <Money value={invoice.amountPaid} />
            </Descriptions.Item>
            <Descriptions.Item label="Reste dû">
              <Money value={invoice.remaining} className="font-semibold" />
            </Descriptions.Item>
          </Descriptions>

          <Table<SupplierPayment>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={invoice.payments ?? []}
            locale={{ emptyText: 'Aucun paiement' }}
            columns={[
              { title: 'Payé le', dataIndex: 'paidAt', render: (value: string) => formatDate(value) },
              { title: 'Moyen', dataIndex: 'method', render: (value: SupplierPaymentMethod) => SUPPLIER_PAYMENT_LABELS[value] },
              { title: 'Référence', dataIndex: 'reference', render: (value: string | null) => value ?? '—' },
              { title: 'Montant', dataIndex: 'amount', align: 'right', render: (value: string) => <Money value={value} /> },
            ]}
          />

          {open && (
            <div className="rounded-lg border border-slate-200 p-4">
              <Typography.Title level={5}>Enregistrer un paiement</Typography.Title>
              <Form<PaymentValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                initialValues={{ amount: invoice.remaining, method: 'bank_transfer', paidAt: dayjs() }}
                onFinish={(values) => pay.mutate(values)}
              >
                <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  <Form.Item
                    name="amount"
                    label="Montant"
                    rules={[
                      { required: true, message: 'Indiquez le montant' },
                      {
                        validator: (_, value: string | null) =>
                          !value || Number(value) <= Number(invoice.remaining) ? Promise.resolve() : Promise.reject(new Error('Le montant dépasse le reste dû')),
                      },
                    ]}
                  >
                    <AmountInput aria-label="Montant du paiement" />
                  </Form.Item>
                  <Form.Item name="method" label="Moyen de paiement">
                    <Select options={SUPPLIER_PAYMENT_METHODS.map((method) => ({ value: method, label: SUPPLIER_PAYMENT_LABELS[method] }))} aria-label="Moyen de paiement" />
                  </Form.Item>
                  <Form.Item name="paidAt" label="Payé le">
                    <DatePicker format="DD/MM/YYYY" className="w-full" aria-label="Payé le" />
                  </Form.Item>
                  <Form.Item name="reference" label="Référence" rules={[{ max: 60 }]}>
                    <Input placeholder="N° de virement, de chèque…" />
                  </Form.Item>
                </div>
                {pay.error && <Alert type="error" title={getErrorMessage(pay.error)} showIcon className="mb-3" />}
                <Button type="primary" htmlType="submit" loading={pay.isPending}>
                  Enregistrer le paiement
                </Button>
              </Form>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
