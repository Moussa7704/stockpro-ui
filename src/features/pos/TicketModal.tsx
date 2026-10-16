import { PrinterOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, Skeleton } from 'antd'
import { Money } from '../../components/Money'
import { getErrorMessage } from '../../services/api'
import { printText } from '../../utils/print'
import { useTicket } from './queries'

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
          <Button type="primary" icon={<PrinterOutlined />} disabled={!ticket} onClick={() => ticket && printText(ticket.text, ticket.number)}>
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
