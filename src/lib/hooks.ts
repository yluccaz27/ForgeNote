import { useEffect, useMemo, useRef, useState } from 'react'
import { useTable, useWsTable } from './data'
import { CALENDARIO_PADRAO } from './calendar'
import type { CalendarioConfig } from './types'

/** Calendário do workspace (ou o de uma timeline). */
export function useCalendario(id?: string | null): CalendarioConfig {
  const cals = useWsTable('calendarios')
  const c = (id && cals.find((x) => x.id === id)) || cals[0]
  return c?.config_json ?? CALENDARIO_PADRAO
}

/** Popover simples: fecha com clique fora ou Esc. */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false) } }
    document.addEventListener('mousedown', fora)
    window.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('keydown', esc, true) }
  }, [aberto])
  return { aberto, setAberto, ref }
}

export function useNote(id: string | null | undefined) {
  const notes = useTable('notes')
  return id ? notes.find((n) => n.id === id) : undefined
}

/** noteId → caminho da primeira imagem preenchida (miniatura do papel). */
export function useMiniaturas(): Map<string, string> {
  const abas = useTable('note_abas')
  const campos = useTable('note_campos')
  const valores = useTable('note_valores')
  return useMemo(() => {
    const abaNote = new Map(abas.map((a) => [a.id, a.note_id]))
    const campoNote = new Map(campos.filter((c) => c.tipo === 'imagem').map((c) => [c.id, abaNote.get(c.aba_id)]))
    const out = new Map<string, string>()
    for (const v of valores) {
      const n = campoNote.get(v.campo_id)
      if (n && typeof v.valor_json === 'string' && v.valor_json && !out.has(n)) out.set(n, v.valor_json)
    }
    return out
  }, [abas, campos, valores])
}

export const reduzMovimento = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
