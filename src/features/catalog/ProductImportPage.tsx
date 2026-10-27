import { ArrowLeftOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, Checkbox, Result, Segmented, Select, Spin, Steps, Table, Tag, Typography, Upload } from 'antd'
import type { TableColumnsType } from 'antd'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { queryKeys } from '../../lib/queryKeys'
import { ApiError, getErrorMessage, newIdempotencyKey } from '../../services/api'
import * as catalogService from '../../services/catalog.service'
import type { ImportAnalysis, ImportField, ImportMapping, ImportReport, ImportRow, ImportRowStatus } from '../../types/catalog'
import { useUnits } from './queries'

// Mêmes limites que le serveur : on prévient avant d'envoyer
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = '.xlsx,.csv'

const STATUS: Record<ImportRowStatus, { label: string; color: string }> = {
  create: { label: 'À créer', color: 'green' },
  existing: { label: 'Déjà enregistré', color: 'blue' },
  skipped: { label: 'Ignorée', color: 'default' },
  error: { label: 'Erreur', color: 'red' },
}

type Step = 'file' | 'mapping' | 'check' | 'done'
const STEPS: Step[] = ['file', 'mapping', 'check', 'done']

/** Rapport d'import renvoyé dans les détails d'un refus (tout ou rien : une ligne en erreur). */
function reportOf(error: unknown): ImportReport | null {
  const details = error instanceof ApiError ? error.details : undefined
  return details && typeof details === 'object' && 'rows' in details ? (details as ImportReport) : null
}

/**
 * Correspondance pour un nouveau fichier : celle déjà choisie par l'utilisateur quand la colonne
 * existe encore (fichier corrigé puis rechargé), sinon celle proposée par le serveur.
 */
function nextMapping(previous: ImportMapping, analysis: ImportAnalysis): ImportMapping {
  const kept = Object.fromEntries(Object.entries(previous).filter(([, column]) => column && analysis.columns.includes(column)))
  return { ...analysis.suggestedMapping, ...kept }
}

/**
 * Assistant d'import du catalogue depuis le fichier que le commerçant a déjà (Excel ou CSV) :
 * il dépose son fichier tel quel, indique quelle colonne correspond à quoi, vérifie chaque ligne,
 * puis importe (tout ou rien). Les produits déjà enregistrés ne sont pas modifiés.
 */
