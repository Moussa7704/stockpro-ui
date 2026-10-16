import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Badge, Button, Card, Descriptions, Popconfirm, Skeleton, Table, Tag, Typography } from 'antd'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ProductPicker } from '../../components/ProductPicker'
import { QuantityInput } from '../../components/QuantityInput'
import { INVENTORY_STATUS } from '../../constants/stock'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as stockService from '../../services/stock.service'
import type { Product } from '../../types/catalog'
import type { InventoryLine, ProductRef } from '../../types/stock'
import { formatDateTime, formatQuantity } from '../../utils/format'
import { useShopName } from './queries'

interface CountRow {
  product: ProductRef
  counted: string | null
  // Connus seulement pour les produits ajoutés pendant cette saisie
  allowsDecimal?: boolean
  unit?: string
  saved: string | null // quantité enregistrée côté serveur (null : pas encore enregistrée)
}

const isDirty = (row: CountRow) => row.counted !== null && (row.saved === null || Number(row.counted) !== Number(row.saved))

/** Écart compté − théorique, en texte signé : "+2", "−1,5", "0". */
function gap(line: InventoryLine): { text: string; value: number } {
  const value = Number(line.countedQuantity) - Number(line.expectedQuantity ?? 0)
  const rounded = Math.round(value * 1000) / 1000
  const text = rounded === 0 ? '0' : `${rounded > 0 ? '+' : '−'}${formatQuantity(String(Math.abs(rounded)))}`
  return { text, value: rounded }
}

