import { DeleteOutlined, LockOutlined, MutedOutlined, ShoppingCartOutlined, SoundOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Empty, Popconfirm, Skeleton, Table, Tag, Tooltip, Typography, type RefSelectProps } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { Money } from '../../components/Money'
import { ProductPicker } from '../../components/ProductPicker'
import { QuantityInput } from '../../components/QuantityInput'
import { useActiveShop } from '../../hook/useActiveShop'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { ApiError, getErrorMessage } from '../../services/api'
import * as posService from '../../services/pos.service'
import { selectActiveCompany } from '../../store/authSlice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  cartBound,
  cartCleared,
  cartDiscountChanged,
  customerChanged,
  lineDiscountChanged,
  lineRemoved,
  productAdded,
  quantityChanged,
  selectCart,
  unitPriceChanged,
  type CartLine,
} from '../../store/posSlice'
import { formatDateTime, formatMoney } from '../../utils/format'
import { useCompany, usePaymentMethods } from '../settings/queries'
import { CustomerPicker } from './CustomerPicker'
import { DiscountButton } from './DiscountButton'
import { PaymentModal } from './PaymentModal'
import { discountPercent, fromCents, priceCart } from './pricing'
import { useCurrentSession } from './queries'
import { CloseSessionModal, OpenSessionCard } from './SessionCards'
import { isSaleSoundEnabled, playSaleSound, preloadSaleSound, setSaleSoundEnabled } from './saleSound'
import { TicketModal } from './TicketModal'

/**
 * Caisse : scan à la douchette (ou recherche), panier, remises, client, encaissement et ticket.
 * Raccourcis : F2 = champ produit, F9 = encaisser. Le panier survit à un rechargement, et la vente
 * est envoyée avec une clé d'idempotence : jamais enregistrée deux fois, même après une coupure.
 */
