import { BarcodeOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, Form, Input, Modal, Select, TreeSelect } from 'antd'
import { useEffect, useMemo } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { QuantityInput } from '../../components/QuantityInput'
import { usePermission } from '../../hook/usePermission'
import { getErrorMessage } from '../../services/api'
import * as catalogService from '../../services/catalog.service'
import type { Product, ProductInput } from '../../types/catalog'
import { buildCategoryTree, toTreeSelectData } from './categoryTree'
import { useCategories, useUnits } from './queries'

interface ProductValues {
  name: string
  sku: string
  barcode: string | null
  unitId: string
  categoryId: string | null
  salePrice: string | null
  purchasePriceHint: string | null
  alertThreshold: string | null
  description: string | null
}

const sameAmount = (a: string | null | undefined, b: string | null | undefined) =>
  (a === null || a === undefined || a === '' ? null : Number(a)) === (b === null || b === undefined || b === '' ? null : Number(b))

const emptyToNull = (value: string | null | undefined) => (value === undefined || value === null || value.trim() === '' ? null : value.trim())

/** Différences avec le produit enregistré : on n'envoie que ce qui change. */
function changes(product: Product, values: ProductValues): Partial<ProductInput> {
  const diff: Partial<ProductInput> = {}
  if (values.name !== product.name) diff.name = values.name
  if (values.sku !== product.sku) diff.sku = values.sku
  if (emptyToNull(values.barcode) !== product.barcode) diff.barcode = emptyToNull(values.barcode)
  if (values.unitId !== product.unitId) diff.unitId = values.unitId
  if ((values.categoryId ?? null) !== product.categoryId) diff.categoryId = values.categoryId ?? null
  if (!sameAmount(values.salePrice, product.salePrice)) diff.salePrice = values.salePrice ?? '0'
  if (!sameAmount(values.purchasePriceHint, product.purchasePriceHint)) diff.purchasePriceHint = values.purchasePriceHint
  if (!sameAmount(values.alertThreshold, product.alertThreshold)) diff.alertThreshold = values.alertThreshold ?? '0'
  if (emptyToNull(values.description) !== product.description) diff.description = emptyToNull(values.description)
  return diff
}

interface ProductFormModalProps {
  product: Product | null
  onCancel: () => void
  onSaved: (product: Product, created: boolean) => void
}

