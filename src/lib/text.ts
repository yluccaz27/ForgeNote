/** Texto puro de um documento TipTap, um bloco por linha. */
export function docText(json: unknown): string {
  const out: string[] = []
  const walk = (n: any, buf: string[]) => {
    if (!n) return
    if (n.type === 'text') { buf.push(n.text ?? ''); return }
    if (n.type === 'hardBreak') { buf.push('\n'); return }
    if (Array.isArray(n.content)) {
      const isBlock = ['paragraph', 'heading', 'blockquote', 'listItem', 'codeBlock'].includes(n.type)
      if (isBlock) {
        const inner: string[] = []
        n.content.forEach((c: any) => walk(c, inner))
        out.push(inner.join(''))
      } else n.content.forEach((c: any) => walk(c, buf))
    }
  }
  walk(json, [])
  return out.join('\n')
}

export function cortar(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:!?…]+$/, '') + '…'
}

/** Primeira linha do texto, até ~40 caracteres. */
export function tituloDoTexto(texto: string) {
  const linha = texto.split('\n').map((l) => l.trim()).find(Boolean)
  return linha ? cortar(linha.replace(/\[\[|\]\]/g, ''), 40) : ''
}

/** As 1 ou 2 primeiras frases, até ~160 caracteres. */
export function resumoDoTexto(texto: string) {
  const corrido = texto.replace(/\s+/g, ' ').replace(/\[\[|\]\]/g, '').trim()
  if (!corrido) return ''
  const frases = corrido.match(/[^.!?…]+[.!?…]+/g) ?? [corrido]
  let r = frases[0].trim()
  if (frases[1] && (r + ' ' + frases[1].trim()).length <= 160) r += ' ' + frases[1].trim()
  return cortar(r, 160)
}

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
