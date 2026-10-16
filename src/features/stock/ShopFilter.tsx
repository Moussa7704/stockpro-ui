import { ShopOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import { useShops } from '../../hook/useActiveShop'

/** Filtre "boutique" des écrans de stock : toutes les boutiques visibles, ou une seule. */
export function ShopFilter({ value, onChange }: { value: string | undefined; onChange: (shopId: string | undefined) => void }) {
  const { data: shops = [] } = useShops()
  if (shops.length < 2) return null
  return (
    <Select
      allowClear
      value={value}
      onChange={(shopId) => onChange(shopId ?? undefined)}
      placeholder="Toutes les boutiques"
      options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
      suffixIcon={<ShopOutlined />}
      className="w-52"
      aria-label="Filtrer par boutique"
    />
  )
}
