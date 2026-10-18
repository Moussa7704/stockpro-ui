import { Spin } from 'antd'
import { Suspense, type ReactNode } from 'react'

/**
 * Pendant le téléchargement d'un écran (chargé à la demande), un indicateur occupe la zone de
 * contenu : l'en-tête et le menu restent affichés et utilisables.
 */
export function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16" role="status" aria-label="Chargement de la page">
          <Spin size="large" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
