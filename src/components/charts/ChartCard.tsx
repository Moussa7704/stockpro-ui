import { BarChartOutlined, TableOutlined } from '@ant-design/icons'
import { Card, Empty, Segmented, Table } from 'antd'
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { chartTheme } from './chartTheme'

export interface ChartDatum {
  label: string
  value: number
  /** Valeur mise en forme (ex. "15 000 FCFA") pour l'infobulle et le tableau */
  display: string
}

interface ChartCardProps {
  title: string
  data: ChartDatum[]
  /** Colonnes verticales (évolution dans le temps) ou barres horizontales (catégories, noms longs) */
  orientation?: 'columns' | 'bars'
  valueLabel: string
  emptyText?: string
  height?: number
  extra?: ReactNode
}

/** Axe des montants abrégé : 1 500 000 → "1,5 M", 25 000 → "25 k". */
function compact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000) return `${(value / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k`
  return value.toLocaleString('fr-FR')
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  const datum = active ? (payload?.[0]?.payload as ChartDatum | undefined) : undefined
  if (!datum) return null
  return (
    <div className="rounded-md border px-3 py-2 text-sm shadow-sm" style={{ background: chartTheme.tooltipBackground, borderColor: chartTheme.tooltipBorder }}>
      <div className="text-slate-500">{datum.label}</div>
      <div className="font-semibold tabular-nums">{datum.display}</div>
    </div>
  )
}

/**
 * Graphique à une seule série, avec sa vue tableau (lecture sans couleurs, lecteurs d'écran).
 * Marques fines aux extrémités arrondies, grille en filet, infobulle au survol de chaque barre.
 */
export function ChartCard({ title, data, orientation = 'columns', valueLabel, emptyText = 'Aucune donnée', height = 260, extra }: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const horizontal = orientation === 'bars'
  const chartHeight = horizontal ? Math.max(120, data.length * 36 + 40) : height
  const summary = `${title} : ${data.map((datum) => `${datum.label} ${datum.display}`).join(', ')}`

  return (
    <Card
      size="small"
      title={title}
      extra={
        <div className="flex items-center gap-2">
          {extra}
          <Segmented<'chart' | 'table'>
            size="small"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', icon: <BarChartOutlined />, title: 'Graphique' },
              { value: 'table', icon: <TableOutlined />, title: 'Tableau' },
            ]}
            aria-label={`Affichage de « ${title} »`}
          />
        </div>
      }
    >
      {data.length === 0 ? (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : view === 'table' ? (
        <Table<ChartDatum>
          rowKey="label"
          size="small"
          pagination={false}
          dataSource={data}
          columns={[
            { title: horizontal ? 'Libellé' : 'Période', dataIndex: 'label' },
            { title: valueLabel, dataIndex: 'display', align: 'right', render: (value: string) => <span className="tabular-nums">{value}</span> },
          ]}
        />
      ) : (
        <div role="img" aria-label={summary} style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid stroke={chartTheme.grid} strokeWidth={1} vertical={horizontal} horizontal={!horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" tickFormatter={compact} tick={{ fill: chartTheme.axisText, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" width={140} tick={{ fill: chartTheme.axisText, fontSize: 12 }} axisLine={false} tickLine={false} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" tick={{ fill: chartTheme.axisText, fontSize: 12 }} axisLine={{ stroke: chartTheme.grid }} tickLine={false} />
                  <YAxis tickFormatter={compact} width={48} tick={{ fill: chartTheme.axisText, fontSize: 12 }} axisLine={false} tickLine={false} />
                </>
              )}
              <Tooltip content={ChartTooltip} cursor={{ fill: chartTheme.grid, opacity: 0.6 }} />
              <Bar
                dataKey="value"
                fill={chartTheme.series1}
                // Pas d'animation d'entrée : affichage immédiat, rien qui bouge pour rien
                isAnimationActive={false}
                activeBar={{ fill: chartTheme.series1Hover }}
                maxBarSize={horizontal ? 18 : 32}
                // Extrémités de données arrondies (4 px), ancrées sur la ligne de base
                radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
