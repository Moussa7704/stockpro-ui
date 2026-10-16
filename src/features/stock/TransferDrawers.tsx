import { ArrowRightOutlined, DeleteOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Drawer, Form, Input, Popconfirm, Select, Skeleton, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { ProductPicker } from '../../components/ProductPicker'
import { QuantityInput } from '../../components/QuantityInput'
import { TRANSFER_STATUS } from '../../constants/stock'
import { useActiveShop } from '../../hook/useActiveShop'
import { useAuth } from '../../hook/useAuth'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as stockService from '../../services/stock.service'
import type { Product } from '../../types/catalog'
import type { StockTransfer, StockTransferLine } from '../../types/stock'
import { formatDateTime, formatQuantity } from '../../utils/format'
import { useShopName } from './queries'

interface Line {
  product: Product
  quantity: string | null
}

/** Préparation d'un transfert (brouillon) : rien ne bouge tant qu'il n'est pas expédié. */
export function TransferFormDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (transfer: StockTransfer) => void }) {
  const { shops, activeShop } = useActiveShop()
  const [fromShopId, setFromShopId] = useState<string | undefined>(activeShop?.id)
  const [toShopId, setToShopId] = useState<string | undefined>()
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () =>
      stockService.createTransfer({
        fromShopId: fromShopId!,
        toShopId: toShopId!,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity! })),
      }),
    onSuccess: ({ transfer }) => onSaved(transfer),
  })

  function submit() {
    setFormError(null)
    if (!fromShopId || !toShopId) return setFormError('Choisissez les boutiques de départ et d’arrivée')
    if (fromShopId === toShopId) return setFormError('Les boutiques de départ et d’arrivée doivent être différentes')
    if (lines.length === 0) return setFormError('Ajoutez au moins un produit')
    if (lines.some((line) => !line.quantity || Number(line.quantity) <= 0)) return setFormError('Chaque ligne doit avoir une quantité positive')
    save.mutate()
  }

  const shopOptions = shops.map((shop) => ({ value: shop.id, label: shop.name }))

  return (
    <Drawer
      open
      title="Nouveau transfert entre boutiques"
      size={680}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="primary" onClick={submit} loading={save.isPending}>
            Préparer le transfert
          </Button>
        </div>
      }
    >
      <Form layout="vertical" requiredMark={false} component="div">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <Form.Item label="Départ">
            <Select value={fromShopId} onChange={setFromShopId} options={shopOptions} aria-label="Boutique de départ" />
          </Form.Item>
          <ArrowRightOutlined className="mb-8 text-slate-400" />
          <Form.Item label="Arrivée">
            <Select
              value={toShopId}
              onChange={setToShopId}
              options={shopOptions.filter((option) => option.value !== fromShopId)}
              placeholder="Choisir…"
              aria-label="Boutique d’arrivée"
            />
          </Form.Item>
        </div>
        <Form.Item label="Produits">
          <ProductPicker excludeIds={lines.map((line) => line.product.id)} onPick={(product) => setLines((current) => [...current, { product, quantity: null }])} />
        </Form.Item>
      </Form>

      <Table<Line>
        rowKey={(line) => line.product.id}
        dataSource={lines}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Ajoutez les produits à envoyer' }}
        columns={[
          { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
          {
            title: 'Quantité à envoyer',
            key: 'quantity',
            width: 180,
            render: (_, line) => (
              <QuantityInput
                size="small"
                value={line.quantity}
                onChange={(quantity) => setLines((current) => current.map((item) => (item.product.id === line.product.id ? { ...item, quantity } : item)))}
                allowsDecimal={line.product.unit.allowsDecimal}
                unitSymbol={line.product.unit.symbol}
                aria-label={`Quantité de ${line.product.name}`}
              />
            ),
          },
          {
            title: '',
            key: 'remove',
            width: 44,
            render: (_, line) => (
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => setLines((current) => current.filter((item) => item.product.id !== line.product.id))} aria-label={`Retirer ${line.product.name}`} />
            ),
          },
        ]}
      />
      <Input.TextArea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Commentaire (facultatif)" maxLength={2000} className="mt-4" aria-label="Commentaire" />
      {(formError || save.error) && <Alert type="error" title={formError ?? getErrorMessage(save.error)} showIcon className="mt-4" />}
    </Drawer>
  )
}

