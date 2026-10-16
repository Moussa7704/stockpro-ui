import { EditOutlined, InboxOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Popconfirm, Space, Switch, Table, Tag, Tooltip, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as shopsService from '../../services/shops.service'
import type { Shop } from '../../types/settings'
import { formatDate } from '../../utils/format'
import { useAllShops } from './queries'
import { ShopFormModal } from './ShopFormModal'

/**
 * Onglet "Boutiques" : une boutique n'est jamais supprimée (ses ventes et son stock restent
 * consultables) ; on l'archive, ce qui bloque ventes et mouvements, et on peut la rouvrir.
 */
export function ShopsTab() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { data: shops = [], isPending, error } = useAllShops()
  const [showArchived, setShowArchived] = useState(false)
  // undefined : fenêtre fermée ; null : création ; Shop : modification
  const [formShop, setFormShop] = useState<Shop | null | undefined>(undefined)

  // Le sélecteur de boutique de l'en-tête et les formulaires d'équipe lisent aussi cette liste
  const refreshShops = () => queryClient.invalidateQueries({ queryKey: queryKeys.shops.all })

  const archive = useMutation({
    mutationFn: ({ shop, archived }: { shop: Shop; archived: boolean }) => shopsService.updateShop(shop.id, { archived }),
    onSuccess: ({ shop }, { archived }) => {
      void refreshShops()
      message.success(archived ? `${shop.name} archivée` : `${shop.name} rouverte`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  function handleSaved(shop: Shop, created: boolean) {
    void refreshShops()
    setFormShop(undefined)
    message.success(created ? `Boutique « ${shop.name} » créée` : `Boutique « ${shop.name} » mise à jour`)
  }

  const visible = showArchived ? shops : shops.filter((shop) => !shop.archivedAt)
  const archivedCount = shops.filter((shop) => shop.archivedAt).length

  const columns: TableColumnsType<Shop> = [
    {
      title: 'Boutique',
      key: 'name',
      render: (_, shop) => (
        <div className="flex flex-col">
          <Typography.Text strong>{shop.name}</Typography.Text>
          {shop.address && (
            <Typography.Text type="secondary" className="text-xs">
              {shop.address}
            </Typography.Text>
          )}
        </div>
      ),
    },
    { title: 'Code', dataIndex: 'code', width: 100, render: (code: string) => <Tag>{code}</Tag> },
    { title: 'Téléphone', dataIndex: 'phone', width: 170, responsive: ['md'], render: (phone: string | null) => phone ?? '—' },
    {
      title: 'Statut',
      key: 'status',
      width: 170,
      render: (_, shop) =>
        shop.archivedAt ? <Tag>Archivée le {formatDate(shop.archivedAt)}</Tag> : <Tag color="green">Ouverte</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, shop) => (
        <Space size={4}>
          <Tooltip title="Modifier">
            <Button icon={<EditOutlined />} size="small" onClick={() => setFormShop(shop)} aria-label={`Modifier ${shop.name}`} />
          </Tooltip>
          <Popconfirm
            title={shop.archivedAt ? `Rouvrir ${shop.name} ?` : `Archiver ${shop.name} ?`}
            description={shop.archivedAt ? undefined : 'Plus aucune vente ni mouvement de stock dans cette boutique.'}
            okText={shop.archivedAt ? 'Rouvrir' : 'Archiver'}
            okButtonProps={{ danger: !shop.archivedAt }}
            cancelText="Annuler"
            onConfirm={() => archive.mutate({ shop, archived: !shop.archivedAt })}
          >
            <Tooltip title={shop.archivedAt ? 'Rouvrir' : 'Archiver'}>
              <Button
                icon={shop.archivedAt ? <UndoOutlined /> : <InboxOutlined />}
                size="small"
                loading={archive.isPending && archive.variables?.shop.id === shop.id}
                aria-label={shop.archivedAt ? `Rouvrir ${shop.name}` : `Archiver ${shop.name}`}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch size="small" checked={showArchived} onChange={setShowArchived} aria-label="Afficher les boutiques archivées" />
          Afficher les boutiques archivées {archivedCount > 0 && `(${archivedCount})`}
        </label>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormShop(null)}>
          Nouvelle boutique
        </Button>
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<Shop>
          rowKey="id"
          columns={columns}
          dataSource={visible}
          loading={isPending}
          pagination={false}
          scroll={{ x: 640 }}
          rowClassName={(shop) => (shop.archivedAt ? 'opacity-60' : '')}
        />
      </Card>

      {/* Monté seulement quand il est ouvert : chaque ouverture repart d'un formulaire propre */}
      {formShop !== undefined && (
        <ShopFormModal
          key={formShop?.id ?? 'new'}
          open
          shop={formShop}
          onCancel={() => setFormShop(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