/** Fiche produit : identification (SKU, code-barres), classement, unité, prix et seuil d'alerte. */
export function ProductFormModal({ product, onCancel, onSaved }: ProductFormModalProps) {
  const [form] = Form.useForm<ProductValues>()
  const isEdit = product !== null
  // Changer un prix existant est réservé à prices.manage (le serveur le revérifie)
  const canChangePrices = usePermission('prices.manage') || !isEdit
  const { data: units = [] } = useUnits()
  const { data: categories = [] } = useCategories()
  const unitId = Form.useWatch('unitId', form)

  // L'unité actuelle reste affichée même si elle a été archivée depuis
  const unitOptions = units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }))
  if (product && !units.some((unit) => unit.id === product.unitId)) {
    unitOptions.push({ value: product.unit.id, label: `${product.unit.name} (${product.unit.symbol})` })
  }
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? (product?.unitId === unitId ? product?.unit : undefined)
  const categoryTree = useMemo(() => toTreeSelectData(buildCategoryTree(categories)), [categories])

  // Nouveau produit : unité « Pièce » par défaut, appliquée dès que la liste des unités est arrivée
  // (la fenêtre peut s'ouvrir avant la fin du chargement)
  const defaultUnitId = units.find((unit) => unit.name === 'Pièce')?.id ?? units[0]?.id
  useEffect(() => {
    if (!isEdit && defaultUnitId && !form.getFieldValue('unitId')) form.setFieldValue('unitId', defaultUnitId)
  }, [isEdit, defaultUnitId, form])

  const save = useMutation({
    mutationFn: async (values: ProductValues) => {
      if (isEdit) {
        const diff = changes(product, values)
        // Rien n'a changé : inutile de déranger le serveur
        return Object.keys(diff).length === 0 ? { product } : catalogService.updateProduct(product.id, diff)
      }
      return catalogService.createProduct({
        name: values.name,
        sku: values.sku,
        barcode: emptyToNull(values.barcode),
        unitId: values.unitId,
        categoryId: values.categoryId ?? null,
        salePrice: values.salePrice ?? '0',
        purchasePriceHint: values.purchasePriceHint,
        alertThreshold: values.alertThreshold ?? '0',
        description: emptyToNull(values.description),
      })
    },
    onSuccess: ({ product: saved }) => onSaved(saved, !isEdit),
  })

  const initialValues: Partial<ProductValues> = product
    ? {
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        unitId: product.unitId,
        categoryId: product.categoryId,
        salePrice: product.salePrice,
        purchasePriceHint: product.purchasePriceHint,
        alertThreshold: product.alertThreshold,
        description: product.description,
      }
    : { unitId: defaultUnitId, alertThreshold: '0' }

  return (
    <Modal
      open
      title={isEdit ? `Modifier « ${product.name} »` : 'Nouveau produit'}
      okText={isEdit ? 'Enregistrer' : 'Créer le produit'}
      cancelText="Annuler"
      onOk={() => form.submit()}
      onCancel={onCancel}
      confirmLoading={save.isPending}
      width={680}
    >
      <Form<ProductValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={initialValues}
        onFinish={(values) => save.mutate(values)}
        className="mt-4"
      >
        <Form.Item name="name" label="Désignation" rules={[{ required: true, whitespace: true, message: 'Indiquez le nom du produit' }, { min: 2, max: 150 }]}>
          <Input placeholder="Riz parfumé 25 kg" />
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            name="sku"
            label="Référence (SKU)"
            normalize={(value: string) => value.toUpperCase().replace(/\s/g, '')}
            rules={[
              { required: true, message: 'Indiquez une référence' },
              { pattern: /^[A-Z0-9][A-Z0-9._-]{0,63}$/, message: 'Lettres, chiffres, . _ - (64 max)' },
            ]}
          >
            <Input placeholder="RIZ-25" />
          </Form.Item>
          <Form.Item
            name="barcode"
            label="Code-barres"
            extra="Scannez-le directement avec la douchette."
            rules={[{ pattern: /^[0-9A-Za-z-]{4,64}$/, message: 'Code-barres invalide' }]}
          >
            <Input
              prefix={<BarcodeOutlined />}
              placeholder="6001234567890"
              // La douchette envoie "Entrée" après le code : il ne doit pas valider le formulaire
              onPressEnter={(event) => event.preventDefault()}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item name="unitId" label="Unité de vente" rules={[{ required: true, message: 'Choisissez une unité' }]}>
            <Select options={unitOptions} aria-label="Unité de vente" />
          </Form.Item>
          <Form.Item name="categoryId" label="Catégorie">
            <TreeSelect allowClear treeDefaultExpandAll showSearch={{ treeNodeFilterProp: 'title' }} treeData={categoryTree} placeholder="Sans catégorie" aria-label="Catégorie" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Form.Item
            name="salePrice"
            label="Prix de vente"
            rules={[{ required: true, message: 'Indiquez le prix de vente' }]}
            extra={canChangePrices ? undefined : 'Modifier un prix demande la permission « Modifier les prix de vente ».'}
          >
            <AmountInput disabled={!canChangePrices} aria-label="Prix de vente" />
          </Form.Item>
          <Form.Item name="purchasePriceHint" label="Prix d’achat indicatif" extra="Le coût réel est calculé à chaque réception (coût moyen).">
            <AmountInput disabled={!canChangePrices} aria-label="Prix d’achat indicatif" />
          </Form.Item>
        </div>

        <Form.Item name="alertThreshold" label="Seuil d’alerte de stock" extra="Le produit est signalé en stock bas à ce niveau (0 : pas d’alerte).">
          <QuantityInput allowsDecimal={selectedUnit?.allowsDecimal} unitSymbol={selectedUnit?.symbol} className="w-48" aria-label="Seuil d’alerte de stock" />
        </Form.Item>

        <Form.Item name="description" label="Description" rules={[{ max: 2000 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>

        {save.error && <Alert type="error" title={getErrorMessage(save.error)} showIcon />}
      </Form>
    </Modal>
  )
}
