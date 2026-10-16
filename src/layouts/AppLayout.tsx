import {
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BankOutlined,
  CarryOutOutlined,
  DatabaseOutlined,
  ColumnWidthOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  DollarOutlined,
  DownOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FolderOutlined,
  HistoryOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  InboxOutlined,
  LogoutOutlined,
  RollbackOutlined,
  SafetyOutlined,
  SendOutlined,
  SettingOutlined,
  ShopOutlined,
  SlidersOutlined,
  TeamOutlined,
  WalletOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { App, Avatar, Button, Dropdown, Layout, Menu, Select, Typography } from 'antd'
import type { MenuProps } from 'antd'
import { useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useActiveShop } from '../hook/useActiveShop'
import { useAuth } from '../hook/useAuth'
import { getErrorMessage } from '../services/api'
import type { Permission } from '../types/access'

const { Header, Sider, Content } = Layout

/** Boutique de travail (caisse, stock…) : choix mémorisé par entreprise. */
function ShopSelector() {
  const { shops, activeShop, setActiveShop, isLoading } = useActiveShop()

  if (isLoading || !activeShop) return null
  if (shops.length === 1) {
    return (
      <Typography.Text type="secondary" className="hidden items-center gap-1 sm:inline-flex">
        <ShopOutlined /> {activeShop.name}
      </Typography.Text>
    )
  }
  return (
    <Select
      value={activeShop.id}
      onChange={setActiveShop}
      options={shops.map((shop) => ({ value: shop.id, label: shop.name }))}
      suffixIcon={<ShopOutlined />}
      className="hidden w-44 sm:block"
      aria-label="Boutique active"
    />
  )
}

interface NavLink {
  path: string
  label: string
  icon: ReactNode
  /** Absente : visible par tout membre */
  permission?: Permission
}

// Menu latéral, par grands domaines. Chaque module ajoutera ses écrans ici.
const NAVIGATION: { group: string | null; links: NavLink[] }[] = [
  {
    group: null,
    links: [
      { path: '/', label: 'Tableau de bord', icon: <DashboardOutlined /> },
      { path: '/reports', label: 'Rapports', icon: <BarChartOutlined />, permission: 'reports.view' },
    ],
  },
  {
    group: 'Caisse',
    links: [
      { path: '/pos', label: 'Caisse', icon: <ShoppingCartOutlined />, permission: 'sales.create' },
      { path: '/pos/sales', label: 'Historique de caisse', icon: <CreditCardOutlined />, permission: 'sales.create' },
    ],
  },
  {
    group: 'Clients et finances',
    links: [
      { path: '/customers', label: 'Clients', icon: <SolutionOutlined />, permission: 'customers.manage' },
      { path: '/debtors', label: 'Impayés', icon: <DollarOutlined />, permission: 'reports.view' },
      { path: '/expenses', label: 'Dépenses', icon: <WalletOutlined />, permission: 'expenses.manage' },
    ],
  },
  {
    group: 'Catalogue',
    links: [
      { path: '/products', label: 'Produits', icon: <AppstoreOutlined />, permission: 'products.view' },
      { path: '/categories', label: 'Catégories', icon: <FolderOutlined />, permission: 'products.view' },
      { path: '/units', label: 'Unités', icon: <ColumnWidthOutlined />, permission: 'products.view' },
      { path: '/suppliers', label: 'Fournisseurs', icon: <TruckOutlined />, permission: 'products.view' },
    ],
  },
  {
    group: 'Stock',
    links: [
      { path: '/stock', label: 'Niveaux de stock', icon: <DatabaseOutlined />, permission: 'stock.view' },
      { path: '/stock/movements', label: 'Mouvements', icon: <HistoryOutlined />, permission: 'stock.view' },
      { path: '/stock/adjustments', label: 'Ajustements', icon: <SlidersOutlined />, permission: 'stock.view' },
      { path: '/stock/transfers', label: 'Transferts', icon: <SendOutlined />, permission: 'stock.view' },
      { path: '/stock/inventories', label: 'Inventaires', icon: <CarryOutOutlined />, permission: 'stock.view' },
    ],
  },
  {
    group: 'Achats',
    links: [
      { path: '/purchases/orders', label: 'Bons de commande', icon: <FileTextOutlined />, permission: 'purchases.manage' },
      { path: '/purchases/receipts', label: 'Réceptions', icon: <InboxOutlined />, permission: 'purchases.manage' },
      { path: '/purchases/returns', label: 'Retours fournisseurs', icon: <RollbackOutlined />, permission: 'purchases.manage' },
      { path: '/purchases/invoices', label: 'Factures et paiements', icon: <FileDoneOutlined />, permission: 'supplier_payments.manage' },
    ],
  },
  {
    group: 'Administration',
    links: [
      { path: '/members', label: 'Équipe', icon: <TeamOutlined />, permission: 'users.manage' },
      { path: '/roles', label: 'Rôles', icon: <SafetyOutlined />, permission: 'roles.manage' },
      { path: '/settings', label: 'Paramètres', icon: <SettingOutlined />, permission: 'company.manage' },
      { path: '/audit', label: 'Journal d’audit', icon: <AuditOutlined />, permission: 'audit.view' },
    ],
  },
]

/** Lien actif : le plus long chemin qui commence l'URL (/settings reste actif sur /settings?onglet=…). */
function selectedKey(pathname: string, paths: string[]): string {
  return (
    paths
      .filter((path) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)))
      .sort((a, b) => b.length - a.length)[0] ?? ''
  )
}

