import { describe, expect, it } from 'vitest'
import type { Category } from '../../types/catalog'
import { buildCategoryTree, descendantIds } from './categoryTree'

const category = (id: string, name: string, parentId: string | null = null): Category => ({ id, name, parentId, archivedAt: null })

describe('arbre des catégories', () => {
  it('construit l’arbre trié, avec le chemin complet', () => {
    const tree = buildCategoryTree([category('b', 'Boissons'), category('j', 'Jus', 'b'), category('e', 'Épicerie')])

    expect(tree.map((node) => node.name)).toEqual(['Boissons', 'Épicerie'])
    expect(tree[0]!.children?.[0]).toMatchObject({ name: 'Jus', path: 'Boissons › Jus' })
  })

  it('un parent introuvable (archivé, filtré) remonte la catégorie à la racine', () => {
    expect(buildCategoryTree([category('j', 'Jus', 'absent')]).map((node) => node.name)).toEqual(['Jus'])
  })

  it('descendants : toute la branche, même profonde', () => {
    const all = [category('a', 'A'), category('b', 'B', 'a'), category('c', 'C', 'b'), category('x', 'X')]
    expect([...descendantIds(all, 'a')].sort()).toEqual(['a', 'b', 'c'])
  })

  it('données incohérentes (boucle) : ni plantage ni boucle infinie', () => {
    const loop = [category('a', 'A', 'b'), category('b', 'B', 'a')]
    expect(buildCategoryTree(loop)).toEqual([])
    expect([...descendantIds(loop, 'a')].sort()).toEqual(['a', 'b'])
  })
})
