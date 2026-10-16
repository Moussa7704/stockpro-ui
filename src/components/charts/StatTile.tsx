import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { Card, Typography } from 'antd'
import type { ReactNode } from 'react'

interface StatTileProps {
  title: string
  value: ReactNode
  /** Variation par rapport à la période précédente, en % (null : pas de comparaison possible) */
  delta?: number | null
  deltaLabel?: string
  hint?: ReactNode
  /** Mise en garde (stock bas, résultat négatif…) : texte rouge, accompagné d'un libellé */
  tone?: 'default' | 'danger'
}

/**
 * Tuile de chiffre clé : le nombre EST le graphique. L'évolution est donnée par une flèche,
 * un signe et un texte (jamais par la couleur seule).
 */
export function StatTile({ title, value, delta, deltaLabel = 'vs hier', hint, tone = 'default' }: StatTileProps) {
  return (
    <Card size="small" className="h-full">
      <Typography.Text type="secondary" className="text-sm">
        {title}
      </Typography.Text>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-600' : ''}`}>{value}</div>
      {delta !== undefined && delta !== null && (
        <div className={`mt-1 flex items-center gap-1 text-xs ${delta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {delta >= 0 ? <ArrowUpOutlined aria-hidden /> : <ArrowDownOutlined aria-hidden />}
          <span>
            {delta >= 0 ? '+' : '−'}
            {Math.abs(delta).toFixed(0)} % {deltaLabel}
          </span>
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  )
}
