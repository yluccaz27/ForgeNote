// Tipos das linhas do banco. Espelham supabase/migrations.
// Depois de criar o projeto, `npm run gen:types` gera database.types.ts oficial.

export type TipoCampo = 'texto' | 'numero' | 'data' | 'selecao' | 'relacao' | 'imagem'

export interface Workspace { id: string; nome: string; created_at?: string }
export interface WorkspaceMember { workspace_id: string; user_id: string; papel: string }

export interface Gaveteiro {
  id: string; workspace_id: string; nome: string; cor: string; icone: string
  capa_url: string | null; ordem: number; deleted_at?: string | null
}
export interface Pasta {
  id: string; gaveteiro_id: string; nome: string; cor: string | null
  origem: 'manual' | 'regra'; regra_campo_id: string | null
  regra_valor_note_id: string | null; regra_valor_texto: string | null; deleted_at?: string | null
}
export interface Note {
  id: string; workspace_id: string; predefinicao_id: string | null
  titulo: string; titulo_provisorio: boolean
  /** título acompanha o primeiro campo Nome (padrão em note novo) */
  titulo_ligado?: boolean
  deleted_at?: string | null
  resumo: string; resumo_provisorio: boolean
  corpo_json: unknown | null
  created_by?: string | null; updated_by?: string | null
  created_at?: string; updated_at?: string
}
export interface NotePasta { note_id: string; pasta_id: string }

export interface Predefinicao { id: string; workspace_id: string; nome: string; icone: string; deleted_at?: string | null }
export interface PredefAba { id: string; predefinicao_id: string; nome: string; ordem: number }
export interface PredefCampo {
  id: string; aba_id: string; nome: string; tipo: TipoCampo
  config_json: CampoConfig; ordem: number; organiza_pasta: boolean
}

export interface NoteAba { id: string; note_id: string; nome: string; ordem: number }
export interface NoteCampo {
  id: string; aba_id: string; nome: string; tipo: TipoCampo
  config_json: CampoConfig; ordem: number; organiza_pasta: boolean
}
export interface NoteValor { id: string; campo_id: string; valor_json: unknown }

export interface CampoConfig {
  opcoes?: string[]            // selecao
  multiplo?: boolean           // selecao / relacao
  predefinicoes?: string[]     // relacao: filtro por predefinição
  pastas?: string[]            // relacao: filtro por pasta
  marco?: boolean              // data: vira evento na trilha do note
}

export interface Quadro { id: string; workspace_id: string; nome: string; filtro_json: { gaveteiros: string[]; pastas: string[] }; deleted_at?: string | null }
export interface QuadroPosicao { quadro_id: string; note_id: string; x: number; y: number; oculto: boolean }
export interface Conexao {
  id: string; origem_note_id: string; destino_note_id: string
  rotulo: string; tipo: 'manual' | 'campo'; campo_id: string | null
  /** conexão manual: quadro onde foi puxada */
  quadro_id?: string | null
}
export interface QuadroConexaoOculta { quadro_id: string; conexao_id: string }

export interface Era { nome: string; sigla: string; ano_inicial: number; para_tras: boolean }
export interface Mes { nome: string; dias: number }
export interface CalendarioConfig { eras: Era[]; meses: Mes[]; semana: string[] }
export interface Calendario { id: string; workspace_id: string; nome: string; config_json: CalendarioConfig; deleted_at?: string | null }
export interface Timeline { id: string; workspace_id: string; nome: string; calendario_id: string | null; deleted_at?: string | null }
export interface Trilha {
  id: string; timeline_id: string; nome: string; cor: string | null
  ordem: number; note_id: string | null; recolhida: boolean; deleted_at?: string | null
}
export interface DiaJson { dia: number }
export interface EventoTimeline {
  id: string; timeline_id: string; trilha_id: string; note_id: string
  inicio_json: DiaJson; fim_json: DiaJson | null; expandido: boolean
}

export interface Tables {
  workspaces: Workspace
  workspace_members: WorkspaceMember
  gaveteiros: Gaveteiro
  pastas: Pasta
  notes: Note
  note_pasta: NotePasta
  predefinicoes: Predefinicao
  predef_abas: PredefAba
  predef_campos: PredefCampo
  note_abas: NoteAba
  note_campos: NoteCampo
  note_valores: NoteValor
  quadros: Quadro
  quadro_posicoes: QuadroPosicao
  conexoes: Conexao
  quadro_conexoes_ocultas: QuadroConexaoOculta
  calendarios: Calendario
  timelines: Timeline
  trilhas: Trilha
  eventos_timeline: EventoTimeline
}
export type TableName = keyof Tables
export type Row<T extends TableName> = Tables[T]

/** Chave primária de cada tabela (compostas nas tabelas de ligação). */
export const PK: { [K in TableName]: (keyof Tables[K])[] } = {
  workspaces: ['id'],
  workspace_members: ['workspace_id', 'user_id'],
  gaveteiros: ['id'],
  pastas: ['id'],
  notes: ['id'],
  note_pasta: ['note_id', 'pasta_id'],
  predefinicoes: ['id'],
  predef_abas: ['id'],
  predef_campos: ['id'],
  note_abas: ['id'],
  note_campos: ['id'],
  note_valores: ['id'],
  quadros: ['id'],
  quadro_posicoes: ['quadro_id', 'note_id'],
  conexoes: ['id'],
  quadro_conexoes_ocultas: ['quadro_id', 'conexao_id'],
  calendarios: ['id'],
  timelines: ['id'],
  trilhas: ['id'],
  eventos_timeline: ['id'],
}

export const TABLES = Object.keys(PK) as TableName[]

/** Tabelas com lixeira (deleted_at): excluir = guardar por 30 dias, com Desfazer. */
export const COM_LIXEIRA = ['notes', 'gaveteiros', 'pastas', 'quadros', 'calendarios', 'timelines', 'trilhas', 'predefinicoes'] as const satisfies readonly TableName[]
export type TabelaLixeira = (typeof COM_LIXEIRA)[number]
