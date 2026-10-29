import { EditOutlined, InboxOutlined, PlusOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useRef, useState } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { Money } from '../../components/Money'
import { useActiveShop, useShopFilter } from '../../hook/useActiveShop'
import { usePage } from '../../hook/usePage'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage, newIdempotencyKey } from '../../services/api'
import * as customersService from '../../services/customers.service'
import type { Expense, ExpenseCategory, ExpenseStatus } from '../../types/customers'
import { formatDate } from '../../utils/format'
import { useCurrentSession } from '../pos/queries'
import { usePaymentMethods } from '../settings/queries'
import { useShopName } from '../stock/queries'

const PAGE_SIZE = 20

function useExpenseCategories(includeArchived = false) {
  return useQuery({
    queryKey: includeArchived ? queryKeys.expenses.categoriesWithArchived : queryKeys.expenses.categories,
    queryFn: async () => (await customersService.listExpenseCategories(includeArchived)).categories,
  })
}

/** Nouvelle dépense : en espèces, elle peut être payée depuis le tiroir de MA caisse ouverte. */
function ExpenseFormModal({ onCancel, onSaved }: { onCancel: () => void; onSaved: (expense: Expense) => void }) {
  const { shops, activeShop } = useActiveShop()
  const { data: categories = [] } = useExpenseCategories()
  const { data: methods = [] } = usePaymentMethods()
  const [shopId, setShopId] = useState<string | undefined>(activeShop?.id)
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [amount, setAmount] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [spentAt, setSpentAt] = useState<Dayjs>(dayjs())
  const [chosenMethodId, setMethodId] = useState<string | undefined>()
  const [fromDrawer, setFromDrawer] = useState(false)
  const [reference, setReference] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const key = useRef(newIdempotencyKey())
  const { data: session } = useCurrentSession(shopId)

  const methodId = chosenMethodId ?? methods.find((method) => method.type === 'cash')?.id
  const isCash = methods.find((method) => method.id === methodId)?.type === 'cash'
  const drawerAvailable = isCash && !!session

  const save = useMutation({
    mutationFn: () =>
      customersService.createExpense(
        {
          shopId: shopId!,
          categoryId: categoryId!,
          amount: amount!,
          description: description.trim(),
          spentAt: spentAt.format('YYYY-MM-DD'),
          paymentMethodId: methodId!,
          cashSessionId: fromDrawer && drawerAvailable ? session.id : null,
          reference: reference.trim() || null,
        },
        key.current,
      ),
    onSuccess: ({ expense }) => onSaved(expense),
  })

  function submit() {
    setFormError(null)
    if (!shopId || !categoryId || !methodId) return setFormError('Choisissez la boutique, la catégorie et le moyen de paiement')
    if (!amount || Number(amount) <= 0) return setFormError('Indiquez le montant')
    if (description.trim().length < 2) return setFormError('Décrivez la dépense')
    save.mutate()
  }

  return (
    <Modal open title="Nouvelle dépense" okText="Enregistrer la dépense" cancelText="Annuler" onOk={submit} onCancel={onCancel} confirmLoading={save.isPending} width={620}>
      <Form layout="vertical" component="div" className="mt-4">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Boutique">
            <Select value={shopId} onChange={setShopId} options={shops.map((shop) => ({ value: shop.id, label: shop.name }))} aria-label="Boutique" />
          </Form.Item>
          <Form.Item label="Catégorie">
            <Select value={categoryId} onChange={setCategoryId} options={categories.map((category) => ({ value: category.id, label: category.name }))} placeholder="Loyer, électricité…" aria-label="Catégorie" />
          </Form.Item>
          <Form.Item label="Montant">
            <AmountInput value={amount} onChange={setAmount} autoFocus aria-label="Montant" />
          </Form.Item>
          <Form.Item label="Date">
            <DatePicker value={spentAt} onChange={(date) => date && setSpentAt(date)} format="DD/MM/YYYY" allowClear={false} disabledDate={(date) => date.isAfter(dayjs(), 'day')} className="w-full" aria-label="Date de la dépense" />
          </Form.Item>
        </div>
        <Form.Item label="Description">
          <Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={255} placeholder="Facture d’électricité d’octobre" aria-label="Description" />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Moyen de paiement">
            <Select value={methodId} onChange={setMethodId} options={methods.map((method) => ({ value: method.id, label: method.name }))} aria-label="Moyen de paiement" />
          </Form.Item>
          <Form.Item label="Référence">
            <Input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={60} placeholder="N° de facture…" aria-label="Référence" />
          </Form.Item>
        </div>
        {isCash && (
          <Form.Item
            label="Payée depuis le tiroir-caisse"
            extra={drawerAvailable ? 'Le montant sera déduit des espèces attendues à la clôture de votre caisse.' : 'Aucune caisse ouverte par vous dans cette boutique : la dépense est payée hors tiroir (coffre…).'}
          >
            <Switch checked={fromDrawer && drawerAvailable} disabled={!drawerAvailable} onChange={setFromDrawer} aria-label="Payée depuis le tiroir-caisse" />
          </Form.Item>
        )}
      </Form>
      {(formError || save.error) && <Alert type="error" title={formError ?? getErrorMessage(save.error)} showIcon />}
    </Modal>
  )
}

