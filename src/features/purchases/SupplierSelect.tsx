import { TruckOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import { useAllSuppliers } from './queries'

interface SupplierSelectProps {
  value?: string
  onChange?: (supplierId: string | undefined) => void
  /** true : filtre de liste (vide = tous) ; false : choix obligatoire dans un formulaire */
  allowClear?: boolean
  placeholder?: string
  className?: string
}

/** Choix d'un fournisseur actif (recherche par nom). S'utilise seul ou dans un Form.Item. */
export function SupplierSelect({ value, onChange, allowClear = false, placeholder = 'Choisir un fournisseur…', className }: SupplierSelectProps) {
  const { data: suppliers = [], isPending } = useAllSuppliers()
  return (
    <Select
      showSearch={{ optionFilterProp: 'label' }}
      allowClear={allowClear}
      value={value}
      onChange={(supplierId) => onChange?.(supplierId ?? undefined)}
      loading={isPending}
      placeholder={placeholder}
      suffixIcon={<TruckOutlined />}
      // Un fournisseur archivé reste affiché s'il est déjà choisi, mais n'est plus proposé
      options={suppliers.filter((supplier) => !supplier.archivedAt || supplier.id === value).map((supplier) => ({ value: supplier.id, label: supplier.name }))}
      notFoundContent="Aucun fournisseur : créez-le dans Catalogue › Fournisseurs"
      className={className ?? 'w-full'}
      aria-label={allowClear ? 'Filtrer par fournisseur' : 'Fournisseur'}
    />
  )
}