export function AppLayout() {
  const { user, companies, activeCompany, can, switchCompany, logout } = useAuth()
  const { message } = App.useApp()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)

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
  const visibleGroups = NAVIGATION.map((section) => ({
    ...section,
    links: section.links.filter((link) => !link.permission || can(link.permission)),
  })).filter((section) => section.links.length > 0)

  type MenuItem = NonNullable<MenuProps['items']>[number]
  const toItem = (link: NavLink): MenuItem => ({ key: link.path, icon: link.icon, label: <Link to={link.path}>{link.label}</Link> })
  const menuItems = visibleGroups.flatMap<MenuItem>((section) =>
    section.group
      ? [{ type: 'group', key: section.group, label: section.group, children: section.links.map(toItem) }]
      : section.links.map(toItem),
  )
  const allPaths = visibleGroups.flatMap((section) => section.links.map((link) => link.path))

  const userMenu: MenuProps['items'] = [
    { key: 'account', icon: <UserOutlined />, label: <Link to="/account">Mon compte</Link> },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Se déconnecter', danger: true, onClick: () => void logout() },
  ]

  return (
    <Layout className="min-h-full">
      <Sider theme="light" width={232} breakpoint="lg" collapsedWidth={0} className="border-r border-slate-200">
        <Link to="/" className="flex h-16 items-center px-6 text-lg font-bold text-brand">
          StockPro
        </Link>
        <Menu mode="inline" selectedKeys={[selectedKey(pathname, allPaths)]} items={menuItems} className="border-e-0" />
      </Sider>
      <Layout>
        <Header className="flex items-center justify-end gap-3 bg-white px-6 shadow-sm">
          {companies.length > 1 ? (
            <Select
              value={activeCompany?.id}
              onChange={handleSwitch}
              loading={switching}
              disabled={switching}
              options={companies.map((company) => ({ value: company.id, label: company.name }))}
              suffixIcon={<BankOutlined />}
              className="hidden w-48 sm:block"
              aria-label="Entreprise active"
            />
          ) : (
            <Typography.Text type="secondary" className="hidden items-center gap-1 sm:inline-flex">
              <BankOutlined /> {activeCompany?.name}
            </Typography.Text>
          )}
          <ShopSelector />
          <Dropdown menu={{ items: userMenu }} trigger={['click']}>
            <Button type="text" className="flex items-center gap-2" aria-label="Menu utilisateur">
              <Avatar size="small" icon={<UserOutlined />} />
              <span className="hidden sm:inline">{user?.name}</span>
              <DownOutlined className="text-xs" />
            </Button>
          </Dropdown>
        </Header>
        <Content className="p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
