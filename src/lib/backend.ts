import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { COM_LIXEIRA, PK, type TableName, type Row } from './types'
import { SEED, SEED_USER_ID } from './seedData.ts'

/**
 * Camada de dados genérica. Duas implementações com a mesma interface:
 * - Supabase (produção, RLS no servidor)
 * - Local (localStorage) para testar sem servidor: "modo local".
 * Toda a regra de negócio (pastas por regra, conexões por campo, títulos
 * provisórios) fica no cliente e funciona igual nos dois.
 */
export type Match = Record<string, unknown> // valor array = "in"

export interface Backend {
  kind: 'supabase' | 'local'
  select<T extends TableName>(table: T): Promise<Row<T>[]>
  insert<T extends TableName>(table: T, rows: Partial<Row<T>>[]): Promise<void>
  update<T extends TableName>(table: T, match: Match, patch: Partial<Row<T>>): Promise<void>
  upsert<T extends TableName>(table: T, rows: Partial<Row<T>>[]): Promise<void>
  remove<T extends TableName>(table: T, match: Match): Promise<void>
  uploadImage(workspaceId: string, file: Blob): Promise<string>
  imageUrl(path: string): Promise<string>
  userId(): string | null
  /** apaga de vez a lixeira com mais de 30 dias */
  limparLixeira(): Promise<void>
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabaseConfigured = Boolean(url && anon)
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anon!, { auth: { persistSession: true } })
  : null

function matches(row: Record<string, unknown>, match: Match) {
  return Object.entries(match).every(([k, v]) =>
    Array.isArray(v) ? v.includes(row[k]) : row[k] === v,
  )
}

// ───────────────────────── Supabase ─────────────────────────
function applyMatch<Q extends { eq: Function; in: Function }>(q: Q, match: Match): Q {
  for (const [k, v] of Object.entries(match)) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v)
  return q
}

let currentUserId: string | null = null
export function setCurrentUser(id: string | null) { currentUserId = id }

export function supabaseBackend(sb: SupabaseClient): Backend {
  const check = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message) }
  return {
    kind: 'supabase',
    async select(table) {
      // paginação simples: o mundo de duas pessoas cabe em poucas páginas
      const out: any[] = []
      for (let from = 0; ; from += 1000) {
        const r = await sb.from(table).select('*').range(from, from + 999)
        check(r)
        out.push(...(r.data ?? []))
        if ((r.data ?? []).length < 1000) break
      }
      return out
    },
    async insert(table, rows) { if (rows.length) check(await sb.from(table).insert(rows as any)) },
    async update(table, match, patch) { check(await applyMatch(sb.from(table).update(patch as any) as any, match)) },
    async upsert(table, rows) {
      if (rows.length) check(await sb.from(table).upsert(rows as any, { onConflict: (PK[table] as string[]).join(',') }))
    },
    async remove(table, match) { check(await applyMatch(sb.from(table).delete() as any, match)) },
    async uploadImage(ws, file) {
      const path = `${ws}/${crypto.randomUUID()}.webp`
      const r = await sb.storage.from('imagens').upload(path, file, { contentType: 'image/webp' })
      if (r.error) throw new Error(r.error.message)
      return path
    },
    async imageUrl(path) {
      if (path.startsWith('data:') || path.startsWith('http')) return path
      const r = await sb.storage.from('imagens').createSignedUrl(path, 60 * 60)
      if (r.error) throw new Error(r.error.message)
      return r.data.signedUrl
    },
    userId: () => currentUserId,
    async limparLixeira() {
      // sem a migration v1.1 a função não existe: não é motivo para avisar erro
      await sb.rpc('limpar_lixeira').then(() => undefined, () => undefined)
    },
  }
}

// ───────────────────────── Local ─────────────────────────
const LS_KEY = 'forgenote:db:v1'
type DB = { [K in TableName]?: Row<K>[] }

/** Exclusões em cascata (o Postgres faz via FK; aqui imitamos). */
const CASCADE: Partial<Record<TableName, [TableName, string, 'delete' | 'null'][]>> = {
  workspaces: [['notes', 'workspace_id', 'delete'], ['gaveteiros', 'workspace_id', 'delete'], ['predefinicoes', 'workspace_id', 'delete'], ['quadros', 'workspace_id', 'delete'], ['timelines', 'workspace_id', 'delete'], ['calendarios', 'workspace_id', 'delete']],
  notes: [['note_abas', 'note_id', 'delete'], ['note_pasta', 'note_id', 'delete'], ['conexoes', 'origem_note_id', 'delete'], ['conexoes', 'destino_note_id', 'delete'], ['quadro_posicoes', 'note_id', 'delete'], ['eventos_timeline', 'note_id', 'delete'], ['pastas', 'regra_valor_note_id', 'delete'], ['trilhas', 'note_id', 'null']],
  note_abas: [['note_campos', 'aba_id', 'delete']],
  note_campos: [['note_valores', 'campo_id', 'delete'], ['conexoes', 'campo_id', 'delete']],
  predefinicoes: [['predef_abas', 'predefinicao_id', 'delete'], ['notes', 'predefinicao_id', 'null']],
  predef_abas: [['predef_campos', 'aba_id', 'delete']],
  gaveteiros: [['pastas', 'gaveteiro_id', 'delete']],
  pastas: [['note_pasta', 'pasta_id', 'delete']],
  quadros: [['quadro_posicoes', 'quadro_id', 'delete'], ['quadro_conexoes_ocultas', 'quadro_id', 'delete'], ['conexoes', 'quadro_id', 'null']],
  conexoes: [['quadro_conexoes_ocultas', 'conexao_id', 'delete']],
  timelines: [['trilhas', 'timeline_id', 'delete'], ['eventos_timeline', 'timeline_id', 'delete']],
  trilhas: [['eventos_timeline', 'trilha_id', 'delete']],
  calendarios: [['timelines', 'calendario_id', 'null']],
}

