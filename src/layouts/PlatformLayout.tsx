import { DownOutlined, LogoutOutlined, ShopOutlined, UserOutlined } from '@ant-design/icons'
import { App, Avatar, Button, Dropdown, Layout, Tag } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { PageSuspense } from '../components/PageSuspense'
import { useAuth } from '../hook/useAuth'
import { getErrorMessage } from '../services/api'

const { Header, Content } = Layout

/**
 * Back-office de la plateforme : hors de toute entreprise (pas de boutique ni de droits de
 * commerçant). Même principe que l'application : en-tête fixe, seul le contenu défile.
 */
export function PlatformLayout() {
  const { user, companies, logout } = useAuth()
  const { message } = App.useApp()
  const { pathname } = useLocation()
  const contentRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [pathname])

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Se déconnecter',
      danger: true,
      onClick: () => void logout().catch((err: unknown) => message.error(`Déconnexion impossible : ${getErrorMessage(err)} Réessayez.`)),
    },
  ]

  return (
    <Layout className="h-dvh overflow-hidden">
      <Header className="z-10 flex shrink-0 items-center gap-3 bg-white px-6 shadow-sm">
        <Link to="/platform" className="flex items-center gap-2 text-lg font-bold text-brand">
          StockPro <Tag color="gold">Plateforme</Tag>
        </Link>
        <nav aria-label="Menu de la plateforme" className="flex flex-1 items-center gap-4">
          <Link to="/platform">Commerçants</Link>
        </nav>
        {/* Super-admin aussi membre d'une entreprise : retour à son espace commerçant */}
        {companies.length > 0 && (
          <Link to="/">
            <Button icon={<ShopOutlined />}>Mon entreprise</Button>
          </Link>
        )}
        <Dropdown menu={{ items: userMenu }} trigger={['click']}>
          <Button type="text" className="flex items-center gap-2" aria-label="Menu utilisateur">
            <Avatar size="small" icon={<UserOutlined />} />
            <span className="hidden sm:inline">{user?.name}</span>
            <DownOutlined className="text-xs" />
          </Button>
        </Dropdown>
      </Header>
      <Content ref={contentRef} className="min-h-0 flex-1 overflow-y-auto p-6">
        <PageSuspense>
          <Outlet />
        </PageSuspense>
      </Content>
    </Layout>
  )
}
