import { ConfigProvider } from 'antd'
import frFR from 'antd/locale/fr_FR'
import { useEffect, type ReactNode } from 'react'
import { DEFAULT_BRAND_COLOR, isReadableBrandColor } from '../lib/brand'
import { useAppSelector } from '../store/hooks'
import { selectActiveCompany } from '../store/authSlice'

/**
 * Thème antd (en français) aux couleurs de l'entreprise active ; couleur StockPro sur les pages
 * de connexion (aucune entreprise encore) ou si la couleur reçue est illisible.
 */
export function BrandTheme({ children }: { children: ReactNode }) {
  const brandColor = useAppSelector(selectActiveCompany)?.brandColor
  const primary = brandColor && isReadableBrandColor(brandColor) ? brandColor : DEFAULT_BRAND_COLOR

  // Couleur Tailwind « brand » (logo du menu) : variable CSS de la page
  useEffect(() => {
    document.documentElement.style.setProperty('--color-brand', primary)
  }, [primary])

  return (
    <ConfigProvider locale={frFR} theme={{ token: { colorPrimary: primary, borderRadius: 8 } }}>
      {children}
    </ConfigProvider>
  )
}