/** Détail d'un transfert et actions selon son état et la boutique de l'utilisateur. */
export function TransferDetailDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: (message: string) => void }) {
  const { activeCompany, can } = useAuth()
  const shopName = useShopName()
  const [receiving, setReceiving] = useState(false)
  // Quantités reçues saisies (par ligne) ; non saisie = tout ce qui a été envoyé
  const [received, setReceived] = useState<Record<string, string | null>>({})
  const { data: transfer, error, refetch } = useQuery({
    queryKey: queryKeys.stock.transfer(id),
    queryFn: async () => (await stockService.getTransfer(id)).transfer,
  })

  const action = useMutation({
    mutationFn: async (kind: 'ship' | 'receive' | 'cancel') => {
      if (kind === 'ship') return { kind, result: await stockService.shipTransfer(id) }
      if (kind === 'cancel') return { kind, result: await stockService.cancelTransfer(id) }
      const lines = (transfer?.lines ?? []).map((line) => ({ lineId: line.id, quantityReceived: received[line.id] ?? line.quantitySent }))
      return { kind, result: await stockService.receiveTransfer(id, lines) }
    },
    onSuccess: ({ kind, result }) => {
      setReceiving(false)
      void refetch()
      const labels = { ship: 'expédié', receive: 'réceptionné', cancel: 'annulé' }
      onChanged(`Transfert ${result.transfer.number} ${labels[kind]}`)
    },
  })

  const inMyShops = (shopId: string) => !!activeCompany && (activeCompany.allShops || activeCompany.shopIds.includes(shopId))
  const canTransfer = can('stock.transfer')
  const status = transfer ? TRANSFER_STATUS[transfer.status] : null

  return (
    <Drawer
      open
      title={transfer ? `Transfert ${transfer.number}` : 'Transfert'}
      size={680}
      onClose={onClose}
      footer={
        transfer &&
        canTransfer && (
          <div className="flex flex-wrap justify-end gap-2">
            {transfer.status === 'draft' && (
              <>
                <Popconfirm title="Annuler ce transfert ?" okText="Annuler le transfert" okButtonProps={{ danger: true }} cancelText="Non" onConfirm={() => action.mutate('cancel')}>
                  <Button danger loading={action.isPending && action.variables === 'cancel'}>
                    Annuler le transfert
                  </Button>
                </Popconfirm>
                {inMyShops(transfer.fromShopId) && (
                  <Popconfirm title="Expédier maintenant ?" description="Le stock sort de la boutique de départ." okText="Expédier" cancelText="Non" onConfirm={() => action.mutate('ship')}>
                    <Button type="primary" loading={action.isPending && action.variables === 'ship'}>
                      Expédier
                    </Button>
                  </Popconfirm>
                )}
              </>
            )}
            {transfer.status === 'shipped' &&
              inMyShops(transfer.toShopId) &&
              (receiving ? (
                <>
                  <Button onClick={() => setReceiving(false)}>Retour</Button>
                  <Button type="primary" onClick={() => action.mutate('receive')} loading={action.isPending}>
                    Confirmer la réception
                  </Button>
                </>
              ) : (
                <Button type="primary" onClick={() => setReceiving(true)}>
                  Réceptionner
                </Button>
              ))}
          </div>
        )
      }
    >
      {(error || action.error) && <Alert type="error" title={getErrorMessage(error ?? action.error)} showIcon className="mb-4" />}
      {!transfer ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Trajet">
              {shopName(transfer.fromShopId)} <ArrowRightOutlined className="mx-1 text-slate-400" /> {shopName(transfer.toShopId)}
            </Descriptions.Item>
            <Descriptions.Item label="État">{status && <Tag color={status.color}>{status.label}</Tag>}</Descriptions.Item>
            <Descriptions.Item label="Préparé le">{formatDateTime(transfer.createdAt)}</Descriptions.Item>
            {transfer.shippedAt && <Descriptions.Item label="Expédié le">{formatDateTime(transfer.shippedAt)}</Descriptions.Item>}
            {transfer.receivedAt && <Descriptions.Item label="Reçu le">{formatDateTime(transfer.receivedAt)}</Descriptions.Item>}
            {transfer.notes && <Descriptions.Item label="Commentaire">{transfer.notes}</Descriptions.Item>}
          </Descriptions>

          {receiving && (
            <Alert type="info" showIcon title="Indiquez les quantités réellement reçues" description="Un écart avec la quantité envoyée est enregistré et visible dans le journal d’audit." />
          )}

          <Table<StockTransferLine>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={transfer.lines ?? []}
            columns={[
              { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
              { title: 'Envoyé', dataIndex: 'quantitySent', align: 'right', width: 110, render: (value: string) => formatQuantity(value) },
              {
                title: 'Reçu',
                key: 'received',
                align: 'right',
                width: 150,
                render: (_, line) =>
                  receiving ? (
                    <QuantityInput
                      size="small"
                      allowsDecimal
                      value={received[line.id] ?? line.quantitySent}
                      onChange={(value) => setReceived((current) => ({ ...current, [line.id]: value }))}
                      aria-label={`Quantité reçue de ${line.product.name}`}
                    />
                  ) : line.quantityReceived === null ? (
                    <Typography.Text type="secondary">—</Typography.Text>
                  ) : (
                    <span className={Number(line.quantityReceived) < Number(line.quantitySent) ? 'font-semibold text-red-600' : ''}>{formatQuantity(line.quantityReceived)}</span>
                  ),
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  )
}