export function PosPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const dispatch = useAppDispatch()
  const company = useAppSelector(selectActiveCompany)
  const cart = useAppSelector(selectCart)
  const { activeShop } = useActiveShop()
  const { data: session, isPending: sessionLoading, error: sessionError } = useCurrentSession(activeShop?.id)
  const { data: methods = [] } = usePaymentMethods()
  const { data: companySettings } = useCompany()
  const canDiscount = usePermission('sales.discount')
  const canOverridePrice = usePermission('sales.price_override')
  const maxCashierPercent = companySettings?.settings.maxCashierDiscountPercent ?? 0
  const discountsAllowed = canDiscount || maxCashierPercent > 0

  const pickerRef = useRef<RefSelectProps>(null)
  const [paying, setPaying] = useState(false)
  const [ticketSaleId, setTicketSaleId] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [soundOn, setSoundOn] = useState(isSaleSoundEnabled)
  useEffect(() => preloadSaleSound(), [])

  // Le panier appartient à une entreprise et une boutique : en changer repart d'un panier vide
  useEffect(() => {
    if (company && activeShop) dispatch(cartBound({ companyId: company.id, shopId: activeShop.id }))
  }, [company, activeShop, dispatch])

  const focusPicker = () => setTimeout(() => pickerRef.current?.focus(), 0)

  const priced = priceCart(
    cart.lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount, name: line.name })),
    cart.discount,
  )
  const percent = discountPercent(priced)
  const overCap = !canDiscount && percent > maxCashierPercent
  const invalidLine = cart.lines.find((line) => !line.quantity || Number(line.quantity) <= 0)
  const cartProblem =
    priced.error ??
    (invalidLine ? `« ${invalidLine.name} » : quantité invalide` : null) ??
    (overCap ? `Remise de ${percent.toFixed(1).replace('.', ',')} % : au-delà de ${maxCashierPercent} %, l’accord d’un gérant est nécessaire` : null)

  const sale = useMutation({
    mutationFn: (payments: { methodId: string; amount: string }[]) =>
      posService.createSale(
        {
          shopId: activeShop!.id,
          customerId: cart.customer?.id ?? null,
          lines: cart.lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            // Prix envoyé seulement s'il diffère du catalogue (le serveur vérifie la permission)
            ...(Number(line.unitPrice) !== Number(line.catalogPrice) && { unitPrice: line.unitPrice }),
            ...(line.discount && { discount: line.discount }),
          })),
          ...(cart.discount && { discount: cart.discount }),
          payments,
          notes: cart.notes.trim() || null,
        },
        // Même clé tant que la vente n'est pas confirmée : un nouvel essai ne crée pas de doublon
        cart.idempotencyKey,
      ),
    onSuccess: ({ sale: created }) => {
      // Vente confirmée par le serveur : le son des pièces dans la caisse
      playSaleSound()
      dispatch(cartCleared())
      setPaying(false)
      setTicketSaleId(created.id)
      void queryClient.invalidateQueries({ queryKey: queryKeys.pos.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
  })

  const saleError = sale.error
    ? sale.error instanceof ApiError && sale.error.status === 0
      ? 'Vente non confirmée (connexion perdue). Réessayez : elle ne sera jamais enregistrée deux fois.'
      : getErrorMessage(sale.error)
    : null

  // Raccourcis clavier de la caisse
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault()
        focusPicker()
      }
      if (event.key === 'F9' && cart.lines.length > 0 && !cartProblem && !paying) {
        event.preventDefault()
        sale.reset()
        setPaying(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cart.lines.length, cartProblem, paying, sale])

  if (!activeShop) return <Alert type="info" showIcon title="Aucune boutique accessible : la caisse est indisponible." />
  if (sessionError) return <Alert type="error" showIcon title={getErrorMessage(sessionError)} />
  if (sessionLoading) return <Skeleton active />
  if (!session) {
    return (
      <OpenSessionCard
        shopId={activeShop.id}
        shopName={activeShop.name}
        onOpened={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.pos.all })
          message.success('Caisse ouverte : bonnes ventes !')
        }}
      />
    )
  }

  const columns = [
    {
      title: 'Produit',
      key: 'product',
      render: (_: unknown, line: CartLine) => (
        <div className="flex flex-col">
          <Typography.Text strong>{line.name}</Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            {line.sku}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Prix',
      key: 'price',
      width: 150,
      render: (_: unknown, line: CartLine) =>
        canOverridePrice ? (
          <AmountInput
            size="small"
            value={line.unitPrice}
            onChange={(unitPrice) => dispatch(unitPriceChanged({ productId: line.productId, unitPrice: unitPrice ?? '0' }))}
            aria-label={`Prix de ${line.name}`}
          />
        ) : (
          <Money value={line.unitPrice} />
        ),
    },
    {
      title: 'Quantité',
      key: 'quantity',
      width: 130,
      render: (_: unknown, line: CartLine) => (
        <QuantityInput
          size="small"
          value={line.quantity}
          onChange={(quantity) => dispatch(quantityChanged({ productId: line.productId, quantity: quantity ?? '' }))}
          allowsDecimal={line.allowsDecimal}
          unitSymbol={line.unitSymbol}
          aria-label={`Quantité de ${line.name}`}
        />
      ),
    },
    ...(discountsAllowed
      ? [
          {
            title: 'Remise',
            key: 'discount',
            width: 110,
            render: (_: unknown, line: CartLine) => (
              <DiscountButton value={line.discount} onChange={(discount) => dispatch(lineDiscountChanged({ productId: line.productId, discount }))} label={`Remise sur ${line.name}`} />
            ),
          },
        ]
      : []),
    {
      title: 'Total',
      key: 'total',
      width: 130,
      align: 'right' as const,
      render: (_: unknown, _line: CartLine, index: number) => {
        const line = priced.lines[index]
        return (
          <div className="flex flex-col items-end">
            <Money value={fromCents(line?.total ?? 0)} className="font-semibold" />
            {line && line.discount > 0 && <Money value={fromCents(line.gross)} className="text-xs text-slate-400 line-through" />}
          </div>
        )
      },
    },
    {
      title: '',
      key: 'remove',
      width: 44,
      render: (_: unknown, line: CartLine) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => dispatch(lineRemoved(line.productId))} aria-label={`Retirer ${line.name}`} />
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Typography.Title level={2} className="mb-0">
            Caisse
          </Typography.Title>
          <Tag color="green">
            {activeShop.name} · ouverte le {formatDateTime(session.openedAt)}
          </Tag>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title={soundOn ? 'Couper le son des ventes' : 'Activer le son des ventes'}>
            <Button
              icon={soundOn ? <SoundOutlined /> : <MutedOutlined />}
              aria-pressed={soundOn}
              aria-label="Son des ventes"
              onClick={() => {
                setSaleSoundEnabled(!soundOn)
                setSoundOn(!soundOn)
              }}
            />
          </Tooltip>
          <Button icon={<LockOutlined />} onClick={() => setClosing(true)}>
            Clôturer la caisse
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12 } }}>
          <ProductPicker
            selectRef={pickerRef}
            autoFocus
            size="large"
            placeholder="Scanner ou rechercher un produit (F2)…"
            onPick={(product) => {
              dispatch(
                productAdded({
                  productId: product.id,
                  sku: product.sku,
                  name: product.name,
                  unitSymbol: product.unit.symbol,
                  allowsDecimal: product.unit.allowsDecimal,
                  catalogPrice: product.salePrice,
                }),
              )
              focusPicker()
            }}
          />
          {cart.lines.length === 0 ? (
            <Empty image={<ShoppingCartOutlined className="text-5xl text-slate-300" />} description="Panier vide : scannez un article pour commencer" />
          ) : (
            <Table<CartLine> rowKey="productId" size="small" pagination={false} dataSource={cart.lines} columns={columns} scroll={{ x: 640 }} />
          )}
        </Card>

        <Card styles={{ body: { display: 'flex', flexDirection: 'column', gap: 16 } }}>
          <CustomerPicker value={cart.customer} onChange={(customer) => dispatch(customerChanged(customer))} />

          <div className="flex flex-col gap-1 text-base">
            <div className="flex justify-between">
              <span>Sous-total</span>
              <Money value={fromCents(priced.subtotal)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Remises
                {discountsAllowed && cart.lines.length > 0 && (
                  <DiscountButton value={cart.discount} onChange={(discount) => dispatch(cartDiscountChanged(discount))} label="Remise sur le ticket" />
                )}
              </span>
              <Money value={priced.discountTotal > 0 ? `-${fromCents(priced.discountTotal)}` : '0'} />
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-slate-200 pt-3">
              <span className="text-lg font-semibold">Total</span>
              <Money value={fromCents(priced.total)} className="text-3xl font-bold" />
            </div>
          </div>

          {cartProblem && <Alert type="warning" showIcon title={cartProblem} />}

          <Button
            type="primary"
            size="large"
            block
            disabled={cart.lines.length === 0 || !!cartProblem}
            onClick={() => {
              sale.reset()
              setPaying(true)
            }}
          >
            Encaisser (F9)
          </Button>
          <Popconfirm title="Vider le panier ?" okText="Vider" okButtonProps={{ danger: true }} cancelText="Non" onConfirm={() => dispatch(cartCleared())} disabled={cart.lines.length === 0}>
            <Button block danger disabled={cart.lines.length === 0}>
              Vider le panier
            </Button>
          </Popconfirm>
        </Card>
      </div>

      {paying && (
        <PaymentModal
          totalCents={priced.total}
          methods={methods}
          hasCustomer={!!cart.customer}
          submitting={sale.isPending}
          error={saleError}
          onCancel={() => {
            setPaying(false)
            focusPicker()
          }}
          onConfirm={(payments) => sale.mutate(payments)}
        />
      )}
      {ticketSaleId && (
        <TicketModal
          saleId={ticketSaleId}
          onClose={() => {
            setTicketSaleId(null)
            focusPicker()
          }}
        />
      )}
      {closing && (
        <CloseSessionModal
          sessionId={session.id}
          onCancel={() => setClosing(false)}
          onClosed={(closed) => {
            setClosing(false)
            void queryClient.invalidateQueries({ queryKey: queryKeys.pos.all })
            const difference = Number(closed.difference ?? 0)
            message.success(difference === 0 ? 'Caisse clôturée : caisse juste' : `Caisse clôturée avec un écart de ${formatMoney(closed.difference)}`)
          }}
        />
      )}
    </div>
  )
}
