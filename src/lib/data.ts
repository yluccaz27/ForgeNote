import { QueryClient, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Backend, Match } from './backend'
import { PK, TABLES, type Row, type TableName } from './types'
import { toastErro, useUI } from '../store/ui'

export const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 } },
})

let backend: Backend | null = null
export const setBackend = (b: Backend | null) => { backend = b; qc.clear() }
export const getBackend = () => { if (!backend) throw new Error('sem backend'); return backend }

const key = (t: TableName) => ['t', t] as const

export function useTable<T extends TableName>(t: T): Row<T>[] {
  const q = useQuery({ queryKey: key(t), queryFn: () => getBackend().select(t) })
  return (q.data as Row<T>[] | undefined) ?? EMPTY
}
const EMPTY: never[] = []

export function useTableLoading() {
  const q = useQuery({ queryKey: key('notes'), queryFn: () => getBackend().select('notes') })
  return q.isLoading
}

/** Tabelas com workspace_id, já filtradas pelo workspace ativo. */
export function useWsTable<T extends 'notes' | 'gaveteiros' | 'predefinicoes' | 'quadros' | 'calendarios' | 'timelines'>(t: T): Row<T>[] {
  const rows = useTable(t)
  const ws = useUI((s) => s.wsId)
  return useMemo(() => rows.filter((r: any) => r.workspace_id === ws), [rows, ws])
}

// ───────── escrita otimista, em fila ─────────
// A fila garante a ordem (note antes das abas, abas antes dos campos)
// para não violar FKs no Postgres.
let fila: Promise<unknown> = Promise.resolve()
function enfileirar(fn: () => Promise<void>) {
  const p = fila.then(fn).catch((e: Error) => {
    const offline = !navigator.onLine || /fetch|network/i.test(e.message)
    toastErro(offline
      ? 'Não foi possível salvar: sem conexão com o servidor. Recarregue quando a conexão voltar para ver o estado salvo.'
      : `Não foi possível salvar: ${e.message}`)
    TABLES.forEach((t) => qc.invalidateQueries({ queryKey: key(t) }))
  })
  fila = p
  return p
}

const matches = (row: any, m: Match) =>
  Object.entries(m).every(([k, v]) => (Array.isArray(v) ? v.includes(row[k]) : row[k] === v))
const pkOf = (t: TableName, r: any) => (PK[t] as string[]).map((k) => r[k]).join('|')

function patchCache<T extends TableName>(t: T, fn: (rows: Row<T>[]) => Row<T>[]) {
  qc.setQueryData(key(t), (old: Row<T>[] | undefined) => fn(old ?? []))
}

/** Lê a tabela do cache (fora de componentes). */
export function cache<T extends TableName>(t: T): Row<T>[] {
  return (qc.getQueryData(key(t)) as Row<T>[] | undefined) ?? []
}
export async function ensure<T extends TableName>(t: T): Promise<Row<T>[]> {
  return qc.ensureQueryData({ queryKey: key(t), queryFn: () => getBackend().select(t) }) as Promise<Row<T>[]>
}

export const write = {
  insert<T extends TableName>(t: T, rows: Row<T>[]) {
    if (!rows.length) return Promise.resolve()
    patchCache(t, (old) => [...old, ...rows])
    return enfileirar(() => getBackend().insert(t, rows))
  },
  update<T extends TableName>(t: T, match: Match, patch: Partial<Row<T>>) {
    patchCache(t, (old) => old.map((r) => (matches(r, match) ? { ...r, ...patch } : r)))
    return enfileirar(() => getBackend().update(t, match, patch))
  },
  upsert<T extends TableName>(t: T, rows: Row<T>[]) {
    if (!rows.length) return Promise.resolve()
    patchCache(t, (old) => {
      const out = [...old]
      for (const r of rows) {
        const i = out.findIndex((x) => pkOf(t, x) === pkOf(t, r))
        if (i >= 0) out[i] = { ...out[i], ...r }
        else out.push(r)
      }
      return out
    })
    return enfileirar(() => getBackend().upsert(t, rows))
  },
  remove<T extends TableName>(t: T, match: Match) {
    patchCache(t, (old) => old.filter((r) => !matches(r, match)))
    return enfileirar(async () => {
      await getBackend().remove(t, match)
      // cascatas do servidor: recarrega o resto
      TABLES.filter((x) => x !== t).forEach((x) => qc.invalidateQueries({ queryKey: key(x) }))
    })
  },
}

export const uid = () => crypto.randomUUID()

export function invalidarTabela(t: string) {
  if ((TABLES as string[]).includes(t)) qc.invalidateQueries({ queryKey: ['t', t] })
}
