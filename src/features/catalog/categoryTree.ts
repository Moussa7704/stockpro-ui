import type { Category } from '../../types/catalog'

export interface CategoryNode extends Category {
  children?: CategoryNode[]
  /** "Boissons › Jus" : chemin complet, pour les listes déroulantes */
  path: string
}

/** Liste à plat (parentId) → arbre trié par nom. Une catégorie dont le parent manque passe à la racine. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byParent = new Map<string | null, Category[]>()
  const ids = new Set(categories.map((category) => category.id))
  for (const category of categories) {
    const parent = category.parentId && ids.has(category.parentId) ? category.parentId : null
    byParent.set(parent, [...(byParent.get(parent) ?? []), category])
  }
  const build = (parentId: string | null, parentPath: string, depth: number): CategoryNode[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
      .map((category) => {
        const path = parentPath ? `${parentPath} › ${category.name}` : category.name
        // Garde-fou : jamais de boucle infinie, même sur des données incohérentes
        const children = depth < 20 ? build(category.id, path, depth + 1) : []
        return { ...category, path, ...(children.length > 0 && { children }) }
      })
  return build(null, '', 0)
}

/** Identifiants d'une catégorie et de toutes ses descendantes (interdites comme nouveau parent). */
export function descendantIds(categories: Category[], rootId: string): Set<string> {
  const result = new Set([rootId])
  let added = true
  while (added) {
    added = false
    for (const category of categories) {
      if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
        result.add(category.id)
        added = true
      }
    }
  }
  return result
}

/** Options pour un TreeSelect antd ; `disabledIds` grisés (soi-même et ses descendants). */
export function toTreeSelectData(
  nodes: CategoryNode[],
  disabledIds: Set<string> = new Set(),
): { value: string; title: string; disabled: boolean; children?: ReturnType<typeof toTreeSelectData> }[] {
  return nodes.map((node) => ({
    value: node.id,
    title: node.name,
    disabled: disabledIds.has(node.id) || node.archivedAt !== null,
    ...(node.children && { children: toTreeSelectData(node.children, disabledIds) }),
  }))
}
