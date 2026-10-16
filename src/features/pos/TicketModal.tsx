import { PrinterOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, Skeleton } from 'antd'
import { Money } from '../../components/Money'
import { getErrorMessage } from '../../services/api'
import { useTicket } from './queries'

/** Imprime le ticket (42 colonnes, imprimante thermique 80 mm) dans une fenêtre dédiée. */
function printTicket(text: string, title: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.position = 'fixed'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) return
  const pre = doc.createElement('pre')
  pre.textContent = text
  pre.style.cssText = 'font: 12px/1.3 monospace; margin: 0; white-space: pre;'
  doc.title = title
  doc.body.style.margin = '4mm'
  doc.body.appendChild(pre)
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  setTimeout(() => frame.remove(), 1000)
}

/** Ticket de la vente : aperçu, monnaie à rendre, impression. */
export function TicketModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const { data: ticket, error } = useTicket(saleId)
  return (
    <Modal
      open
      title={ticket ? `Ticket ${ticket.number}` : 'Ticket'}
      onCancel={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Fermer</Button>
          <Button type="primary" icon={<PrinterOutlined />} disabled={!ticket} onClick={() => ticket && printTicket(ticket.text, ticket.number)}>
            Imprimer
          </Button>
        </div>
      }
    >
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!ticket ? (
        !error && <Skeleton active />
      ) : (
        <div className="flex flex-col gap-3">
          {Number(ticket.changeGiven) > 0 && (
            <Alert type="success" showIcon title={<span className="text-lg">Monnaie à rendre : <Money value={ticket.changeGiven} className="font-bold" /></span>} />
          )}
          {Number(ticket.balanceDue) > 0 && <Alert type="warning" showIcon title={<span>Reste dû (crédit client) : <Money value={ticket.balanceDue} /></span>} />}
          <pre className="max-h-96 overflow-auto rounded bg-slate-50 p-3 font-mono text-xs leading-snug">{ticket.text}</pre>
        </div>
      )}
    </Modal>
  )
}
