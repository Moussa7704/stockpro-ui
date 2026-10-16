import { LockOutlined, UnlockOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Skeleton, Typography } from 'antd'
import { useState } from 'react'
import { AmountInput } from '../../components/AmountInput'
import { Money } from '../../components/Money'
import { getErrorMessage } from '../../services/api'
import * as posService from '../../services/pos.service'
import type { CashSession } from '../../types/pos'
import { formatDateTime } from '../../utils/format'
import { fromCents, toCents } from './pricing'
import { useSession } from './queries'

/** Caisse fermée : on l'ouvre avec le fond de caisse (monnaie déjà dans le tiroir). */
export function OpenSessionCard({ shopId, shopName, onOpened }: { shopId: string; shopName: string; onOpened: (session: CashSession) => void }) {
  const [openingFloat, setOpeningFloat] = useState<string | null>(null)
  const open = useMutation({
    mutationFn: () => posService.openSession(shopId, openingFloat ?? '0'),
    onSuccess: ({ session }) => onOpened(session),
  })

  return (
    <Card className="mx-auto mt-10 max-w-md" title={<span><UnlockOutlined /> Ouvrir la caisse — {shopName}</span>}>
      <Typography.Paragraph type="secondary">Comptez la monnaie présente dans le tiroir avant la première vente.</Typography.Paragraph>
      <Form layout="vertical" onFinish={() => open.mutate()}>
        <Form.Item label="Fond de caisse">
          <AmountInput value={openingFloat} onChange={setOpeningFloat} autoFocus size="large" aria-label="Fond de caisse" />
        </Form.Item>
        {open.error && <Alert type="error" title={getErrorMessage(open.error)} showIcon className="mb-4" />}
        <Button type="primary" htmlType="submit" size="large" block loading={open.isPending}>
          Ouvrir la caisse
        </Button>
      </Form>
    </Card>
  )
}

/** Clôture : le caissier compte son tiroir ; l'écart avec les espèces attendues est enregistré. */
export function CloseSessionModal({ sessionId, onCancel, onClosed }: { sessionId: string; onCancel: () => void; onClosed: (session: CashSession) => void }) {
  const { data: session, error } = useSession(sessionId)
  const [counted, setCounted] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const close = useMutation({
    mutationFn: () => posService.closeSession(sessionId, counted ?? '0', notes.trim() || null),
    onSuccess: ({ session: closed }) => onClosed(closed),
  })

  const summary = session?.summary
  const difference = counted === null || !summary ? null : toCents(counted) - toCents(summary.expectedCash)

  return (
    <Modal
      open
      title={<span><LockOutlined /> Clôturer la caisse</span>}
      okText="Clôturer"
      cancelText="Annuler"
      onOk={() => close.mutate()}
      onCancel={onCancel}
      okButtonProps={{ disabled: counted === null, loading: close.isPending }}
      width={560}
    >
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!summary ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-4">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Ouverte le">{formatDateTime(session.openedAt)}</Descriptions.Item>
            <Descriptions.Item label="Ventes">
              {summary.salesCount} vente(s) — <Money value={summary.salesTotal} />
            </Descriptions.Item>
            {summary.byMethod.map((method) => (
              <Descriptions.Item key={method.methodId} label={method.name}>
                <Money value={method.amount} />
              </Descriptions.Item>
            ))}
            <Descriptions.Item label="Fond de caisse">
              <Money value={session.openingFloat} />
            </Descriptions.Item>
            {Number(summary.cashRefunds) > 0 && (
              <Descriptions.Item label="Remboursements en espèces">
                <Money value={`-${summary.cashRefunds}`} />
              </Descriptions.Item>
            )}
            {Number(summary.cashCustomerPayments) > 0 && (
              <Descriptions.Item label="Règlements clients en espèces">
                <Money value={summary.cashCustomerPayments} />
              </Descriptions.Item>
            )}
            {Number(summary.cashExpenses) > 0 && (
              <Descriptions.Item label="Dépenses payées du tiroir">
                <Money value={`-${summary.cashExpenses}`} />
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Espèces attendues">
              <Money value={summary.expectedCash} className="font-semibold" />
            </Descriptions.Item>
          </Descriptions>

          <Form layout="vertical" component="div">
            <Form.Item label="Espèces comptées dans le tiroir">
              <AmountInput value={counted} onChange={setCounted} autoFocus size="large" aria-label="Espèces comptées" />
            </Form.Item>
            {difference !== null && (
              <Alert
                type={difference === 0 ? 'success' : 'warning'}
                showIcon
                title={difference === 0 ? 'Caisse juste' : difference < 0 ? 'Il manque de l’argent' : 'Il y a trop d’argent'}
                description={difference === 0 ? undefined : <span>Écart : <Money value={fromCents(difference)} /></span>}
                className="mb-4"
              />
            )}
            <Form.Item label="Commentaire">
              <Input.TextArea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Explication d’un écart…" />
            </Form.Item>
          </Form>
          {close.error && <Alert type="error" title={getErrorMessage(close.error)} showIcon />}
        </div>
      )}
    </Modal>
  )
}