export function ProductImportPage() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { data: units = [] } = useUnits()

  const [step, setStep] = useState<Step>('file')
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null)
  const [mapping, setMapping] = useState<ImportMapping>({})
  const [chosenUnitId, setChosenUnitId] = useState<string | undefined>()
  const [createCategories, setCreateCategories] = useState(true)
  const [preview, setPreview] = useState<ImportReport | null>(null)
  const [result, setResult] = useState<ImportReport | null>(null)
  const [filter, setFilter] = useState<ImportRowStatus | 'all'>('all')
  // Une clé par aperçu validé : un double clic ou une coupure réseau n'importe pas deux fois
  const idempotencyKey = useRef<string | null>(null)

  // Unité par défaut : la pièce, tant que l'utilisateur n'en a pas choisi une autre
  const defaultUnitId = chosenUnitId ?? units.find((unit) => unit.symbol === 'pce')?.id
  const options = { mapping, defaultUnitId, createCategories }
  const missingRequired = analysis?.fields.filter((field) => field.required && !mapping[field.field]) ?? []

  const analyze = useMutation({
    mutationFn: catalogService.analyzeImport,
    onSuccess: ({ analysis: found }) => {
      setAnalysis(found)
      setMapping((previous) => nextMapping(previous, found))
      setPreview(null)
      setStep('mapping')
    },
  })

  const check = useMutation({
    mutationFn: () => catalogService.runImport(file!, { ...options, dryRun: true }),
    onSuccess: ({ report }) => {
      setPreview(report)
      setFilter(report.errors > 0 ? 'error' : 'all')
      idempotencyKey.current = newIdempotencyKey()
      setStep('check')
    },
    onError: (error) => message.error(getErrorMessage(error)),
  })

  const confirm = useMutation({
    mutationFn: () => catalogService.runImport(file!, { ...options, dryRun: false }, idempotencyKey.current ?? undefined),
    onSuccess: ({ report }) => {
      setResult(report)
      setStep('done')
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
    onError: (error) => {
      // Le catalogue a changé entre l'aperçu et l'import : on montre le nouveau rapport
      const report = reportOf(error)
      if (report) {
        setPreview(report)
        setFilter('error')
      }
      message.error(getErrorMessage(error))
    },
  })

  function chooseFile(chosen: File) {
    if (chosen.size > MAX_BYTES) {
      message.error('Fichier trop volumineux (5 Mo max) : découpez-le en plusieurs fichiers')
      return
    }
    setFile(chosen)
    analyze.mutate(chosen)
  }

  function restart() {
    setStep('file')
    setFile(null)
    setAnalysis(null)
    setMapping({})
    setPreview(null)
    setResult(null)
    analyze.reset()
  }

  const downloadTemplate = useMutation({
    mutationFn: catalogService.downloadImportTemplate,
    onError: (error) => message.error(getErrorMessage(error)),
  })

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/products">
          <Button icon={<ArrowLeftOutlined />} aria-label="Retour aux produits" />
        </Link>
        <Typography.Title level={2} className="mb-0">
          Importer des produits
        </Typography.Title>
      </div>

      <Steps
        current={STEPS.indexOf(step)}
        size="small"
        items={[{ title: 'Fichier' }, { title: 'Colonnes' }, { title: 'Vérification' }, { title: 'Terminé' }]}
      />

      {step === 'file' && (
        <Card>
          <div className="flex flex-col gap-4">
            <Typography.Paragraph className="mb-0">
              Déposez la liste de vos articles telle que vous l’avez déjà, en Excel ou en CSV. Vous indiquerez ensuite quelle colonne
              correspond au nom, au prix, à la référence… Rien n’est enregistré avant la dernière étape.
            </Typography.Paragraph>
            <Spin spinning={analyze.isPending} description="Lecture du fichier…">
              <Upload.Dragger
                accept={ACCEPT}
                maxCount={1}
                showUploadList={false}
                beforeUpload={(chosen) => {
                  chooseFile(chosen)
                  return false
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Cliquez ou déposez votre fichier ici</p>
                <p className="ant-upload-hint">Excel (.xlsx) ou CSV · 5 Mo et 5 000 lignes au maximum</p>
              </Upload.Dragger>
            </Spin>
            {analyze.error && <Alert type="error" showIcon title={getErrorMessage(analyze.error)} />}
            <Alert
              type="info"
              showIcon
              title="Les quantités en stock ne sont pas encore importées"
              description="Cette étape crée les fiches produits. Le stock de départ se saisira ensuite par boutique."
            />
            <div>
              <Button icon={<DownloadOutlined />} loading={downloadTemplate.isPending} onClick={() => downloadTemplate.mutate()}>
                Télécharger un modèle vierge
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'mapping' && analysis && (
        <MappingStep
          analysis={analysis}
          mapping={mapping}
          onMappingChange={(field, column) => setMapping((current) => ({ ...current, [field]: column }))}
          units={units}
          defaultUnitId={defaultUnitId}
          onDefaultUnitChange={setChosenUnitId}
          createCategories={createCategories}
          onCreateCategoriesChange={setCreateCategories}
          footer={
            <div className="flex flex-wrap justify-between gap-2">
              <Button onClick={() => setStep('file')}>Changer de fichier</Button>
              <Button type="primary" disabled={missingRequired.length > 0} loading={check.isPending} onClick={() => check.mutate()}>
                Vérifier les {analysis.rowCount} ligne(s)
              </Button>
            </div>
          }
        />
      )}

      {step === 'check' && preview && (
        <Card title={`Vérification de « ${preview.filename} »`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" aria-label="Résumé">
              <Tag color="green">À créer : {preview.toCreate}</Tag>
              <Tag color="blue">Déjà enregistrés : {preview.existing}</Tag>
              <Tag>Ignorées : {preview.skipped}</Tag>
              <Tag color="red">Erreurs : {preview.errors}</Tag>
            </div>
            {preview.errors > 0 ? (
              <Alert
                type="error"
                showIcon
                title={`${preview.errors} ligne(s) en erreur : rien ne sera importé tant qu’il en reste`}
                description="Corrigez ces lignes dans votre fichier, enregistrez-le, puis rechargez-le. Vos choix de colonnes sont conservés."
                action={<Button onClick={() => setStep('file')}>Recharger le fichier corrigé</Button>}
              />
            ) : (
              preview.toCreate === 0 && <Alert type="info" showIcon title="Aucun nouveau produit à créer dans ce fichier" />
            )}
            {preview.categoriesToCreate.length > 0 && (
              <Alert type="info" showIcon title={`Catégories qui seront créées : ${preview.categoriesToCreate.join(', ')}`} />
            )}
            <ReportTable rows={preview.rows} filter={filter} onFilterChange={setFilter} />
            <div className="flex flex-wrap justify-between gap-2">
              <Button onClick={() => setStep('mapping')}>Modifier les colonnes</Button>
              <Button
                type="primary"
                disabled={preview.errors > 0 || preview.toCreate === 0}
                loading={confirm.isPending}
                onClick={() => confirm.mutate()}
              >
                Importer {preview.toCreate} produit(s)
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === 'done' && result && (
        <Card>
          <Result
            status="success"
            title={`${result.toCreate} produit(s) importé(s)`}
            subTitle={[
              result.existing > 0 && `${result.existing} déjà enregistré(s), non modifié(s)`,
              result.skipped > 0 && `${result.skipped} ligne(s) ignorée(s)`,
              result.categoriesToCreate.length > 0 && `catégories créées : ${result.categoriesToCreate.join(', ')}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            extra={[
              <Link key="products" to="/products">
                <Button type="primary">Voir les produits</Button>
              </Link>,
              <Button key="again" onClick={restart}>
                Importer un autre fichier
              </Button>,
            ]}
          />
        </Card>
      )}
    </div>
  )
}

interface MappingStepProps {
  analysis: ImportAnalysis
  mapping: ImportMapping
  onMappingChange: (field: ImportField, column: string | undefined) => void
  units: { id: string; name: string; symbol: string }[]
  defaultUnitId: string | undefined
  onDefaultUnitChange: (unitId: string) => void
  createCategories: boolean
  onCreateCategoriesChange: (value: boolean) => void
  footer: ReactNode
}

/** Étape 2 : quelle colonne du fichier alimente quel champ, avec un exemple tiré du fichier. */
function MappingStep({
  analysis,
  mapping,
  onMappingChange,
  units,
  defaultUnitId,
  onDefaultUnitChange,
  createCategories,
  onCreateCategoriesChange,
  footer,
}: MappingStepProps) {
  const used = new Set(Object.values(mapping).filter(Boolean))
  const example = (column: string | undefined) => {
    const index = column ? analysis.columns.indexOf(column) : -1
    return index === -1 ? undefined : analysis.sample.map((row) => row.cells[index]).find(Boolean)
  }

  const sampleColumns: TableColumnsType<ImportAnalysis['sample'][number]> = [
    { title: 'Ligne', key: 'line', width: 70, render: (_, row) => row.line },
    ...analysis.columns.map((column, index) => ({
      title: column,
      key: `c${index}`,
      render: (_: unknown, row: ImportAnalysis['sample'][number]) => row.cells[index],
    })),
  ]

  return (
    <>
      <Card title={`Colonnes de « ${analysis.filename} » (${analysis.rowCount} ligne(s))`}>
        <div className="flex flex-col gap-3">
          <Typography.Text type="secondary">
            Nous avons deviné la correspondance d’après les intitulés : vérifiez-la. Seuls le nom et le prix de vente sont obligatoires ;
            sans référence, une référence ART-… est attribuée.
          </Typography.Text>
          {analysis.fields.map(({ field, label, required }) => {
            const column = mapping[field]
            const sample = example(column)
            return (
              <div key={field} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_minmax(0,320px)_1fr]">
                <Typography.Text strong={required}>
                  {label}
                  {required && <span className="text-red-500"> *</span>}
                </Typography.Text>
                <Select
                  allowClear
                  value={column}
                  placeholder="Ne pas importer"
                  onChange={(value?: string) => onMappingChange(field, value)}
                  options={analysis.columns.map((name) => ({ value: name, label: name, disabled: used.has(name) && name !== column }))}
                  aria-label={`Colonne pour ${label}`}
                  status={required && !column ? 'error' : undefined}
                />
                <Typography.Text type="secondary" ellipsis>
                  {sample ? `ex. : ${sample}` : ''}
                </Typography.Text>
              </div>
            )
          })}

          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2">
              <span>Unité si la ligne n’en a pas</span>
              <Select
                value={defaultUnitId}
                onChange={onDefaultUnitChange}
                options={units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }))}
                className="w-48"
                aria-label="Unité par défaut"
              />
            </label>
            <Checkbox checked={createCategories} onChange={(event) => onCreateCategoriesChange(event.target.checked)}>
              Créer les catégories qui n’existent pas encore
            </Checkbox>
          </div>
          {footer}
        </div>
      </Card>

      <Card title="Début du fichier" styles={{ body: { padding: 0 } }}>
        <Table rowKey="line" columns={sampleColumns} dataSource={analysis.sample} pagination={false} size="small" scroll={{ x: 'max-content' }} />
      </Card>
    </>
  )
}

/** Étape 3 : chaque ligne du fichier avec son sort, filtrable (les erreurs d'abord s'il y en a). */
function ReportTable({
  rows,
  filter,
  onFilterChange,
}: {
  rows: ImportRow[]
  filter: ImportRowStatus | 'all'
  onFilterChange: (value: ImportRowStatus | 'all') => void
}) {
  const count = (status: ImportRowStatus) => rows.filter((row) => row.status === status).length
  const visible = filter === 'all' ? rows : rows.filter((row) => row.status === filter)

  const columns: TableColumnsType<ImportRow> = [
    { title: 'Ligne', dataIndex: 'line', width: 70 },
    { title: 'Produit', dataIndex: 'name', render: (name: string) => name || '—' },
    {
      title: 'Référence',
      key: 'sku',
      width: 170,
      render: (_, row) =>
        row.sku ? (
          <span>
            {row.sku} {row.generatedSku && <Tag>attribuée</Tag>}
          </span>
        ) : (
          '—'
        ),
    },
    { title: 'Statut', key: 'status', width: 140, render: (_, row) => <Tag color={STATUS[row.status].color}>{STATUS[row.status].label}</Tag> },
    { title: 'Détail', key: 'messages', render: (_, row) => row.messages?.join(' · ') ?? '' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <Segmented<ImportRowStatus | 'all'>
        value={filter}
        onChange={onFilterChange}
        aria-label="Lignes affichées"
        options={[
          { value: 'all', label: `Toutes (${rows.length})` },
          ...(['error', 'create', 'existing', 'skipped'] as const).map((status) => ({
            value: status,
            label: `${STATUS[status].label} (${count(status)})`,
          })),
        ]}
      />
      <Table<ImportRow>
        rowKey="line"
        columns={columns}
        dataSource={visible}
        size="small"
        scroll={{ x: 760 }}
        pagination={{ pageSize: 50, showSizeChanger: false, hideOnSinglePage: true }}
        rowClassName={(row) => (row.status === 'error' ? 'bg-red-50' : '')}
      />
    </div>
  )
}
