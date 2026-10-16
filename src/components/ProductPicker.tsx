import { BarcodeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { App, Select, type RefSelectProps } from 'antd'
import { useState, type Ref } from 'react'
import { useDebouncedValue } from '../hook/useDebouncedValue'
import { queryKeys } from '../lib/queryKeys'
import { ApiError, getErrorMessage } from '../services/api'
import * as catalogService from '../services/catalog.service'
import type { Product } from '../types/catalog'

interface ProductPickerProps {
  /** Appelé avec le produit choisi ; le champ se vide aussitôt, prêt pour le suivant. */
  onPick: (product: Product) => void
  /** Produits déjà dans le document : grisés dans la liste */
  excludeIds?: string[]
  placeholder?: string
  autoFocus?: boolean
  /** Pour redonner le focus au champ (caisse : après chaque action, raccourci F2) */
  selectRef?: Ref<RefSelectProps>
  size?: 'small' | 'middle' | 'large'
}

// Un code scanné ou saisi : sans espace, au moins 4 caractères
const CODE_PATTERN = /^[0-9A-Za-z._-]{4,64}$/

/**
 * Ajout d'un produit à un document (ajustement, transfert, inventaire, achat, vente) :
 * - recherche par nom, référence ou code-barres dans la liste ;
 * - douchette : le code suivi d'« Entrée » ajoute directement le produit (code-barres, puis SKU).
 */
export function ProductPicker({ onPick, excludeIds = [], placeholder, autoFocus, selectRef, size }: ProductPickerProps) {
  const { message } = App.useApp()
  const [term, setTerm] = useState('')
  const [looking, setLooking] = useState(false)
  const search = useDebouncedValue(term.trim(), 250)

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.products.list({ search, status: 'active', page: 1, pageSize: 20, picker: true }),
    queryFn: () => catalogService.listProducts({ page: 1, pageSize: 20, search: search || undefined, status: 'active' }),
    enabled: search.length > 0,
  })
  const results = search ? (data?.items ?? []) : []

  function pick(product: Product) {
    setTerm('')
    onPick(product)
  }

  /** Code exact : code-barres d'abord, puis référence (SKU). */
  async function lookup(code: string): Promise<Product | null> {
    for (const by of [{ barcode: code }, { sku: code.toUpperCase() }]) {
      try {
        return (await catalogService.lookupProduct(by)).product
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err
      }
    }
    return null
  }

  async function handleKeyDown(event: React.KeyboardEvent) {
    const code = term.trim()
    if (event.key !== 'Enter' || !CODE_PATTERN.test(code)) return
    // La douchette envoie « Entrée » : on cherche le code exact au lieu de la ligne surlignée
    event.preventDefault()
    event.stopPropagation()
    setLooking(true)
    try {
      const product = await lookup(code)
      if (product?.status === 'active') pick(product)
      else if (results.length === 1) pick(results[0]!)
      else message.warning(`Aucun produit pour le code « ${code} »`)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLooking(false)
    }
  }

  return (
    <Select<string>
      ref={selectRef}
      size={size}
      showSearch={{ filterOption: false, onSearch: setTerm, searchValue: term }}
      value={null}
      autoFocus={autoFocus}
      placeholder={placeholder ?? 'Rechercher ou scanner un produit…'}
      suffixIcon={<BarcodeOutlined />}
      loading={isFetching || looking}
      notFoundContent={search ? (isFetching ? 'Recherche…' : 'Aucun produit') : 'Tapez un nom, une référence ou scannez'}
      onInputKeyDown={(event) => void handleKeyDown(event)}
      onSelect={(id) => {
        const product = results.find((item) => item.id === id)
        if (product) pick(product)
      }}
      options={results.map((product) => ({
        value: product.id,
        disabled: excludeIds.includes(product.id),
        label: (
          <div className="flex justify-between gap-3">
            <span className="truncate">{product.name}</span>
            <span className="shrink-0 text-xs text-slate-500">{product.sku}</span>
          </div>
        ),
      }))}
      className="w-full"
      aria-label="Ajouter un produit"
    />
  )
}
