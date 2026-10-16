import {
  DashboardOutlined,
  LogoutOutlined,
  SafetyOutlined,
  ShopOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { App, Avatar, Button, Layout, Menu, Select, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hook/useAuth'
import { getErrorMessage } from '../services/api'

const { Header, Content } = Layout

export function AppLayout() {
  const { user, companies, activeCompany, can, switchCompany, logout } = useAuth()
  const { message } = App.useApp()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [switching, setSwitching] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  async function handleSwitch(companyId: string) {
    setSwitching(true)
    try {
      await switchCompany(companyId)
      // Les droits changent avec l'entreprise : on repart du tableau de bord
      navigate('/')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSwitching(false)
    }
  }

  // Liens selon les permissions (les pages et l'API sont protégées de toute façon)
  const menuItems: MenuProps['items'] = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Tableau de bord</Link> },
    ...(can('users.manage')
      ? [{ key: '/members', icon: <TeamOutlined />, label: <Link to="/members">Équipe</Link> }]
      : []),
    ...(can('roles.manage')
      ? [{ key: '/roles', icon: <SafetyOutlined />, label: <Link to="/roles">Rôles</Link> }]
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
          {companies.length > 1 ? (
            <Select
              value={activeCompany?.id}
              onChange={handleSwitch}
              loading={switching}
              disabled={switching}
              options={companies.map((company) => ({ value: company.id, label: company.name }))}
              suffixIcon={<ShopOutlined />}
              className="hidden w-48 sm:block"
              aria-label="Entreprise active"
            />
          ) : (
            <Typography.Text type="secondary" className="hidden sm:inline">
              {activeCompany?.name}
            </Typography.Text>
          )}
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
