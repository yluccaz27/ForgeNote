import { cache, write } from './data'
import { removerAba, removerCampo, sincronizarPastas } from './domain'
import { toastDesfazer } from '../store/ui'
import type { Conexao, NoteAba, NoteCampo, NoteValor, Pasta, QuadroConexaoOculta } from './types'

/**
 * Exclusões do app inteiro, todas com "Desfazer" (8s).
 * Tabelas com lixeira usam deleted_at (limpeza definitiva em 30 dias).
 * O resto (seção, campo, evento) guarda uma cópia e a reinsere ao desfazer.
 */

export function excluirNote(noteId: string) {
  const n = cache('notes').find((x) => x.id === noteId)
  if (!n) return
  // pastas automáticas que existiam por causa deste note saem junto
  const regra = cache('pastas').filter((p) => p.regra_valor_note_id === noteId).map((p) => p.id)
  const quando = new Date().toISOString()
  write.lixeira('notes', [noteId], quando)
  write.lixeira('pastas', regra, quando)
  toastDesfazer('Note excluído.', () => { write.restaurar('notes', [noteId]); write.restaurar('pastas', regra) })
}

export function excluirGaveteiro(gavId: string) {
  const pastas = cache('pastas').filter((p) => p.gaveteiro_id === gavId).map((p) => p.id)
  const quando = new Date().toISOString()
  write.lixeira('gaveteiros', [gavId], quando)
  write.lixeira('pastas', pastas, quando)
  toastDesfazer('Gaveteiro excluído.', () => { write.restaurar('gaveteiros', [gavId]); write.restaurar('pastas', pastas) })
}

export function excluirPasta(p: Pasta) {
  write.lixeira('pastas', [p.id])
  toastDesfazer('Pasta excluída.', () => write.restaurar('pastas', [p.id]))
}

/** Conexões manuais puxadas neste quadro. */
export const manuaisDoQuadro = (quadroId: string) => cache('conexoes').filter((c) => c.tipo === 'manual' && c.quadro_id === quadroId)

export function excluirQuadro(quadroId: string, comManuais: boolean) {
  const manuais: Conexao[] = comManuais ? manuaisDoQuadro(quadroId) : []
  write.lixeira('quadros', [quadroId])
  if (manuais.length) write.remove('conexoes', { id: manuais.map((c) => c.id) })
  toastDesfazer('Quadro excluído.', () => {
    write.restaurar('quadros', [quadroId])
    write.insert('conexoes', manuais)
  })
}

/** Calendário em uso: as timelines passam para `trocarPara` antes. */
export function excluirCalendario(calId: string, trocarPara: string | null) {
  const usam = cache('timelines').filter((t) => t.calendario_id === calId).map((t) => t.id)
  if (usam.length && !trocarPara) return
  if (usam.length) write.update('timelines', { id: usam }, { calendario_id: trocarPara })
  write.lixeira('calendarios', [calId])
  toastDesfazer('Calendário excluído.', () => {
    write.restaurar('calendarios', [calId])
    if (usam.length) write.update('timelines', { id: usam }, { calendario_id: calId })
  })
}

export function excluirTimeline(tlId: string) {
  write.lixeira('timelines', [tlId])
  toastDesfazer('Timeline excluída.', () => write.restaurar('timelines', [tlId]))
}

export function excluirTrilha(trilhaId: string) {
  write.lixeira('trilhas', [trilhaId])
  toastDesfazer('Trilha excluída.', () => write.restaurar('trilhas', [trilhaId]))
}

export function excluirPredefinicao(predefId: string) {
  write.lixeira('predefinicoes', [predefId])
  toastDesfazer('Predefinição excluída.', () => write.restaurar('predefinicoes', [predefId]))
}

export function excluirEvento(evId: string) {
  const ev = cache('eventos_timeline').find((e) => e.id === evId)
  if (!ev) return
  write.remove('eventos_timeline', { id: evId })
  toastDesfazer('Evento excluído.', () => write.insert('eventos_timeline', [{ ...ev, expandido: false }]))
}

// ───────── seção e campo: cópia para desfazer ─────────
type CopiaCampos = { campos: NoteCampo[]; valores: NoteValor[]; conexoes: Conexao[]; ocultas: QuadroConexaoOculta[] }
function copiarCampos(campos: NoteCampo[]): CopiaCampos {
  const ids = new Set(campos.map((c) => c.id))
  const conexoes = cache('conexoes').filter((c) => c.campo_id && ids.has(c.campo_id))
  const cx = new Set(conexoes.map((c) => c.id))
  return {
    campos,
    valores: cache('note_valores').filter((v) => ids.has(v.campo_id)),
    conexoes,
    ocultas: cache('quadro_conexoes_ocultas').filter((o) => cx.has(o.conexao_id)),
  }
}
function reinserir(c: CopiaCampos, noteId: string | null) {
  write.insert('note_campos', c.campos)
  write.insert('note_valores', c.valores)
  write.insert('conexoes', c.conexoes)
  write.insert('quadro_conexoes_ocultas', c.ocultas)
  if (noteId && c.campos.some((x) => x.organiza_pasta)) sincronizarPastas(noteId)
}

export function excluirSecao(aba: NoteAba) {
  const copia = copiarCampos(cache('note_campos').filter((c) => c.aba_id === aba.id))
  removerAba(aba.id)
  toastDesfazer('Seção excluída.', () => { write.insert('note_abas', [aba]); reinserir(copia, aba.note_id) })
}

export function excluirCampo(campo: NoteCampo) {
  const noteId = cache('note_abas').find((a) => a.id === campo.aba_id)?.note_id ?? null
  const copia = copiarCampos([campo])
  removerCampo(campo.id)
  toastDesfazer('Campo excluído.', () => reinserir(copia, noteId))
}
