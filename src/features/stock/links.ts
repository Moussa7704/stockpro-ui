/** Journal des mouvements filtré sur un produit (le nom s'affiche dans le filtre). */
export const movementsLink = (productId: string, productName: string) =>
  `/stock/movements?${new URLSearchParams({ productId, produit: productName }).toString()}`
