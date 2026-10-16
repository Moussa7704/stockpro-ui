import { StopOutlined, WarningOutlined } from '@ant-design/icons'
import { Tag } from 'antd'
import type { StockAlertStatus } from '../../types/stock'

/** État d'une alerte : icône + mot, la couleur n'est jamais le seul indice. */
export function StockAlertStatusTag({ status }: { status: StockAlertStatus }) {
  return status === 'out_of_stock' ? (
    <Tag color="error" icon={<StopOutlined />}>
      Rupture
    </Tag>
  ) : (
    <Tag color="warning" icon={<WarningOutlined />}>
      Stock bas
    </Tag>
  )
}
