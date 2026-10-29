import { PlusOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Modal, Select, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { INVENTORY_STATUS } from '../../constants/stock'
import { useActiveShop, useShopFilter } from '../../hook/useActiveShop'
import { usePage } from '../../hook/usePage'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as stockService from '../../services/stock.service'
import type { InventoryCount, InventoryStatus } from '../../types/stock'
import { formatDateTime } from '../../utils/format'
import { useInventories, useShopName } from './queries'

const PAGE_SIZE = 20

function NewInventoryModal({ onCancel, onCreated }: { onCancel: () => void; onCreated: (inventory: InventoryCount) => void }) {
  const { shops, activeShop } = useActiveShop()
  const [form] = Form.useForm<{ shopId: string; notes: string }>()
  const create = useMutation({
    mutationFn: (values: { shopId: string; notes: string }) => stockService.createInventory({ shopId: values.shopId, notes: values.notes?.trim() || null }),
    onSuccess: ({ inventory }) => onCreated(inventory),
  })

  return (
    <Modal open title="Nouvel inventaire" okText="Commencer le comptage" cancelText="Annuler" onOk={() => form.submit()} onCancel={onCancel} confirmLoading={create.isPending}>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ shopId: activeShop?.id }} onFinish={(values) => create.mutate(values)} className="mt-4">
        <Form.Item name="shopId" label="Boutique" rules={[{ required: true, message: 'Choisissez la boutique' }]}>
          <Select options={shops.map((shop) => ({ value: shop.id, label: shop.name }))} aria-label="Boutique" />
        </Form.Item>
        <Form.Item name="notes" label="Commentaire" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} placeholder="Inventaire annuel, rayon boissons…" />
        </Form.Item>
        {create.error && <Alert type="error" title={getErrorMessage(create.error)} showIcon />}
      </Form>
    </Modal>
  )
}

/** Inventaires : comptage physique, puis validation qui aligne le stock sur ce qui a été compté. */
export function InventoriesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canAdjust = usePermission('stock.adjust')
  const shopName = useShopName()
  const shopId = useShopFilter()
  const [page, setPage] = usePage(shopId)
  const [creating, setCreating] = useState(false)
  const { data, isFetching, error } = useInventories({ page, pageSize: PAGE_SIZE, shopId })

  const columns: TableColumnsType<InventoryCount> = [
    { title: 'Numéro', dataIndex: 'number', render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
    { title: 'Ouvert le', dataIndex: 'createdAt', width: 150, responsive: ['md'], render: (value: string) => formatDateTime(value) },
    { title: 'Boutique', key: 'shop', width: 180, render: (_, inventory) => shopName(inventory.shopId) },
    { title: 'État', dataIndex: 'status', width: 190, render: (value: InventoryStatus) => <Tag color={INVENTORY_STATUS[value].color}>{INVENTORY_STATUS[value].label}</Tag> },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_, inventory) => (
        <Button size="small" type={inventory.status === 'draft' ? 'primary' : 'default'} onClick={() => navigate(`/stock/inventories/${inventory.id}`)} aria-label={`Ouvrir ${inventory.number}`}>
          {inventory.status === 'draft' && canAdjust ? 'Compter' : 'Ouvrir'}
        </Button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Inventaires
        </Typography.Title>
        {canAdjust && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Nouvel inventaire
          </Button>
        )}
      </div>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<InventoryCount>
          rowKey="id"
          columns={columns}
          dataSource={data?.items ?? []}
          loading={isFetching}
          scroll={{ x: 600 }}
          pagination={{ current: page, pageSize: PAGE_SIZE, total: data?.total ?? 0, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
          locale={{ emptyText: 'Aucun inventaire' }}
        />
      </Card>

      {creating && (
        <NewInventoryModal
          onCancel={() => setCreating(false)}
          onCreated={(inventory) => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
            navigate(`/stock/inventories/${inventory.id}`)
          }}
        />
      )}
    </div>
  )
}
