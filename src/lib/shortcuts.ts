import { useEffect, useRef } from 'react'

/**
 * Registro central de atalhos: fonte única da verdade.
 * O painel "Atalhos do teclado" é gerado daqui, e useAtalho só aceita ids
 * deste registro, então nenhum atalho existe sem documentação.
 *
 * - `combo`: o que o ouvinte global escuta. Sem `combo`, o atalho é tratado
 *   no próprio componente (precisa do foco ali) e aqui fica só documentado.
 * - Atalhos de uma tecla não disparam com o foco num campo de texto ou no
 *   editor, nem com um diálogo aberto. `sempre` libera (Ctrl+K).
 */
export type Grupo = 'Geral' | 'Note' | 'Quadro' | 'Timeline'
export const GRUPOS: Grupo[] = ['Geral', 'Note', 'Quadro', 'Timeline']

export interface Atalho {
  grupo: Grupo
  /** cada item é uma combinação; várias combinações aparecem com `sep` entre elas */
  teclas: string[][]
  sep?: string
  descricao: string
  combo?: string[]
  sempre?: boolean
}

export const ATALHOS = {
  'geral.atalhos': { grupo: 'Geral', teclas: [['?']], descricao: 'Abrir esta lista de atalhos', combo: ['?'] },
  'geral.buscar': { grupo: 'Geral', teclas: [['Ctrl', 'K']], descricao: 'Buscar notes', combo: ['mod+k'], sempre: true },
  'geral.criar': { grupo: 'Geral', teclas: [['N']], descricao: 'Criar note', combo: ['n'] },
  'geral.ir': { grupo: 'Geral', teclas: [['Alt', '1'], ['4']], sep: '–', descricao: 'Ir para Note, Gaveteiro, Quadro, Timeline', combo: ['alt+1', 'alt+2', 'alt+3', 'alt+4'] },
  'geral.fechar': { grupo: 'Geral', teclas: [['Esc']], descricao: 'Fechar painel, diálogo ou menu' },
  'note.guardar': { grupo: 'Note', teclas: [['G']], descricao: 'Guardar em pasta', combo: ['g'] },
  'note.renomear': { grupo: 'Note', teclas: [['F2']], descricao: 'Renomear seção selecionada' },
  'note.reordenar': { grupo: 'Note', teclas: [['Alt', '←', '→']], descricao: 'Reordenar seções' },
  'quadro.navegar': { grupo: 'Quadro', teclas: [['Tab'], ['Shift', 'Tab']], sep: '/', descricao: 'Ir para o próximo / anterior papel' },
  'quadro.abrir': { grupo: 'Quadro', teclas: [['Enter']], descricao: 'Abrir o papel selecionado' },
  'quadro.mover': { grupo: 'Quadro', teclas: [['Setas']], descricao: 'Mover papel 8px (Shift = 32px)' },
  'quadro.foco': { grupo: 'Quadro', teclas: [['F']], descricao: 'Modo foco no papel selecionado', combo: ['f'] },
  'timeline.zoom': { grupo: 'Timeline', teclas: [['Ctrl', 'rolar']], descricao: 'Zoom no ponto do cursor' },
  'timeline.zoomTeclas': { grupo: 'Timeline', teclas: [['+'], ['−']], sep: '/', descricao: 'Aproximar / afastar', combo: ['+', '=', '-'] },
  'timeline.recolher': { grupo: 'Timeline', teclas: [['Esc']], descricao: 'Recolher o evento aberto' },
} as const satisfies Record<string, Atalho>

export type AtalhoId = keyof typeof ATALHOS
type Handler = (e: KeyboardEvent, combo: string) => void

export const ehMac = typeof navigator !== 'undefined'
  && /mac|iphone|ipad/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '')

/** Rótulo da tecla na plataforma: ⌘ e ⌥ no macOS. */
export function nomeTecla(t: string) {
  if (t === 'Ctrl') return ehMac ? '⌘' : 'Ctrl'
  if (t === 'Alt') return ehMac ? '⌥' : 'Alt'
  return t
}

/** Texto curto do atalho para tooltips: "Ctrl+K", "N". */
export function textoAtalho(id: AtalhoId) {
  const a: Atalho = ATALHOS[id]
  return a.teclas.map((c) => c.map(nomeTecla).join('+')).join(a.sep ? ` ${a.sep} ` : ' ')
}
/** Tooltip no formato "Criar note (N)". */
export const dica = (id: AtalhoId, rotulo?: string) => `${rotulo ?? ATALHOS[id].descricao} (${textoAtalho(id)})`

export const digitando = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}

function casa(combo: string, e: KeyboardEvent) {
  const partes = combo.split('+')
  const tecla = partes.pop() || '+'
  const mod = partes.includes('mod'), alt = partes.includes('alt')
  if (mod !== (e.ctrlKey || e.metaKey) || alt !== e.altKey) return false
  if (/^\d$/.test(tecla)) return e.code === `Digit${tecla}` || e.code === `Numpad${tecla}`
  // "?" muda de lugar conforme o teclado (no ABNT2 é Shift + a tecla ao lado do Shift direito)
  if (tecla === '?') return e.key === '?' || (e.shiftKey && (e.code === 'Slash' || e.code === 'IntlRo'))
  if (tecla === '+' || tecla === '=' || tecla === '-') return e.key === tecla
  return !e.shiftKey && e.key.toLowerCase() === tecla
}

const handlers = new Map<AtalhoId, Handler[]>()

/** Liga um atalho do registro enquanto o componente estiver montado. */
export function useAtalho(id: AtalhoId, fn: Handler, ativo = true) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!ativo) return
    const h: Handler = (e, c) => ref.current(e, c)
    const lista = handlers.get(id) ?? []
    lista.push(h)
    handlers.set(id, lista)
    return () => { const l = handlers.get(id); if (l) l.splice(l.indexOf(h), 1) }
  }, [id, ativo])
}

/** Ouvinte global único. Chamado uma vez pelo Shell. */
export function ouvirAtalhos() {
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.repeat) return
    for (const [id, a] of Object.entries(ATALHOS) as [AtalhoId, Atalho][]) {
      const combo = a.combo?.find((c) => casa(c, e))
      if (!combo) continue
      const lista = handlers.get(id)
      if (!lista?.length) continue
      if (!a.sempre && (digitando(e) || document.querySelector('[role="dialog"]'))) continue
      e.preventDefault()
      lista[lista.length - 1](e, combo)
      return
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
