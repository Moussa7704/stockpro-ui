import { DeleteOutlined } from '@ant-design/icons'
import { Button, Table, Typography } from 'antd'
import { AmountInput } from '../../components/AmountInput'
import { Money } from '../../components/Money'
import { ProductPicker } from '../../components/ProductPicker'
import { QuantityInput } from '../../components/QuantityInput'
import { documentTotal, lineTotal, type PricedLine } from './pricedLines'

interface PricedLinesEditorProps {
  lines: PricedLine[]
  onChange: (lines: PricedLine[]) => void
  /** false : coût facultatif (retour fournisseur : sinon coût moyen du stock) */
  costRequired?: boolean
  /** false : lignes figées (réception d'une commande : on ne fait qu'ajuster les quantités) */
  allowAdd?: boolean
  quantityLabel?: string
}

/** Lignes chiffrées (produit, quantité, coût unitaire) des commandes, réceptions et retours. */
export function PricedLinesEditor({ lines, onChange, costRequired = true, allowAdd = true, quantityLabel = 'Quantité' }: PricedLinesEditorProps) {
  const update = (productId: string, patch: Partial<PricedLine>) =>
    onChange(lines.map((line) => (line.product.id === productId ? { ...line, ...patch } : line)))

  return (
    <div className="flex flex-col gap-3">
      {allowAdd && (
        <ProductPicker
          excludeIds={lines.map((line) => line.product.id)}
          onPick={(product) =>
            onChange([
              ...lines,
              {
                product: { id: product.id, sku: product.sku, name: product.name, unit: product.unit },
                quantity: null,
                // Proposé : le prix d'achat indicatif du produit
                unitCost: product.purchasePriceHint,
              },
            ])
          }
        />
      )}
      <Table<PricedLine>
        rowKey={(line) => line.product.id}
        dataSource={lines}
        pagination={false}
        size="small"
        locale={{ emptyText: 'Ajoutez les produits (recherche ou douchette)' }}
        summary={() =>
          lines.length > 0 && (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Typography.Text strong>Total</Typography.Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Money value={documentTotal(lines)} className="font-semibold" />
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          )
        }
        columns={[
          {
            title: 'Produit',
            key: 'product',
            render: (_, line) => (
              <div className="flex flex-col">
                <Typography.Text>{line.product.name}</Typography.Text>
                <Typography.Text type="secondary" className="text-xs">
                  {line.product.sku}
                  {line.remaining !== undefined && ` · reste à recevoir : ${Number(line.remaining)}`}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: quantityLabel,
            key: 'quantity',
            width: 150,
            render: (_, line) => (
              <QuantityInput
                size="small"
                value={line.quantity}
                onChange={(quantity) => update(line.product.id, { quantity })}
                allowsDecimal={line.product.unit?.allowsDecimal ?? true}
                unitSymbol={line.product.unit?.symbol}
                aria-label={`${quantityLabel} de ${line.product.name}`}
              />
            ),
          },
          {
            title: costRequired ? 'Coût unitaire' : 'Coût unitaire (facultatif)',
            key: 'unitCost',
            width: 170,
            render: (_, line) => (
              <AmountInput
                size="small"
                value={line.unitCost}
                onChange={(unitCost) => update(line.product.id, { unitCost })}
                placeholder={costRequired ? undefined : 'coût moyen'}
                aria-label={`Coût unitaire de ${line.product.name}`}
              />
            ),
          },
          { title: 'Total', key: 'total', width: 140, align: 'right', render: (_, line) => (lineTotal(line) === null ? '—' : <Money value={lineTotal(line)} />) },
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
                onClick={() => onChange(lines.filter((item) => item.product.id !== line.product.id))}
                aria-label={`Retirer ${line.product.name}`}
              />
            ),
          },
        ]}
      />
    </div>
  )
}