function CancelExpenseModal({ expense, onCancel, onDone }: { expense: Expense; onCancel: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const key = useRef(newIdempotencyKey())
  const cancel = useMutation({ mutationFn: () => customersService.cancelExpense(expense.id, reason.trim(), key.current), onSuccess: onDone })
  return (
    <Modal
      open
      title={`Annuler la dépense ${expense.number} ?`}
      okText="Annuler la dépense"
      okButtonProps={{ danger: true, disabled: reason.trim().length < 3, loading: cancel.isPending }}
      cancelText="Retour"
      onOk={() => cancel.mutate()}
      onCancel={onCancel}
    >
      <Input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} placeholder="Motif (obligatoire)" aria-label="Motif de l’annulation" />
      {cancel.error && <Alert type="error" title={getErrorMessage(cancel.error)} showIcon className="mt-3" />}
    </Modal>
  )
}

/** Catégories de dépenses : création, renommage, archivage. */
function CategoriesTable() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { data: categories = [], isPending } = useExpenseCategories(true)
  const [form, setForm] = useState<{ category: ExpenseCategory | null; name: string } | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses.categories })

  const save = useMutation({
    mutationFn: () => (form!.category ? customersService.updateExpenseCategory(form!.category.id, { name: form!.name.trim() }) : customersService.createExpenseCategory(form!.name.trim())),
    onSuccess: ({ category }) => {
      void refresh()
      setForm(null)
      message.success(`Catégorie « ${category.name} » enregistrée`)
    },
  })
  const archive = useMutation({
    mutationFn: (category: ExpenseCategory) => customersService.updateExpenseCategory(category.id, { archived: !category.archivedAt }),
    onSuccess: ({ category }) => {
      void refresh()
      message.success(category.archivedAt ? `« ${category.name} » archivée` : `« ${category.name} » restaurée`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button icon={<PlusOutlined />} onClick={() => setForm({ category: null, name: '' })}>
          Nouvelle catégorie
        </Button>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table<ExpenseCategory>
          rowKey="id"
          loading={isPending}
          pagination={false}
          dataSource={categories}
          rowClassName={(category) => (category.archivedAt ? 'opacity-60' : '')}
          columns={[
            { title: 'Catégorie', dataIndex: 'name', render: (name: string, category) => <span>{name} {category.archivedAt && <Tag>Archivée</Tag>}</span> },
            {
              title: '',
              key: 'actions',
              width: 100,
              render: (_, category) => (
                <Space size={4}>
                  <Tooltip title="Renommer">
                    <Button size="small" icon={<EditOutlined />} onClick={() => setForm({ category, name: category.name })} aria-label={`Renommer ${category.name}`} />
                  </Tooltip>
                  <Popconfirm title={category.archivedAt ? 'Restaurer cette catégorie ?' : 'Archiver cette catégorie ?'} okText="Oui" cancelText="Non" onConfirm={() => archive.mutate(category)}>
                    <Button size="small" icon={category.archivedAt ? <UndoOutlined /> : <InboxOutlined />} aria-label={category.archivedAt ? `Restaurer ${category.name}` : `Archiver ${category.name}`} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      {form && (
        <Modal open title={form.category ? 'Renommer la catégorie' : 'Nouvelle catégorie'} okText="Enregistrer" cancelText="Annuler" onOk={() => save.mutate()} onCancel={() => setForm(null)} okButtonProps={{ disabled: form.name.trim().length < 2, loading: save.isPending }}>
          <Input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} placeholder="Gardiennage, internet…" aria-label="Nom de la catégorie" />
          {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon className="mt-3" />}
        </Modal>
      )}
    </div>
  )
}

/** Dépenses (expenses.manage) : liste filtrée avec son total, saisie, annulation motivée, catégories. */
export function ExpensesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const shopName = useShopName()
  const { data: categories = [] } = useExpenseCategories()
  const [view, setView] = useState<'expenses' | 'categories'>('expenses')
  const shopId = useShopFilter()
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [status, setStatus] = useState<ExpenseStatus | undefined>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [page, setPage] = usePage(shopId)
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<Expense | null>(null)

  const query = { page, pageSize: PAGE_SIZE, shopId, categoryId, status, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') }
  const { data, isFetching, error } = useQuery({ queryKey: queryKeys.expenses.list(query), queryFn: () => customersService.listExpenses(query), placeholderData: keepPreviousData })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all })
    // Une dépense payée du tiroir change les espèces attendues de la caisse
    void queryClient.invalidateQueries({ queryKey: queryKeys.pos.all })
  }
  const filter = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const columns: TableColumnsType<Expense> = [
    { title: 'Date', dataIndex: 'spentAt', width: 120, render: (value: string) => formatDate(value) },
    {
      title: 'Dépense',
      key: 'description',
      render: (_, expense) => (
        <div className="flex flex-col">
          <Typography.Text>{expense.description}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {expense.number} · {expense.category?.name}
          </Typography.Text>
        </div>
      ),
    },
    { title: 'Boutique', key: 'shop', width: 160, responsive: ['lg'], render: (_, expense) => shopName(expense.shopId) },
    {
      title: 'Paiement',
      key: 'method',
      width: 170,
      responsive: ['md'],
      render: (_, expense) => (
        <span>
          {expense.paymentMethod?.name} {expense.cashSessionId && <Tag>tiroir</Tag>}
        </span>
      ),
    },
    {
      title: 'Montant',
      dataIndex: 'amount',
      width: 140,
      align: 'right',
      render: (value: string, expense) => <Money value={value} className={expense.status === 'cancelled' ? 'text-slate-400 line-through' : ''} />,
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_, expense) =>
        expense.status === 'cancelled' ? (
          <Tooltip title={expense.cancelReason}>
            <Tag color="red">Annulée</Tag>
          </Tooltip>
        ) : (
          <Button size="small" danger icon={<StopOutlined />} onClick={() => setCancelling(expense)} aria-label={`Annuler ${expense.number}`}>
            Annuler
          </Button>
        ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Dépenses
        </Typography.Title>
        {view === 'expenses' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Nouvelle dépense
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<'expenses' | 'categories'>
          value={view}
          onChange={setView}
          options={[
            { value: 'expenses', label: 'Dépenses' },
            { value: 'categories', label: 'Catégories' },
          ]}
          aria-label="Affichage"
        />
        {view === 'expenses' && (
          <>
            <DatePicker.RangePicker value={range} onChange={(value) => value?.[0] && value[1] && filter(setRange)([value[0], value[1]])} format="DD/MM/YYYY" allowClear={false} aria-label="Période" />
            <Select allowClear value={categoryId} onChange={(value) => filter(setCategoryId)(value ?? undefined)} placeholder="Toutes les catégories" options={categories.map((category) => ({ value: category.id, label: category.name }))} className="w-52" aria-label="Filtrer par catégorie" />
            <Select
              allowClear
              value={status}
              onChange={(value) => filter(setStatus)(value ?? undefined)}
              placeholder="Toutes"
              options={[
                { value: 'recorded', label: 'Enregistrées' },
                { value: 'cancelled', label: 'Annulées' },
              ]}
              className="w-40"
              aria-label="Filtrer par état"
            />
          </>
        )}
      </div>

      {view === 'categories' ? (
        <CategoriesTable />
      ) : (
        <>
          {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
          <Card styles={{ body: { padding: 0 } }}>
            <Table<Expense>
              rowKey="id"
              columns={columns}
              dataSource={data?.items ?? []}
              loading={isFetching}
              scroll={{ x: 720 }}
              pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
              locale={{ emptyText: 'Aucune dépense sur cette période' }}
              summary={() =>
                data && Number(data.totalAmount) > 0 ? (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4}>
                      <Typography.Text strong>Total (hors annulées)</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Money value={data.totalAmount} className="font-semibold" />
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} />
                  </Table.Summary.Row>
                ) : undefined
              }
            />
          </Card>
        </>
      )}

      {creating && (
        <ExpenseFormModal
          onCancel={() => setCreating(false)}
          onSaved={(expense) => {
            refresh()
            setCreating(false)
            message.success(`Dépense ${expense.number} enregistrée`)
          }}
        />
      )}
      {cancelling && (
        <CancelExpenseModal
          expense={cancelling}
          onCancel={() => setCancelling(null)}
          onDone={() => {
            refresh()
            message.success(`Dépense ${cancelling.number} annulée`)
            setCancelling(null)
          }}
        />
      )}
    </div>
  )
}
