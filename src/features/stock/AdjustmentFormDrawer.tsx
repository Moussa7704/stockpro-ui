import { DeleteOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Drawer, Form, Input, Segmented, Select, Table, Typography } from 'antd'
import { useState } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { ProductPicker } from '../../components/ProductPicker'
import { QuantityInput } from '../../components/QuantityInput'
import { ADJUSTMENT_REASON_LABELS, ENTRY_REASONS, EXIT_REASONS } from '../../constants/stock'
import { useActiveShop } from '../../hook/useActiveShop'
import { getErrorMessage } from '../../services/api'
import * as stockService from '../../services/stock.service'
import type { Product } from '../../types/catalog'
import { ADJUSTMENT_REASONS, type AdjustmentReason, type StockAdjustment } from '../../types/stock'

interface Line {
  product: Product
  direction: 'in' | 'out'
  quantity: string | null
  unitCost: string | null
}

const defaultDirection = (reason: AdjustmentReason): 'in' | 'out' => (EXIT_REASONS.includes(reason) ? 'out' : 'in')

/** Nouvel ajustement : pièce justificative (motif, lignes), numérotée par le serveur. */
export function AdjustmentFormDrawer({ onClose, onSaved }: { onClose: () => void; onSaved: (adjustment: StockAdjustment) => void }) {
  const { shops, activeShop } = useActiveShop()
  const [shopId, setShopId] = useState<string | undefined>(activeShop?.id)
  const [reason, setReason] = useState<AdjustmentReason>('opening_balance')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  const updateLine = (productId: string, patch: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.product.id === productId ? { ...line, ...patch } : line)))

  function changeReason(next: AdjustmentReason) {
    setReason(next)
    // Le sens suit le motif (perte → sortie, stock initial → entrée) ; correction et autre : au choix
    if (ENTRY_REASONS.includes(next) || EXIT_REASONS.includes(next)) {
      setLines((current) => current.map((line) => ({ ...line, direction: defaultDirection(next) })))
    }
  }

  const save = useMutation({
    mutationFn: () =>
      stockService.createAdjustment({
        shopId: shopId!,
        reason,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.direction === 'out' ? `-${line.quantity}` : line.quantity!,
          ...(line.direction === 'in' && line.unitCost ? { unitCost: line.unitCost } : {}),
        })),
      }),
    onSuccess: ({ adjustment }) => onSaved(adjustment),
  })

  function submit() {
    setFormError(null)
    if (!shopId) return setFormError('Choisissez la boutique concernée')
    if (lines.length === 0) return setFormError('Ajoutez au moins un produit')
    if (lines.some((line) => !line.quantity || Number(line.quantity) <= 0)) return setFormError('Chaque ligne doit avoir une quantité positive')
    save.mutate()
  }

  const fixedDirection = ENTRY_REASONS.includes(reason) || EXIT_REASONS.includes(reason)

  return (
    <Drawer
      open
      title="Nouvel ajustement de stock"
      size={760}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="primary" onClick={submit} loading={save.isPending}>
            Enregistrer l’ajustement
          </Button>
        </div>
      }
    >
      <Form layout="vertical" requiredMark={false} component="div">
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item label="Boutique">
            <Select value={shopId} onChange={setShopId} options={shops.map((shop) => ({ value: shop.id, label: shop.name }))} aria-label="Boutique" />
          </Form.Item>
          <Form.Item label="Motif">
            <Select<AdjustmentReason>
              value={reason}
              onChange={changeReason}
              options={ADJUSTMENT_REASONS.map((value) => ({ value, label: ADJUSTMENT_REASON_LABELS[value] }))}
              aria-label="Motif"
            />
          </Form.Item>
        </div>
        <Form.Item label="Produits">
          <ProductPicker
            excludeIds={lines.map((line) => line.product.id)}
            onPick={(product) =>
              setLines((current) => [...current, { product, direction: defaultDirection(reason), quantity: null, unitCost: product.purchasePriceHint }])
            }
          />
        </Form.Item>
      </Form>

      <Table<Line>
        rowKey={(line) => line.product.id}
        dataSource={lines}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Ajoutez les produits concernés (recherche ou douchette)' }}
        columns={[
          {
            title: 'Produit',
            key: 'product',
            render: (_, line) => (
              <div className="flex flex-col">
                <Typography.Text>{line.product.name}</Typography.Text>
                <Typography.Text type="secondary" className="text-xs">
                  {line.product.sku}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: 'Sens',
            key: 'direction',
            width: 170,
            render: (_, line) => (
              <Segmented<'in' | 'out'>
                size="small"
                value={line.direction}
                disabled={fixedDirection}
                onChange={(direction) => updateLine(line.product.id, { direction })}
                options={[
                  { value: 'in', label: 'Entrée' },
                  { value: 'out', label: 'Sortie' },
                ]}
                aria-label={`Sens pour ${line.product.name}`}
              />
            ),
          },
          {
            title: 'Quantité',
            key: 'quantity',
            width: 140,
            render: (_, line) => (
              <QuantityInput
                size="small"
                value={line.quantity}
                onChange={(quantity) => updateLine(line.product.id, { quantity })}
                allowsDecimal={line.product.unit.allowsDecimal}
                unitSymbol={line.product.unit.symbol}
                aria-label={`Quantité de ${line.product.name}`}
              />
            ),
          },
          {
            title: 'Coût unitaire',
            key: 'unitCost',
            width: 160,
            render: (_, line) =>
              line.direction === 'in' ? (
                <AmountInput size="small" value={line.unitCost} onChange={(unitCost) => updateLine(line.product.id, { unitCost })} aria-label={`Coût unitaire de ${line.product.name}`} />
              ) : (
                <Typography.Text type="secondary">coût moyen</Typography.Text>
              ),
          },
          {
            title: '',
            key: 'remove',
            width: 44,
            render: (_, line) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => setLines((current) => current.filter((item) => item.product.id !== line.product.id))}
                aria-label={`Retirer ${line.product.name}`}
              />
            ),
          },
        ]}
      />

      <Typography.Paragraph type="secondary" className="mt-2 text-xs">
        Une entrée avec un coût unitaire met à jour le coût moyen du produit. Une sortie est valorisée au coût moyen actuel.
      </Typography.Paragraph>

      <Input.TextArea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Commentaire (facultatif)" maxLength={2000} className="mt-2" aria-label="Commentaire" />

      {(formError || save.error) && <Alert type="error" title={formError ?? getErrorMessage(save.error)} showIcon className="mt-4" />}
    </Drawer>
  )
}
