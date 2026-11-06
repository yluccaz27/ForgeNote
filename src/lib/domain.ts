import { cache, uid, write } from './data'
import { docText, resumoDoTexto, tituloDoTexto, normalizar } from './text'
import type { CampoConfig, Note, NoteCampo, Pasta, TipoCampo } from './types'

// ───────── leitura ─────────
export function abasDoNote(noteId: string) {
  return cache('note_abas').filter((a) => a.note_id === noteId).sort((a, b) => a.ordem - b.ordem)
}
export function camposDoNote(noteId: string): NoteCampo[] {
  const abas = new Set(abasDoNote(noteId).map((a) => a.id))
  return cache('note_campos').filter((c) => abas.has(c.aba_id))
}
export function valorDe(campoId: string): unknown {
  return cache('note_valores').find((v) => v.campo_id === campoId)?.valor_json
}
export function noteDoCampo(campoId: string): string | null {
  const c = cache('note_campos').find((x) => x.id === campoId)
  return c ? cache('note_abas').find((a) => a.id === c.aba_id)?.note_id ?? null : null
}
const ehCampoTitulo = (c: NoteCampo) => c.tipo === 'texto' && ['nome', 'titulo'].includes(normalizar(c.nome.trim()))

/** Pastas em que o note está. */
export function pastasDoNote(noteId: string): Pasta[] {
  const ids = new Set(cache('note_pasta').filter((x) => x.note_id === noteId).map((x) => x.pasta_id))
  return cache('pastas').filter((p) => ids.has(p.id))
}