const DEFAULTS: Partial<Record<TableName, Record<string, unknown>>> = {
  notes: { predefinicao_id: null, titulo: 'Sem título', titulo_provisorio: true, titulo_ligado: true, deleted_at: null, resumo: '', resumo_provisorio: true, corpo_json: null },
  pastas: { cor: null, origem: 'manual', regra_campo_id: null, regra_valor_note_id: null, regra_valor_texto: null },
  gaveteiros: { cor: '#2F363B', icone: '▤', capa_url: null, ordem: 0 },
  note_campos: { config_json: {}, ordem: 0, organiza_pasta: false },
  predef_campos: { config_json: {}, ordem: 0, organiza_pasta: false },
  conexoes: { rotulo: '', tipo: 'manual', campo_id: null, quadro_id: null },
  trilhas: { cor: null, ordem: 0, note_id: null, recolhida: false },
  eventos_timeline: { fim_json: null, expandido: false },
  quadro_posicoes: { oculto: false },
}

export function localBackend(): Backend {
  let db: DB
  try { db = JSON.parse(localStorage.getItem(LS_KEY) || 'null') ?? structuredClone(SEED) } catch { db = structuredClone(SEED) }
  const save = () => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(db)) }
    catch { throw new Error('Não foi possível salvar: o armazenamento do navegador está cheio. Remova imagens grandes ou use o Supabase.') }
  }
  save()
  const t = <T extends TableName>(name: T) => (db[name] ??= [] as any) as Row<T>[]
  const key = (table: TableName, r: any) => (PK[table] as string[]).map((k) => r[k]).join('|')
  const now = () => new Date().toISOString()

  function cascade(table: TableName, removed: any[]) {
    for (const [child, col, mode] of CASCADE[table] ?? []) {
      const ids = removed.map((r) => r.id)
      if (!ids.length) continue
      const rows = t(child) as any[]
      if (mode === 'null') rows.forEach((r) => { if (ids.includes(r[col])) r[col] = null })
      else {
        const gone = rows.filter((r) => ids.includes(r[col]))
        if (gone.length) { db[child] = rows.filter((r) => !ids.includes(r[col])) as any; cascade(child, gone) }
      }
    }
  }

  return {
    kind: 'local',
    async select(table) { return structuredClone(t(table)) },
    async insert(table, rows) {
      for (const r of rows) {
        const row: any = { ...DEFAULTS[table], ...r }
        if ((PK[table] as string[])[0] === 'id' && !row.id) row.id = crypto.randomUUID()
        if (table === 'notes') { row.created_at ??= now(); row.updated_at = now(); row.created_by ??= SEED_USER_ID; row.updated_by = SEED_USER_ID }
        t(table).push(row)
      }
      save()
    },
    async update(table, match, patch) {
      t(table).forEach((r: any) => {
        if (matches(r, match)) { Object.assign(r, patch); if (table === 'notes') { r.updated_at = now(); r.updated_by = SEED_USER_ID } }
      })
      save()
    },
    async upsert(table, rows) {
      const list = t(table) as any[]
      for (const r of rows) {
        const i = list.findIndex((x) => key(table, x) === key(table, r))
        if (i >= 0) Object.assign(list[i], r)
        else list.push({ ...DEFAULTS[table], ...r })
      }
      save()
    },
    async remove(table, match) {
      const rows = t(table) as any[]
      const gone = rows.filter((r) => matches(r, match))
      db[table] = rows.filter((r) => !matches(r, match)) as any
      cascade(table, gone)
      save()
    },
    async uploadImage(_ws, file) {
      return await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result as string)
        fr.onerror = () => rej(fr.error)
        fr.readAsDataURL(file)
      })
    },
    async imageUrl(path) { return path },
    userId: () => SEED_USER_ID,
    async limparLixeira() {
      const limite = Date.now() - 30 * 864e5
      for (const table of COM_LIXEIRA) {
        const rows = t(table) as any[]
        const gone = rows.filter((r) => r.deleted_at && Date.parse(r.deleted_at) < limite)
        if (!gone.length) continue
        db[table] = rows.filter((r) => !gone.includes(r)) as any
        cascade(table, gone)
      }
      save()
    },
  }
}

export function resetLocal() { localStorage.removeItem(LS_KEY) }
