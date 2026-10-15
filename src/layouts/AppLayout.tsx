import {
  DashboardOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Layout, Menu, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hook/useAuth'

const { Header, Content } = Layout

export function AppLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  const menuItems: MenuProps['items'] = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Tableau de bord</Link> },
    // Lien visible pour les admins seulement (la page et l'API sont protégées de toute façon)
    ...(user?.role === 'admin'
      ? [{ key: '/users', icon: <TeamOutlined />, label: <Link to="/users">Utilisateurs</Link> }]
      : []),
    { key: '/account', icon: <UserOutlined />, label: <Link to="/account">Mon compte</Link> },
  ]

  return (
    <Layout className="min-h-full">
      <Header className="flex items-center gap-6 bg-white px-6 shadow-sm">
        <Link to="/" className="text-lg font-bold text-brand">
          StockPro
        </Link>
        <Menu
          mode="horizontal"
          selectedKeys={[pathname]}
          items={menuItems}
          className="min-w-0 flex-1 border-b-0"
        />
        <div className="flex items-center gap-3">
          <Avatar icon={<UserOutlined />} />
          <Typography.Text strong className="hidden sm:inline">
            {user?.name}
          </Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} loading={loggingOut}>
            <span className="hidden md:inline">Se déconnecter</span>
          </Button>
        </div>
      </Header>
      <Content className="p-6">
        <Outlet />
      </Content>
    </Layout>
  )
}
