import { DatabaseOutlined, EditOutlined, InboxOutlined, PlusOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Input, Popconfirm, Segmented, Space, Table, Tag, Tooltip, TreeSelect, Typography } from 'antd'
import type { TableColumnsType, TableProps } from 'antd'
import { useMemo, useState } from 'react'
import { Money } from '../../components/Money'
import { useDebouncedValue } from '../../hook/useDebouncedValue'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as catalogService from '../../services/catalog.service'
import type { Product, ProductSortField, ProductStatus } from '../../types/catalog'
import { formatQuantity } from '../../utils/format'
import { buildCategoryTree, toTreeSelectData } from './categoryTree'
import { ProductStockDrawer } from '../stock/ProductStockDrawer'
import { ProductFormModal } from './ProductFormModal'
import { useCategories, useProducts } from './queries'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: ProductStatus | 'all'; label: string }[] = [
  { value: 'active', label: 'Actifs' },
  { value: 'archived', label: 'Archivés' },
  { value: 'all', label: 'Tous' },
]

/**
 * Catalogue des produits : recherche par nom, référence ou code-barres (scan possible dans la
 * barre de recherche), filtres et tri côté serveur. Consultation avec products.view.
 */
export function ProductsPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canManage = usePermission('products.manage')
  const canViewStock = usePermission('stock.view')
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  // Le prix d'achat révèle la marge : affiché à ceux qui gèrent le catalogue ou les comptes
  const canSeePurchasePrice = usePermission('reports.view') || canManage

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [status, setStatus] = useState<ProductStatus | 'all'>('active')
  const [sort, setSort] = useState<{ field: ProductSortField; order: 'asc' | 'desc' }>({ field: 'name', order: 'asc' })
  const [page, setPage] = useState(1)
  const [formProduct, setFormProduct] = useState<Product | null | undefined>(undefined)
  const debouncedSearch = useDebouncedValue(search.trim())

  const { data: categories = [] } = useCategories()
  const categoryTree = useMemo(() => toTreeSelectData(buildCategoryTree(categories)), [categories])
  const { data, isFetching, error } = useProducts({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    categoryId,
    status,
    sort: sort.field,
    order: sort.order,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.products.all })

  const archive = useMutation({
    mutationFn: ({ product, archived }: { product: Product; archived: boolean }) =>
      catalogService.updateProduct(product.id, { status: archived ? 'archived' : 'active' }),
    onSuccess: ({ product }, { archived }) => {
      void refresh()
      message.success(archived ? `« ${product.name} » archivé` : `« ${product.name} » remis en vente`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  const handleTableChange: TableProps<Product>['onChange'] = (_pagination, _filters, sorter) => {
    const single = Array.isArray(sorter) ? sorter[0] : sorter
    if (single?.order && single.columnKey) {
      setSort({ field: single.columnKey as ProductSortField, order: single.order === 'descend' ? 'desc' : 'asc' })
    } else {
      setSort({ field: 'name', order: 'asc' })
    }
    setPage(1)
  }

  const sortOrder = (field: ProductSortField) => (sort.field === field ? (sort.order === 'asc' ? 'ascend' : 'descend') : null)

  const columns: TableColumnsType<Product> = [
    {
      title: 'Produit',
      key: 'name',
      sorter: true,
      sortOrder: sortOrder('name'),
      render: (_, product) => (
        <div className="flex flex-col">
          <Space size={6}>
            <Typography.Text strong>{product.name}</Typography.Text>
            {product.status === 'archived' && <Tag>Archivé</Tag>}
          </Space>
          <Typography.Text type="secondary" className="text-xs">
            {product.sku}
            {product.barcode && ` · ${product.barcode}`}
          </Typography.Text>
        </div>
      ),
    },
    { title: 'Catégorie', key: 'category', responsive: ['md'], render: (_, product) => product.category?.name ?? '—' },
    { title: 'Unité', key: 'unit', width: 90, responsive: ['lg'], render: (_, product) => product.unit.symbol },
    {
      title: 'Prix de vente',
      key: 'salePrice',
      align: 'right',
      width: 150,
      sorter: true,
      sortOrder: sortOrder('salePrice'),
      render: (_, product) => <Money value={product.salePrice} />,
    },
    ...(canSeePurchasePrice
      ? [
          {
            title: 'Prix d’achat ind.',
            key: 'purchasePriceHint',
            align: 'right' as const,
            width: 150,
            responsive: ['lg' as const],
            render: (_: unknown, product: Product) =>
              product.purchasePriceHint ? <Money value={product.purchasePriceHint} className="text-slate-500" /> : '—',
          },
        ]
      : []),
    {
      title: 'Seuil d’alerte',
      key: 'alertThreshold',
      align: 'right',
      width: 120,
      responsive: ['xl'],
      render: (_, product) => (Number(product.alertThreshold) > 0 ? `${formatQuantity(product.alertThreshold)} ${product.unit.symbol}` : '—'),
    },
    ...(canManage || canViewStock
      ? [
          {
            title: '',
            key: 'actions',
            width: canManage && canViewStock ? 130 : 100,
            render: (_: unknown, product: Product) => {
              const archived = product.status === 'archived'
              return (
                <Space size={4}>
                  {canViewStock && (
                    <Tooltip title="Stock par boutique">
                      <Button icon={<DatabaseOutlined />} size="small" onClick={() => setStockProduct(product)} aria-label={`Stock de ${product.name} par boutique`} />
                    </Tooltip>
                  )}
                  {canManage && (
                    <>
                      <Tooltip title="Modifier">
                        <Button icon={<EditOutlined />} size="small" onClick={() => setFormProduct(product)} aria-label={`Modifier ${product.name}`} />
                      </Tooltip>
                      <Popconfirm
                        title={archived ? `Remettre « ${product.name} » en vente ?` : `Archiver « ${product.name} » ?`}
                        description={archived ? undefined : 'Il ne sera plus vendu ni commandé. Son historique est conservé.'}
                        okText={archived ? 'Remettre en vente' : 'Archiver'}
                        cancelText="Annuler"
                        onConfirm={() => archive.mutate({ product, archived: !archived })}
                      >
                        <Button
                          icon={archived ? <UndoOutlined /> : <InboxOutlined />}
                          size="small"
                          aria-label={archived ? `Remettre en vente ${product.name}` : `Archiver ${product.name}`}
                        />
                      </Popconfirm>
                    </>
                  )}
                </Space>
              )
            },
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Produits
        </Typography.Title>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormProduct(null)}>
            Nouveau produit
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Nom, référence ou code-barres…"
          value={search}
          onChange={(event) => resetPage(setSearch)(event.target.value)}
          className="max-w-sm"
          aria-label="Rechercher un produit"
        />
        <TreeSelect
          allowClear
          treeDefaultExpandAll
          showSearch={{ treeNodeFilterProp: 'title' }}
          treeData={categoryTree}
          value={categoryId}
          onChange={resetPage(setCategoryId)}
          placeholder="Toutes les catégories"
          className="w-56"
          aria-label="Filtrer par catégorie"
        />
        <Segmented<ProductStatus | 'all'> options={STATUS_OPTIONS} value={status} onChange={resetPage(setStatus)} aria-label="Statut" />
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Product>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          onChange={handleTableChange}
          scroll={{ x: 760 }}
          rowClassName={(product) => (product.status === 'archived' ? 'opacity-60' : '')}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: data?.total ?? 0,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (total) => `${total} produit(s)`,
          }}
          locale={{ emptyText: debouncedSearch ? 'Aucun produit ne correspond' : 'Aucun produit' }}
        />
      </Card>

      {formProduct !== undefined && (
        <ProductFormModal
          key={formProduct?.id ?? 'new'}
          product={formProduct}
          onCancel={() => setFormProduct(undefined)}
          onSaved={(product, created) => {
            void refresh()
            setFormProduct(undefined)
            message.success(created ? `Produit « ${product.name} » créé` : `Produit « ${product.name} » mis à jour`)
          }}
        />
      )}
      {stockProduct && <ProductStockDrawer product={stockProduct} onClose={() => setStockProduct(null)} />}
    </div>
  )
}
