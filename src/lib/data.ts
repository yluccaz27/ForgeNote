import { QueryClient, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Backend, Match } from './backend'
import { COM_LIXEIRA, PK, TABLES, type Row, type TableName, type TabelaLixeira } from './types'
import { toastErro, useUI } from '../store/ui'

export const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: 1 } },
})

let backend: Backend | null = null
export const setBackend = (b: Backend | null) => { backend = b; qc.clear() }
export const getBackend = () => { if (!backend) throw new Error('sem backend'); return backend }

const key = (t: TableName) => ['t', t] as const

// A lixeira (deleted_at) fica no cache para o Desfazer, mas fora de todas as leituras.
const LIXEIRA = new Set<TableName>(COM_LIXEIRA)
const filtros = new Map<TableName, (rows: any[]) => any[]>()
const semLixo = (t: TableName) => {
  let f = filtros.get(t)
  if (!f) {
    let ultimo: any[] | null = null, saida: any[] = []
    // memoizado por referência: a mesma lista de entrada devolve a mesma lista de saída
    f = (rows) => { if (rows !== ultimo) { ultimo = rows; saida = rows.filter((r) => !r.deleted_at) } return saida }
    filtros.set(t, f)
  }
  return f
}

export function useTable<T extends TableName>(t: T): Row<T>[] {
  const q = useQuery({
    queryKey: key(t), queryFn: () => getBackend().select(t),
    select: LIXEIRA.has(t) ? (semLixo(t) as (r: unknown) => Row<T>[]) : undefined,
  })
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
let naFila = 0
// Recarregar uma tabela no meio da fila traria de volta o que uma escrita
// seguinte ainda vai apagar. As recargas esperam a fila esvaziar.
const recarregar = new Set<TableName>()
function pedirRecarga(ts: TableName[]) {
  ts.forEach((t) => recarregar.add(t))
  if (naFila === 0) descarregar()
}
function descarregar() {
  const ts = [...recarregar]
  recarregar.clear()
  ts.forEach((t) => qc.invalidateQueries({ queryKey: key(t) }))
}
function enfileirar(fn: () => Promise<void>) {
  naFila++
  const p = fila.then(fn).catch((e: Error) => {
    const offline = !navigator.onLine || /fetch|network/i.test(e.message)
    toastErro(offline
      ? 'Não foi possível salvar: sem conexão com o servidor. Recarregue quando a conexão voltar para ver o estado salvo.'
      : `Não foi possível salvar: ${e.message}`)
    TABLES.forEach((t) => recarregar.add(t))
  }).finally(() => { if (--naFila === 0) descarregar() })
  fila = p
  return p
}

const matches = (row: any, m: Match) =>
  Object.entries(m).every(([k, v]) => (Array.isArray(v) ? v.includes(row[k]) : row[k] === v))
const pkOf = (t: TableName, r: any) => (PK[t] as string[]).map((k) => r[k]).join('|')

function patchCache<T extends TableName>(t: T, fn: (rows: Row<T>[]) => Row<T>[]) {
  qc.setQueryData(key(t), (old: Row<T>[] | undefined) => fn(old ?? []))
}

/** Lê a tabela do cache (fora de componentes), sem a lixeira. */
export function cache<T extends TableName>(t: T): Row<T>[] {
  const rows = (qc.getQueryData(key(t)) as Row<T>[] | undefined) ?? []
  return LIXEIRA.has(t) ? semLixo(t)(rows) : rows
}
/** Inclui o que está na lixeira. */
export function cacheComLixo<T extends TableName>(t: T): Row<T>[] {
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
      // cascatas do servidor: recarrega o resto (quando a fila esvaziar)
      pedirRecarga(TABLES.filter((x) => x !== t))
    })
  },
  /** Manda para a lixeira (some das leituras; Desfazer restaura). */
  lixeira(t: TabelaLixeira, ids: string[], quando = new Date().toISOString()) {
    if (!ids.length) return Promise.resolve()
    return write.update(t, { id: ids }, { deleted_at: quando } as never)
  },
  restaurar(t: TabelaLixeira, ids: string[]) {
    if (!ids.length) return Promise.resolve()
    return write.update(t, { id: ids }, { deleted_at: null } as never)
  },
}

/** Ao abrir: apaga de vez o que está na lixeira há mais de 30 dias. */
export function limparLixeira() {
  enfileirar(() => getBackend().limparLixeira())
}

export const uid = () => crypto.randomUUID()

export function invalidarTabela(t: string) {
  if ((TABLES as string[]).includes(t)) pedirRecarga([t as TableName])
}
