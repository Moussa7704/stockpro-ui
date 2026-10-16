/**
 * Impression sans quitter l'écran : le contenu est placé dans un cadre invisible, imprimé,
 * puis retiré. Sert au ticket de caisse (texte 42 colonnes) et aux relevés (HTML simple).
 */
function printInFrame(title: string, fill: (doc: Document) => void) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position: fixed; width: 0; height: 0; border: 0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) return
  doc.title = title
  fill(doc)
  frame.contentWindow?.focus()
  frame.contentWindow?.print()
  setTimeout(() => frame.remove(), 1000)
}

/** Texte à chasse fixe (ticket pour imprimante thermique 80 mm). */
export function printText(text: string, title: string) {
  printInFrame(title, (doc) => {
    const pre = doc.createElement('pre')
    pre.textContent = text
    pre.style.cssText = 'font: 12px/1.3 monospace; margin: 0; white-space: pre;'
    doc.body.style.margin = '4mm'
    doc.body.appendChild(pre)
  })
}

/** Document A4 : titre, lignes d'en-tête et un tableau (relevé de compte…). Le contenu est échappé. */
export function printTable(options: { title: string; subtitle: string[]; headers: string[]; rows: string[][]; footer?: string[][]; alignRight?: number[] }) {
  printInFrame(options.title, (doc) => {
    const style = doc.createElement('style')
    style.textContent = `
      body { font: 12px/1.4 system-ui, sans-serif; margin: 12mm; color: #111; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p { margin: 0; color: #555; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border-bottom: 1px solid #ddd; padding: 4px 6px; text-align: left; }
      th { background: #f1f5f9; }
      tfoot td { font-weight: 600; border-top: 2px solid #333; }
      .right { text-align: right; }`
    doc.head.appendChild(style)
    const h1 = doc.createElement('h1')
    h1.textContent = options.title
    doc.body.appendChild(h1)
    for (const line of options.subtitle) {
      const p = doc.createElement('p')
      p.textContent = line
      doc.body.appendChild(p)
    }
    const table = doc.createElement('table')
    const addRow = (parent: HTMLElement, cells: string[], tag: 'th' | 'td') => {
      const tr = doc.createElement('tr')
      cells.forEach((cell, index) => {
        const element = doc.createElement(tag)
        element.textContent = cell
        if (options.alignRight?.includes(index)) element.className = 'right'
        tr.appendChild(element)
      })
      parent.appendChild(tr)
    }
    const thead = doc.createElement('thead')
    addRow(thead, options.headers, 'th')
    const tbody = doc.createElement('tbody')
    options.rows.forEach((row) => addRow(tbody, row, 'td'))
    table.append(thead, tbody)
    if (options.footer) {
      const tfoot = doc.createElement('tfoot')
      options.footer.forEach((row) => addRow(tfoot, row, 'td'))
      table.appendChild(tfoot)
    }
    doc.body.appendChild(table)
  })
}