/** Inventaire : comptage produit par produit (douchette), puis validation qui corrige les écarts. */
export function InventoryPage() {
  const { id = '' } = useParams()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canAdjust = usePermission('stock.adjust')
  const shopName = useShopName()
  // Saisie en cours : par produit, la quantité comptée (fusionnée avec les lignes enregistrées)
  const [edits, setEdits] = useState<Record<string, Omit<CountRow, 'saved'>>>({})

  const { data: inventory, error } = useQuery({
    queryKey: queryKeys.stock.inventory(id),
    queryFn: async () => (await stockService.getInventory(id)).inventory,
  })

  const savedLines = inventory?.lines ?? []
  const rows: CountRow[] = [
    ...savedLines.map((line): CountRow => {
      const edit = edits[line.productId] as Omit<CountRow, 'saved'> | undefined
      return {
        product: line.product,
        counted: edit ? edit.counted : line.countedQuantity,
        allowsDecimal: edit?.allowsDecimal,
        unit: edit?.unit,
        saved: line.countedQuantity,
      }
    }),
    ...Object.values(edits)
      .filter((edit) => !savedLines.some((line) => line.productId === edit.product.id))
      .map((edit) => ({ ...edit, saved: null })),
  ]
  const dirtyRows = rows.filter(isDirty)

  function addProduct(product: Product) {
    const existing = rows.find((row) => row.product.id === product.id)
    // Douchette : chaque passage d'un article ajoute 1 ; au poids (kg…), on saisit la quantité
    const next = existing
      ? product.unit.allowsDecimal
        ? existing.counted
        : String(Number(existing.counted ?? 0) + 1)
      : product.unit.allowsDecimal
        ? null
        : '1'
    setEdits((current) => ({
      ...current,
      [product.id]: { product: { id: product.id, sku: product.sku, name: product.name }, counted: next, allowsDecimal: product.unit.allowsDecimal, unit: product.unit.symbol },
    }))
    if (existing && !product.unit.allowsDecimal) message.info(`${product.name} : ${next}`)
  }

  const refresh = (inventoryUpdate?: Awaited<ReturnType<typeof stockService.getInventory>>['inventory']) => {
    if (inventoryUpdate) queryClient.setQueryData(queryKeys.stock.inventory(id), inventoryUpdate)
    void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
  }

  const saveLines = async () => {
    if (dirtyRows.length === 0) return
    const { inventory: updated } = await stockService.setInventoryLines(
      id,
      dirtyRows.map((row) => ({ productId: row.product.id, countedQuantity: row.counted! })),
    )
    setEdits({})
    refresh(updated)
  }

  const save = useMutation({
    mutationFn: saveLines,
    onSuccess: () => message.success('Comptage enregistré'),
  })

  const validate = useMutation({
    mutationFn: async () => {
      // Les quantités saisies mais pas encore enregistrées partent d'abord
      await saveLines()
      return stockService.validateInventory(id)
    },
    onSuccess: ({ inventory: validated }) => {
      refresh(validated)
      message.success(`Inventaire ${validated.number} validé : les écarts ont été corrigés`)
    },
  })

  const cancel = useMutation({
    mutationFn: () => stockService.cancelInventory(id),
    onSuccess: ({ inventory: cancelled }) => {
      setEdits({})
      refresh(cancelled)
      message.success(`Inventaire ${cancelled.number} annulé`)
    },
  })

  if (error) return <Alert type="error" title={getErrorMessage(error)} showIcon />
  if (!inventory) return <Skeleton active />

  const status = INVENTORY_STATUS[inventory.status]
  const isDraft = inventory.status === 'draft' && canAdjust
  const mutationError = save.error ?? validate.error ?? cancel.error

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/stock/inventories">
            <Button icon={<ArrowLeftOutlined />} aria-label="Retour aux inventaires" />
          </Link>
          <Typography.Title level={2} className="mb-0">
            Inventaire {inventory.number}
          </Typography.Title>
          <Tag color={status.color}>{status.label}</Tag>
        </div>
        {isDraft && (
          <div className="flex flex-wrap gap-2">
            <Popconfirm title="Annuler cet inventaire ?" description="Le comptage saisi sera abandonné." okText="Annuler l’inventaire" okButtonProps={{ danger: true }} cancelText="Non" onConfirm={() => cancel.mutate()}>
              <Button danger loading={cancel.isPending}>
                Annuler l’inventaire
              </Button>
            </Popconfirm>
            <Badge count={dirtyRows.length} size="small">
              <Button icon={<SaveOutlined />} onClick={() => save.mutate()} disabled={dirtyRows.length === 0} loading={save.isPending}>
                Enregistrer le comptage
              </Button>
            </Badge>
            <Popconfirm
              title="Valider l’inventaire ?"
              description="Le stock de chaque produit compté sera remplacé par la quantité comptée."
              okText="Valider"
              cancelText="Non"
              disabled={rows.length === 0}
              onConfirm={() => validate.mutate()}
            >
              <Button type="primary" disabled={rows.length === 0} loading={validate.isPending}>
                Valider l’inventaire
              </Button>
            </Popconfirm>
          </div>
        )}
      </div>

      <Descriptions size="small" column={{ xs: 1, md: 3 }} bordered>
        <Descriptions.Item label="Boutique">{shopName(inventory.shopId)}</Descriptions.Item>
        <Descriptions.Item label="Ouvert le">{formatDateTime(inventory.createdAt)}</Descriptions.Item>
        {inventory.validatedAt && <Descriptions.Item label="Validé le">{formatDateTime(inventory.validatedAt)}</Descriptions.Item>}
        {inventory.notes && <Descriptions.Item label="Commentaire">{inventory.notes}</Descriptions.Item>}
      </Descriptions>

      {mutationError && <Alert type="error" title={getErrorMessage(mutationError)} showIcon />}

      {isDraft ? (
        <Card title="Comptage" extra={<Typography.Text type="secondary">Scannez chaque article : un passage = +1</Typography.Text>}>
          <div className="mb-4 max-w-xl">
            <ProductPicker onPick={addProduct} autoFocus placeholder="Scanner ou rechercher un produit à compter…" />
          </div>
          <Table<CountRow>
            rowKey={(row) => row.product.id}
            size="small"
            pagination={false}
            dataSource={rows}
            locale={{ emptyText: 'Aucun produit compté pour l’instant' }}
            columns={[
              {
                title: 'Produit',
                key: 'product',
                render: (_, row) => (
                  <div className="flex flex-col">
                    <Typography.Text>{row.product.name}</Typography.Text>
                    <Typography.Text type="secondary" className="text-xs">
                      {row.product.sku}
                    </Typography.Text>
                  </div>
                ),
              },
              {
                title: 'Quantité comptée',
                key: 'counted',
                width: 200,
                render: (_, row) => (
                  <QuantityInput
                    size="small"
                    value={row.counted}
                    allowsDecimal={row.allowsDecimal ?? true}
                    unitSymbol={row.unit}
                    onChange={(counted) =>
                      setEdits((current) => ({ ...current, [row.product.id]: { ...(current[row.product.id] ?? { product: row.product }), counted } }))
                    }
                    aria-label={`Quantité comptée de ${row.product.name}`}
                  />
                ),
              },
              {
                title: '',
                key: 'state',
                width: 140,
                render: (_, row) => (isDirty(row) ? <Tag color="orange">à enregistrer</Tag> : <Tag color="green">enregistré</Tag>),
              },
            ]}
          />
        </Card>
      ) : (
        <Card title={inventory.status === 'validated' ? 'Résultat' : 'Comptage'} styles={{ body: { padding: 0 } }}>
          <Table<InventoryLine>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={savedLines}
            columns={[
              { title: 'Produit', key: 'product', render: (_, line) => line.product.name },
              { title: 'Théorique', dataIndex: 'expectedQuantity', align: 'right', render: (value: string | null) => (value === null ? '—' : formatQuantity(value)) },
              { title: 'Compté', dataIndex: 'countedQuantity', align: 'right', render: (value: string) => formatQuantity(value) },
              ...(inventory.status === 'validated'
                ? [
                    {
                      title: 'Écart',
                      key: 'gap',
                      align: 'right' as const,
                      render: (_: unknown, line: InventoryLine) => {
                        const { text, value } = gap(line)
                        return <span className={`font-semibold tabular-nums ${value < 0 ? 'text-red-600' : value > 0 ? 'text-green-700' : ''}`}>{text}</span>
                      },
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      )}
    </div>
  )
}
