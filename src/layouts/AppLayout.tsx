import { LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Layout, Typography } from 'antd'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../hook/useAuth'

const { Header, Content } = Layout

export function AppLayout() {
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
  }

  return (
    <Layout className="min-h-full">
      <Header className="flex items-center justify-between bg-white px-6 shadow-sm">
        <span className="text-lg font-bold text-brand">StockPro</span>
        <div className="flex items-center gap-3">
          <Avatar icon={<UserOutlined />} />
          <Typography.Text strong className="hidden sm:inline">
            {user?.name}
          </Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} loading={loggingOut}>
            Se déconnecter
          </Button>
        </div>
      </Header>
      <Content className="p-6">
        <Outlet />
      </Content>
    </Layout>
  )
}
