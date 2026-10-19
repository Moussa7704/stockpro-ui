import {
  AppstoreOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  TagsOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import { Card } from 'antd'
import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { PageSuspense } from '../components/PageSuspense'

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <ShoppingCartOutlined />, title: 'Caisse rapide', text: 'Scan des articles, tickets, crédit client' },
  { icon: <DatabaseOutlined />, title: 'Stock par boutique', text: 'Transferts, inventaires, alertes de rupture' },
  { icon: <TruckOutlined />, title: 'Achats et fournisseurs', text: 'Commandes, réceptions, dettes fournisseurs' },
  { icon: <SolutionOutlined />, title: 'Clients et crédits', text: 'Ventes à crédit, règlements, relevés' },
  { icon: <BarChartOutlined />, title: 'Rapports', text: 'Chiffre d’affaires, marges, exports Excel et PDF' },
]

/** Motif de fond : grandes icônes de commerce très atténuées (décoratives). */
const BACKGROUND_ICONS = [
  { icon: <ShoppingCartOutlined />, className: '-right-10 top-10 text-[11rem] rotate-12' },
  { icon: <TagsOutlined />, className: 'right-24 bottom-6 text-[8rem] -rotate-12' },
  { icon: <AppstoreOutlined />, className: '-left-8 bottom-24 text-[7rem] rotate-6' },
]

/**
 * Pages d'accès (connexion, code, mot de passe, choix de l'entreprise) : présentation de
 * StockPro à gauche sur grand écran, formulaire à droite ; sur téléphone, un simple bandeau
 * au-dessus du formulaire. Toujours aux couleurs de StockPro (aucune entreprise choisie ici).
 */
export function AuthLayout() {
  return (
    <main className="flex min-h-dvh flex-col bg-slate-50 lg:flex-row">
      <aside className="relative overflow-hidden bg-linear-to-br from-indigo-600 to-indigo-900 px-6 py-5 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:px-12 lg:py-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden text-white/10 lg:block">
          {BACKGROUND_ICONS.map((item, index) => (
            <span key={index} className={`absolute ${item.className}`}>
              {item.icon}
            </span>
          ))}
        </div>

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl lg:h-12 lg:w-12 lg:text-2xl">
            <ShopOutlined />
          </span>
          <span className="text-2xl font-bold tracking-tight lg:text-3xl">StockPro</span>
        </div>

        <div className="relative hidden lg:block">
          <h1 className="m-0 max-w-md text-3xl leading-tight font-semibold text-white">La gestion de votre boutique, simple et fiable</h1>
          <p className="mt-3 mb-8 max-w-md text-base text-indigo-100">Ventes, stock, achats et clients au même endroit, pour une ou plusieurs boutiques.</p>
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-lg">{feature.icon}</span>
                <span>
                  <span className="block font-semibold">{feature.title}</span>
                  <span className="block text-sm text-indigo-100">{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative m-0 hidden text-sm text-indigo-200 lg:block">Conçu pour les commerçants d’Afrique de l’Ouest</p>
      </aside>

      <section className="flex flex-1 items-start justify-center px-4 py-6 lg:items-center lg:py-12">
        <div className="w-full max-w-md">
          <Card className="shadow-lg">
            <PageSuspense>
              <Outlet />
            </PageSuspense>
          </Card>
        </div>
      </section>
    </main>
  )
}
