import { DesktopOutlined, LogoutOutlined, MobileOutlined, TabletOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Card, List, Popconfirm, Skeleton, Tag, Typography } from 'antd'
import type { ReactNode } from 'react'
import { queryKeys } from '../../lib/queryKeys'
import { getErrorMessage } from '../../services/api'
import * as authService from '../../services/auth.service'
import type { AccountSession } from '../../types/auth'
import { formatDateTime } from '../../utils/format'
import { describeUserAgent, type DeviceKind } from '../../utils/userAgent'

const DEVICE_ICONS: Record<DeviceKind, ReactNode> = {
  mobile: <MobileOutlined />,
  tablet: <TabletOutlined />,
  desktop: <DesktopOutlined />,
}

/**
 * Appareils connectés au compte : on reconnaît un appareil perdu ou inconnu et on le déconnecte
 * (effet immédiat côté serveur). L'appareil courant se ferme avec « Se déconnecter ».
 */
export function SessionsCard() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { data: sessions, error } = useQuery({
    queryKey: queryKeys.account.sessions,
    queryFn: async () => (await authService.listSessions()).sessions,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions })

  const revoke = useMutation({
    mutationFn: (session: AccountSession) => authService.revokeSession(session.id),
    onSuccess: (_, session) => {
      message.success(`${describeUserAgent(session.userAgent).label} est déconnecté`)
      void refresh()
    },
    onError: (err) => {
      message.error(getErrorMessage(err))
      void refresh()
    },
  })
  const revokeOthers = useMutation({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: ({ revoked }) => {
      message.success(revoked > 0 ? `${revoked} autre(s) appareil(s) déconnecté(s)` : 'Aucun autre appareil connecté')
      void refresh()
    },
    onError: (err) => message.error(getErrorMessage(err)),
  })

  const others = (sessions ?? []).filter((session) => !session.current).length

  return (
    <Card
      title="Appareils connectés"
      extra={
        others > 0 && (
          <Popconfirm
            title="Déconnecter tous les autres appareils ?"
            description="Il faudra se reconnecter sur chacun d’eux (mot de passe + code par email)."
            okText="Déconnecter"
            okButtonProps={{ danger: true }}
            cancelText="Annuler"
            onConfirm={() => revokeOthers.mutate()}
          >
            <Button danger size="small" loading={revokeOthers.isPending}>
              Déconnecter tous les autres
            </Button>
          </Popconfirm>
        )
      }
    >
      <Typography.Paragraph type="secondary">
        Un appareil que vous ne reconnaissez pas ? Déconnectez-le, puis changez votre mot de passe.
      </Typography.Paragraph>
      {error && <Alert type="error" title={getErrorMessage(error)} showIcon />}
      {!sessions ? (
        !error && <Skeleton active />
      ) : (
        <List<AccountSession>
          dataSource={sessions}
          locale={{ emptyText: 'Aucun appareil connecté' }}
          renderItem={(session) => {
            const device = describeUserAgent(session.userAgent)
            return (
              <List.Item
                actions={
                  session.current
                    ? []
                    : [
                        <Popconfirm
                          key="revoke"
                          title={`Déconnecter ${device.label} ?`}
                          okText="Déconnecter"
                          okButtonProps={{ danger: true }}
                          cancelText="Annuler"
                          onConfirm={() => revoke.mutate(session)}
                        >
                          <Button size="small" icon={<LogoutOutlined />} loading={revoke.isPending && revoke.variables?.id === session.id} aria-label={`Déconnecter ${device.label}`}>
                            Déconnecter
                          </Button>
                        </Popconfirm>,
                      ]
                }
              >
                <List.Item.Meta
                  avatar={<span className="text-xl text-slate-500">{DEVICE_ICONS[device.kind]}</span>}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {device.label}
                      {session.current && <Tag color="success">Cet appareil</Tag>}
                    </span>
                  }
                  description={
                    <span className="text-xs">
                      Connecté le {formatDateTime(session.startedAt)} · dernière activité le {formatDateTime(session.lastActiveAt)}
                      {session.ipAddress && ` · adresse ${session.ipAddress}`}
                    </span>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </Card>
  )
}