// ───────── criação ─────────
export function criarNote(opts: { workspaceId: string; predefinicaoId: string | null; titulo?: string; pastaId?: string }): string {
  const id = uid()
  const titulo = opts.titulo?.trim()
  const note: Note = {
    id, workspace_id: opts.workspaceId, predefinicao_id: opts.predefinicaoId,
    titulo: titulo || 'Sem título', titulo_provisorio: !titulo,
    resumo: '', resumo_provisorio: true, corpo_json: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
  write.insert('notes', [note])
  if (opts.predefinicaoId) {
    // copia a estrutura: editar o note depois não mexe na predefinição
    const abas = cache('predef_abas').filter((a) => a.predefinicao_id === opts.predefinicaoId).sort((a, b) => a.ordem - b.ordem)
    const novasAbas = abas.map((a) => ({ id: uid(), note_id: id, nome: a.nome, ordem: a.ordem, _de: a.id }))
    write.insert('note_abas', novasAbas.map(({ _de, ...a }) => a))
    const campos = novasAbas.flatMap((na) =>
      cache('predef_campos').filter((c) => c.aba_id === na._de).map((c) => ({
        id: uid(), aba_id: na.id, nome: c.nome, tipo: c.tipo, config_json: structuredClone(c.config_json ?? {}),
        ordem: c.ordem, organiza_pasta: c.organiza_pasta,
      })),
    )
    write.insert('note_campos', campos)
    const ct = campos.find(ehCampoTitulo)
    if (ct && titulo) write.insert('note_valores', [{ id: uid(), campo_id: ct.id, valor_json: titulo }])
  }
  if (opts.pastaId) write.insert('note_pasta', [{ note_id: id, pasta_id: opts.pastaId }])
  else {
    // sem pasta escolhida: entra na primeira pasta manual do primeiro gaveteiro, para não ficar perdido
    const gav = cache('gaveteiros').filter((g) => g.workspace_id === opts.workspaceId).sort((a, b) => a.ordem - b.ordem)[0]
    const pasta = gav && cache('pastas').find((p) => p.gaveteiro_id === gav.id && p.origem === 'manual')
    if (pasta) write.insert('note_pasta', [{ note_id: id, pasta_id: pasta.id }])
  }
  return id
}

// ───────── título e resumo provisórios ─────────
export function salvarCorpo(noteId: string, corpo: unknown) {
  const note = cache('notes').find((n) => n.id === noteId)
  if (!note) return
  const texto = docText(corpo)
  const patch: Partial<Note> = { corpo_json: corpo }
  if (note.titulo_provisorio) {
    const t = tituloDoTexto(texto) || 'Sem título'
    if (t !== note.titulo) patch.titulo = t
  }
  if (note.resumo_provisorio) {
    const r = resumoDoTexto(texto)
    if (r !== note.resumo) patch.resumo = r
  }
  write.update('notes', { id: noteId }, patch)
  if (patch.titulo) renomearPastasDe(noteId, patch.titulo)
}

/** Título digitado pelo usuário. Vazio = volta a ser gerado. */
export function definirTitulo(noteId: string, titulo: string) {
  const note = cache('notes').find((n) => n.id === noteId)
  if (!note) return
  const t = titulo.trim()
  const ct = camposDoNote(noteId).find(ehCampoTitulo)
  if (t) {
    write.update('notes', { id: noteId }, { titulo: t, titulo_provisorio: false })
    if (ct) gravarValor(ct.id, t)
    renomearPastasDe(noteId, t)
  } else {
    if (ct) gravarValor(ct.id, '')
    const auto = tituloDoTexto(docText(note.corpo_json)) || 'Sem título'
    write.update('notes', { id: noteId }, { titulo: auto, titulo_provisorio: true })
    renomearPastasDe(noteId, auto)
  }
}

export function definirResumo(noteId: string, resumo: string) {
  const note = cache('notes').find((n) => n.id === noteId)
  if (!note) return
  const r = resumo.trim()
  if (r) write.update('notes', { id: noteId }, { resumo: r, resumo_provisorio: false })
  else write.update('notes', { id: noteId }, { resumo: resumoDoTexto(docText(note.corpo_json)), resumo_provisorio: true })
}

/** Pasta automática ligada ao note por id: renomeia junto. */
function renomearPastasDe(noteId: string, titulo: string) {
  if (cache('pastas').some((p) => p.regra_valor_note_id === noteId && p.nome !== titulo))
    write.update('pastas', { regra_valor_note_id: noteId }, { nome: titulo })
}

// ───────── valores, conexões por campo e pastas por regra ─────────
function gravarValor(campoId: string, valor: unknown) {
  const v = cache('note_valores').find((x) => x.campo_id === campoId)
  if (v) write.update('note_valores', { id: v.id }, { valor_json: valor })
  else write.insert('note_valores', [{ id: uid(), campo_id: campoId, valor_json: valor }])
}

export function definirValor(campoId: string, valor: unknown) {
  const campo = cache('note_campos').find((c) => c.id === campoId)
  const noteId = noteDoCampo(campoId)
  if (!campo || !noteId) return
  gravarValor(campoId, valor)
  if (ehCampoTitulo(campo)) {
    const t = String(valor ?? '').trim()
    if (t) { write.update('notes', { id: noteId }, { titulo: t, titulo_provisorio: false }); renomearPastasDe(noteId, t) }
    else definirTitulo(noteId, '')
  }
  if (campo.tipo === 'relacao') sincronizarConexoes(campo, noteId, asArray(valor))
  if (campo.organiza_pasta) sincronizarPastas(noteId)
}

export const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? (v as string[]).filter(Boolean) : v ? [String(v)] : []

/** Cada valor de Relação = uma conexão tipo 'campo' (origem → destino, rótulo = nome do campo). */
export function sincronizarConexoes(campo: NoteCampo, noteId: string, destinos: string[]) {
  const atuais = cache('conexoes').filter((c) => c.campo_id === campo.id)
  const sair = atuais.filter((c) => !destinos.includes(c.destino_note_id)).map((c) => c.id)
  if (sair.length) write.remove('conexoes', { id: sair })
  const novos = destinos.filter((d) => d !== noteId && !atuais.some((c) => c.destino_note_id === d))
  write.insert('conexoes', novos.map((d) => ({
    id: uid(), origem_note_id: noteId, destino_note_id: d, rotulo: campo.nome, tipo: 'campo' as const, campo_id: campo.id,
  })))
  const errado = atuais.filter((c) => c.rotulo !== campo.nome && destinos.includes(c.destino_note_id))
  if (errado.length) write.update('conexoes', { campo_id: campo.id }, { rotulo: campo.nome })
}

/**
 * Pastas automáticas: cada valor de um campo com organiza_pasta vira uma pasta
 * (ligada ao note de destino por id, ou ao texto da opção) nos gaveteiros onde
 * o note está. Valor removido = note sai da pasta. Pasta vazia some.
 */
export function sincronizarPastas(noteId: string) {
  const note = cache('notes').find((n) => n.id === noteId)
  if (!note) return
  const campos = camposDoNote(noteId).filter((c) => c.organiza_pasta && (c.tipo === 'relacao' || c.tipo === 'selecao'))
  type Chave = { campo: string; noteVal?: string; texto?: string; nome: string }
  const desejadas: Chave[] = []
  for (const c of campos) {
    for (const v of asArray(valorDe(c.id))) {
      if (c.tipo === 'relacao') {
        const alvo = cache('notes').find((n) => n.id === v)
        if (alvo) desejadas.push({ campo: c.nome, noteVal: v, nome: alvo.titulo })
      } else desejadas.push({ campo: c.nome, texto: v, nome: v })
    }
  }
  const minhas = pastasDoNote(noteId)
  let gavs = [...new Set(minhas.map((p) => p.gaveteiro_id))]
  if (!gavs.length) {
    const g = cache('gaveteiros').filter((x) => x.workspace_id === note.workspace_id).sort((a, b) => a.ordem - b.ordem)[0]
    if (g) gavs = [g.id]
  }
  const casa = (p: Pasta, k: Chave) => p.origem === 'regra' && (k.noteVal ? p.regra_valor_note_id === k.noteVal : !p.regra_valor_note_id && p.regra_valor_texto === k.texto)
  const manter = new Set<string>()
  for (const g of gavs) {
    for (const k of desejadas) {
      let pasta = cache('pastas').find((p) => p.gaveteiro_id === g && casa(p, k))
      if (!pasta) {
        pasta = { id: uid(), gaveteiro_id: g, nome: k.nome, cor: null, origem: 'regra', regra_campo_id: k.campo, regra_valor_note_id: k.noteVal ?? null, regra_valor_texto: k.texto ?? null }
        write.insert('pastas', [pasta])
      }
      manter.add(pasta.id)
      if (!cache('note_pasta').some((x) => x.note_id === noteId && x.pasta_id === pasta!.id))
        write.insert('note_pasta', [{ note_id: noteId, pasta_id: pasta.id }])
    }
  }
  const sair = minhas.filter((p) => p.origem === 'regra' && !manter.has(p.id))
  for (const p of sair) {
    write.remove('note_pasta', { note_id: noteId, pasta_id: p.id })
    if (!cache('note_pasta').some((x) => x.pasta_id === p.id)) write.remove('pastas', { id: p.id })
  }
}

// ───────── estrutura da ficha ─────────
export function novaAba(noteId: string, nome = 'Nova aba') {
  const ordem = abasDoNote(noteId).length
  const id = uid()
  write.insert('note_abas', [{ id, note_id: noteId, nome, ordem }])
  return id
}
export function reordenarAbas(noteId: string, ids: string[]) {
  ids.forEach((id, i) => write.update('note_abas', { id }, { ordem: i }))
  void noteId
}
export function novoCampo(abaId: string, tipo: TipoCampo, nome: string) {
  const ordem = cache('note_campos').filter((c) => c.aba_id === abaId).length
  const config: CampoConfig = tipo === 'selecao' ? { opcoes: [], multiplo: false } : tipo === 'relacao' ? { multiplo: true } : {}
  const id = uid()
  write.insert('note_campos', [{ id, aba_id: abaId, nome, tipo, config_json: config, ordem, organiza_pasta: false }])
  return id
}
export function removerCampo(campoId: string) {
  const noteId = noteDoCampo(campoId)
  const tinhaPasta = cache('note_campos').find((c) => c.id === campoId)?.organiza_pasta
  write.remove('conexoes', { campo_id: campoId })
  write.remove('note_valores', { campo_id: campoId })
  write.remove('note_campos', { id: campoId })
  if (noteId && tinhaPasta) sincronizarPastas(noteId)
}
export function removerAba(abaId: string) {
  const campos = cache('note_campos').filter((c) => c.aba_id === abaId)
  campos.forEach((c) => removerCampo(c.id))
  write.remove('note_abas', { id: abaId })
}
export function alternarOrganizaPasta(campoId: string) {
  const c = cache('note_campos').find((x) => x.id === campoId)
  const noteId = noteDoCampo(campoId)
  if (!c || !noteId) return
  write.update('note_campos', { id: campoId }, { organiza_pasta: !c.organiza_pasta })
  sincronizarPastas(noteId)
}
export function renomearCampo(campoId: string, nome: string) {
  write.update('note_campos', { id: campoId }, { nome })
  if (cache('conexoes').some((c) => c.campo_id === campoId)) write.update('conexoes', { campo_id: campoId }, { rotulo: nome })
}

// ───────── predefinição a partir do note ─────────
export function salvarComoPredefinicao(noteId: string, nome: string, icone: string, organizar: string[]) {
  const note = cache('notes').find((n) => n.id === noteId)
  if (!note) return
  const pid = uid()
  write.insert('predefinicoes', [{ id: pid, workspace_id: note.workspace_id, nome, icone }])
  for (const a of abasDoNote(noteId)) {
    const aid = uid()
    write.insert('predef_abas', [{ id: aid, predefinicao_id: pid, nome: a.nome, ordem: a.ordem }])
    write.insert('predef_campos', cache('note_campos').filter((c) => c.aba_id === a.id).map((c) => ({
      id: uid(), aba_id: aid, nome: c.nome, tipo: c.tipo, config_json: structuredClone(c.config_json ?? {}), ordem: c.ordem,
      organiza_pasta: organizar.includes(c.id),
    })))
  }
  // os campos marcados ganham 📁 também no note de origem
  for (const c of camposDoNote(noteId)) {
    const quer = organizar.includes(c.id)
    if (c.organiza_pasta !== quer && (c.tipo === 'relacao' || c.tipo === 'selecao')) write.update('note_campos', { id: c.id }, { organiza_pasta: quer })
  }
  if (!note.predefinicao_id) write.update('notes', { id: noteId }, { predefinicao_id: pid })
  sincronizarPastas(noteId)
}

// ───────── exclusão ─────────
/** Onde o note é usado: relações de outros notes, eventos, trilhas. */
export function usosDoNote(noteId: string): string[] {
  const out: string[] = []
  const notes = cache('notes')
  const nome = (id: string) => notes.find((n) => n.id === id)?.titulo ?? 'Sem título'
  for (const c of cache('conexoes').filter((c) => c.destino_note_id === noteId && c.tipo === 'campo'))
    out.push(`${nome(c.origem_note_id)}, no campo ${c.rotulo}`)
  const ev = cache('eventos_timeline').filter((e) => e.note_id === noteId).length
  if (ev) out.push(`${ev} evento${ev > 1 ? 's' : ''} na timeline`)
  for (const t of cache('trilhas').filter((t) => t.note_id === noteId)) out.push(`trilha ${t.nome}`)
  return out
}
export function excluirNote(noteId: string) {
  // remove o id dos campos de relação que apontam para ele
  for (const c of cache('conexoes').filter((c) => c.destino_note_id === noteId && c.tipo === 'campo' && c.campo_id)) {
    const v = asArray(valorDe(c.campo_id!)).filter((x) => x !== noteId)
    gravarValor(c.campo_id!, v)
  }
  const regra = cache('pastas').filter((p) => p.regra_valor_note_id === noteId).map((p) => p.id)
  if (regra.length) write.remove('pastas', { id: regra })
  write.remove('notes', { id: noteId })
}

// ───────── busca ─────────
export function buscar(workspaceId: string, q: string) {
  const termo = normalizar(q.trim())
  const notes = cache('notes').filter((n) => n.workspace_id === workspaceId)
  if (!termo) return notes.slice(0, 20).map((n) => ({ note: n, trecho: n.resumo }))
  const out: { note: Note; trecho: string; peso: number }[] = []
  for (const n of notes) {
    const t = normalizar(n.titulo), r = normalizar(n.resumo)
    const corpo = docText(n.corpo_json)
    const ci = normalizar(corpo).indexOf(termo)
    if (t.includes(termo)) out.push({ note: n, trecho: n.resumo, peso: t.startsWith(termo) ? 0 : 1 })
    else if (r.includes(termo)) out.push({ note: n, trecho: n.resumo, peso: 2 })
    else if (ci >= 0) out.push({ note: n, trecho: '…' + corpo.slice(Math.max(0, ci - 40), ci + 80).replace(/\s+/g, ' ') + '…', peso: 3 })
  }
  return out.sort((a, b) => a.peso - b.peso).slice(0, 30)
}

export function noteParaNome(workspaceId: string, nome: string) {
  const alvo = normalizar(nome.trim())
  return cache('notes').find((n) => n.workspace_id === workspaceId && normalizar(n.titulo) === alvo)
}
