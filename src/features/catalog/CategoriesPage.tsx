import { EditOutlined, InboxOutlined, PlusOutlined, SubnodeOutlined, UndoOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Tooltip, TreeSelect, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useMemo, useState } from 'react'
import { usePermission } from '../../hook/usePermission'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as catalogService from '../../services/catalog.service'
import type { Category } from '../../types/catalog'
import { buildCategoryTree, descendantIds, toTreeSelectData, type CategoryNode } from './categoryTree'
import { useCategories } from './queries'

interface CategoryValues {
  name: string
  parentId: string | null
}

/** Création (à la racine ou sous une catégorie) ou modification (nom, déplacement). */
function CategoryFormModal({
  category,
  defaultParentId,
  categories,
  onCancel,
  onSaved,
}: {
  category: Category | null
  defaultParentId: string | null
  categories: Category[]
  onCancel: () => void
  onSaved: (category: Category, created: boolean) => void
}) {
  const [form] = Form.useForm<CategoryValues>()
  const isEdit = category !== null
  // Une catégorie ne peut pas être placée sous elle-même ni sous une de ses sous-catégories
  const treeData = useMemo(
    () => toTreeSelectData(buildCategoryTree(categories), isEdit ? descendantIds(categories, category.id) : new Set()),
    [categories, category, isEdit],
  )

  const save = useMutation({
    mutationFn: (values: CategoryValues) => {
      const input = { name: values.name, parentId: values.parentId ?? null }
      return isEdit ? catalogService.updateCategory(category.id, input) : catalogService.createCategory(input)
    },
    onSuccess: ({ category: saved }) => onSaved(saved, !isEdit),
  })

  return (
    <Modal
      open
      title={isEdit ? `Modifier « ${category.name} »` : 'Nouvelle catégorie'}
      okText={isEdit ? 'Enregistrer' : 'Créer la catégorie'}
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={save.isPending}
    >
      <Form<CategoryValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: category?.name ?? '', parentId: isEdit ? category.parentId : defaultParentId }}
        onFinish={(values) => save.mutate(values)}
        className="mt-4"
      >
        <Form.Item name="name" label="Nom" rules={[{ required: true, whitespace: true, message: 'Indiquez un nom' }, { max: 80 }]}>
          <Input placeholder="Boissons, Riz et céréales…" />
        </Form.Item>
        <Form.Item name="parentId" label="Catégorie parente" extra="Laissez vide pour une catégorie principale.">
          <TreeSelect
            allowClear
            treeDefaultExpandAll
            showSearch={{ treeNodeFilterProp: 'title' }}
            treeData={treeData}
            placeholder="Aucune (catégorie principale)"
            aria-label="Catégorie parente"
          />
        </Form.Item>
        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}

type FormState = { category: Category | null; parentId: string | null } | null

/** Catégories de produits, en arbre (rayons et sous-rayons). On archive, on ne supprime pas. */
export function CategoriesPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const canManage = usePermission('products.manage')
  const { data: categories = [], isPending, error } = useCategories(true)
  const [showArchived, setShowArchived] = useState(false)
  const [formState, setFormState] = useState<FormState>(null)

  const visible = showArchived ? categories : categories.filter((category) => !category.archivedAt)
  const tree = useMemo(() => buildCategoryTree(visible), [visible])

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })

  const archive = useMutation({
    mutationFn: ({ category, archived }: { category: Category; archived: boolean }) =>
      catalogService.updateCategory(category.id, { archived }),
    onSuccess: ({ category }, { archived }) => {
      void refresh()
      message.success(archived ? `« ${category.name} » archivée` : `« ${category.name} » restaurée`)
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const columns: TableColumnsType<CategoryNode> = [
    {
      title: 'Catégorie',
      dataIndex: 'name',
      render: (name: string, node) => (
        <Space size={6}>
          <Typography.Text strong={!node.parentId}>{name}</Typography.Text>
          {node.archivedAt && <Tag>Archivée</Tag>}
        </Space>
      ),
    },
    {
      title: 'Sous-catégories',
      key: 'children',
      width: 150,
      responsive: ['md'],
      render: (_, node) => node.children?.length ?? 0,
    },
    ...(canManage
      ? [
          {
            title: '',
            key: 'actions',
            width: 140,
            render: (_: unknown, node: CategoryNode) => (
              <Space size={4}>
                <Tooltip title="Ajouter une sous-catégorie">
                  <Button
                    icon={<SubnodeOutlined />}
                    size="small"
                    disabled={node.archivedAt !== null}
                    onClick={() => setFormState({ category: null, parentId: node.id })}
                    aria-label={`Ajouter une sous-catégorie à ${node.name}`}
                  />
                </Tooltip>
                <Tooltip title="Modifier">
                  <Button icon={<EditOutlined />} size="small" onClick={() => setFormState({ category: node, parentId: node.parentId })} aria-label={`Modifier ${node.name}`} />
                </Tooltip>
                <Popconfirm
                  title={node.archivedAt ? `Restaurer « ${node.name} » ?` : `Archiver « ${node.name} » ?`}
                  description={node.archivedAt ? undefined : 'Ses produits restent classés ; elle ne sera plus proposée.'}
                  okText={node.archivedAt ? 'Restaurer' : 'Archiver'}
                  cancelText="Annuler"
                  onConfirm={() => archive.mutate({ category: node, archived: !node.archivedAt })}
                >
                  <Button
                    icon={node.archivedAt ? <UndoOutlined /> : <InboxOutlined />}
                    size="small"
                    aria-label={node.archivedAt ? `Restaurer ${node.name}` : `Archiver ${node.name}`}
                  />
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={2} className="mb-0">
          Catégories
        </Typography.Title>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormState({ category: null, parentId: null })}>
            Nouvelle catégorie
          </Button>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch size="small" checked={showArchived} onChange={setShowArchived} aria-label="Afficher les catégories archivées" />
        Afficher les catégories archivées
      </label>

      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}

      <Card styles={{ body: { padding: 0 } }}>
        <Table<CategoryNode>
          rowKey="id"
          columns={columns}
          dataSource={tree}
          loading={isPending}
          pagination={false}
          expandable={{ defaultExpandAllRows: true }}
          // L'arbre change après un ajout : on le redéplie
          key={tree.length}
          rowClassName={(node) => (node.archivedAt ? 'opacity-60' : '')}
          locale={{ emptyText: 'Aucune catégorie : créez vos rayons (Boissons, Épicerie…)' }}
        />
      </Card>

      {formState && (
        <CategoryFormModal
          key={formState.category?.id ?? `new-${formState.parentId ?? 'root'}`}
          category={formState.category}
          defaultParentId={formState.parentId}
          categories={categories}
          onCancel={() => setFormState(null)}
          onSaved={(category, created) => {
            void refresh()
            setFormState(null)
            message.success(created ? `Catégorie « ${category.name} » créée` : `Catégorie « ${category.name} » mise à jour`)
          }}
        />
      )}
    </div>
  )
}
