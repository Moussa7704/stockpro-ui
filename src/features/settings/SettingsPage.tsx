import { Tabs, Typography } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { CompanySettingsTab } from './CompanySettingsTab'
import { PaymentMethodsTab } from './PaymentMethodsTab'
import { ShopsTab } from './ShopsTab'

const TABS = [
  { key: 'company', label: 'Entreprise', children: <CompanySettingsTab /> },
  { key: 'shops', label: 'Boutiques', children: <ShopsTab /> },
  { key: 'payment-methods', label: 'Moyens de paiement', children: <PaymentMethodsTab /> },
]

/** Paramètres de l'entreprise (permission company.manage). L'onglet ouvert est dans l'URL (?onglet=). */
export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('onglet')
  const activeKey = TABS.some((tab) => tab.key === requested) ? requested! : 'company'

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <Typography.Title level={2} className="mb-0">
        Paramètres
      </Typography.Title>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => setSearchParams({ onglet: key }, { replace: true })}
        items={TABS}
        destroyOnHidden
      />
    </div>
  )
}
