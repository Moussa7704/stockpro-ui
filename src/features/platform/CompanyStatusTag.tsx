import { CheckCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import { Tag } from 'antd'
import type { CompanyStatus } from '../../types/platform'

/** Statut d'un commerçant : icône + mot, jamais la couleur seule. */
export function CompanyStatusTag({ status }: { status: CompanyStatus }) {
  return status === 'active' ? (
    <Tag color="success" icon={<CheckCircleOutlined />}>
      Actif
    </Tag>
  ) : (
    <Tag color="error" icon={<PauseCircleOutlined />}>
      Suspendu
    </Tag>
  )
}
