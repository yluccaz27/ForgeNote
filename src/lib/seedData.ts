// Dados de exemplo do ACDB, usados SÓ no modo local (localStorage).
// O banco do Supabase começa vazio de propósito: não gere SQL a partir daqui.

let n = 0
const id = () => `00000000-0000-4000-8000-${(++n).toString(16).padStart(12, '0')}`

export const SEED_USER_ID = '00000000-0000-4000-8000-ffffffffffff'

const doc = (...paras: string[]) => ({
  type: 'doc',
  content: paras.map((t) => ({ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] })),
})

const WS = id()
const db: Record<string, any[]> = {
  workspaces: [{ id: WS, nome: 'ACDB', created_at: '2026-11-06T00:00:00Z' }],
  workspace_members: [{ workspace_id: WS, user_id: SEED_USER_ID, papel: 'dono' }],
  gaveteiros: [], pastas: [], notes: [], note_pasta: [],
  predefinicoes: [], predef_abas: [], predef_campos: [],
  note_abas: [], note_campos: [], note_valores: [],
  quadros: [], quadro_posicoes: [], conexoes: [], quadro_conexoes_ocultas: [],
  calendarios: [], timelines: [], trilhas: [], eventos_timeline: [],
}

// ───────── Predefinições ─────────
type CampoDef = { nome: string; tipo: string; config?: any; pasta?: boolean }
type AbaDef = { nome: string; campos: CampoDef[] }
const predefs: Record<string, { id: string; abas: AbaDef[] }> = {}
function predef(nome: string, icone: string, abas: AbaDef[]) {
  const pid = id()
  db.predefinicoes.push({ id: pid, workspace_id: WS, nome, icone })
  abas.forEach((a, ai) => {
    const aid = id()
    db.predef_abas.push({ id: aid, predefinicao_id: pid, nome: a.nome, ordem: ai })
    a.campos.forEach((c, ci) =>
      db.predef_campos.push({ id: id(), aba_id: aid, nome: c.nome, tipo: c.tipo, config_json: c.config ?? {}, ordem: ci, organiza_pasta: !!c.pasta }),
    )
  })
  predefs[nome] = { id: pid, abas }
  return pid
}

const pFaccao = predef('Facção', '⚑', [
  { nome: 'Básico', campos: [
    { nome: 'Nome', tipo: 'texto' },
    { nome: 'Tipo', tipo: 'selecao', config: { opcoes: ['Governo', 'Ordem', 'Trupe', 'Culto'] } },
  ] },
])
const pPersonagem = predef('Personagem', '☉', [
  { nome: 'Básico', campos: [
    { nome: 'Nome', tipo: 'texto' },
    { nome: 'Idade', tipo: 'numero' },
    { nome: 'Status', tipo: 'selecao', config: { opcoes: ['Vivo', 'Morto', 'Desaparecido'] } },
    { nome: 'Facção', tipo: 'relacao', config: { multiplo: true, predefinicoes: [pFaccao] }, pasta: true },
    { nome: 'Origem', tipo: 'texto' },
    { nome: 'Retrato', tipo: 'imagem' },
  ] },
  { nome: 'Relações', campos: [
    { nome: 'Família', tipo: 'relacao', config: { multiplo: true } },
  ] },
  { nome: 'Datas', campos: [
    { nome: 'Nascimento', tipo: 'data', config: { marco: true } },
    { nome: 'Morte', tipo: 'data', config: { marco: true } },
  ] },
])
const pEvento = predef('Evento', '◆', [
  { nome: 'Básico', campos: [
    { nome: 'Título', tipo: 'texto' },
    { nome: 'Participantes', tipo: 'relacao', config: { multiplo: true, predefinicoes: [pPersonagem] } },
    { nome: 'Local', tipo: 'texto' },
  ] },
])

// ───────── Calendário ─────────
const MESES = [
  ['Brumar', 31], ['Gelo', 30], ['Degelo', 30], ['Semeio', 31], ['Florada', 30],
  ['Sol-alto', 31], ['Colheita', 30], ['Fumaça', 30], ['Cinzas', 31], ['Breu', 30],
] as const
const ANO = MESES.reduce((s, m) => s + m[1], 0) // 304
const dia = (ano: number, mesIdx: number, d: number) => {
  let x = (ano - 1) * ANO
  for (let i = 0; i < mesIdx; i++) x += MESES[i][1]
  return x + d - 1
}
const CAL = id()
db.calendarios.push({
  id: CAL, workspace_id: WS, nome: 'Calendário do Selo',
  config_json: {
    eras: [
      { nome: 'Antes do Selo', sigla: 'A.S.', ano_inicial: -2000, para_tras: true },
      { nome: 'Era do Selo', sigla: 'E.S.', ano_inicial: 1, para_tras: false },
    ],
    meses: MESES.map(([nome, dias]) => ({ nome, dias })),
    semana: ['Primo', 'Duo', 'Terço', 'Quarto', 'Quinto', 'Sexto'],
  },
})

// ───────── Notes ─────────
type Vals = Record<string, unknown>
const notesByName: Record<string, string> = {}
const campoIds: Record<string, Record<string, string>> = {}
function note(predefNome: string | null, titulo: string, corpo: string[], vals: Vals = {}) {
  const nid = id()
  const text = corpo.join(' ')
  const resumo = (text.match(/[^.!?]+[.!?]/g) ?? [text]).slice(0, 2).join('').trim().slice(0, 160)
  db.notes.push({
    id: nid, workspace_id: WS, predefinicao_id: predefNome ? predefs[predefNome].id : null,
    titulo, titulo_provisorio: false, resumo, resumo_provisorio: true,
    corpo_json: doc(...corpo), created_by: SEED_USER_ID, updated_by: SEED_USER_ID,
    created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-06T00:00:00Z',
  })
  notesByName[titulo] = nid
  campoIds[nid] = {}
  if (predefNome) {
    predefs[predefNome].abas.forEach((a, ai) => {
      const aid = id()
      db.note_abas.push({ id: aid, note_id: nid, nome: a.nome, ordem: ai })
      a.campos.forEach((c, ci) => {
        const cid = id()
        campoIds[nid][c.nome] = cid
        db.note_campos.push({ id: cid, aba_id: aid, nome: c.nome, tipo: c.tipo, config_json: c.config ?? {}, ordem: ci, organiza_pasta: !!c.pasta })
        const v = c.nome === 'Nome' || c.nome === 'Título' ? titulo : vals[c.nome]
        if (v !== undefined) db.note_valores.push({ id: id(), campo_id: cid, valor_json: v })
      })
    })
  }
  return nid
}

const id0 = note('Facção', 'ID0', ['Uma ordem sem rosto que guarda os registros do Selo. Ninguém sabe quem a fundou.'], { Tipo: 'Ordem' })
const governo = note('Facção', 'Governo', ['O conselho do porto de Brumar. Governa pelo medo do inverno.'], { Tipo: 'Governo' })
const trupe = note('Facção', 'Trupe do Ferrão', ['Saltimbancos, ladrões e mensageiros. A Trupe atravessa fronteiras que exércitos não atravessam.'], { Tipo: 'Trupe' })

const kaeron = note('Personagem', 'Kaeron Vell', [
  'Quando a neve caiu sobre o porto, Kaeron já não era o mesmo homem que jurou servir ao conselho.',
  'Carrega no braço esquerdo a marca da ID0, e no direito, a do Governo. Nenhuma das duas o reconhece mais.',
], { Idade: 34, Status: 'Vivo', 'Facção': [id0, governo], Origem: 'Brumar', Nascimento: { dia: dia(306, 0, 12) } })
const lysa = note('Personagem', 'Lysa Vell', [
  'Irmã de Kaeron. Fugiu com a Trupe do Ferrão aos quinze anos e nunca escreveu de volta.',
], { Idade: 29, Status: 'Desaparecido', 'Facção': [trupe], Origem: 'Brumar', Nascimento: { dia: dia(311, 3, 3) } })
const orren = note('Personagem', 'Orren Maul', [
  'Capitão da guarda do porto. Leal ao Governo enquanto o Governo lhe pagar.',
], { Idade: 51, Status: 'Vivo', 'Facção': [governo], Origem: 'Ilhas do Breu' })

// família
db.note_valores.push({ id: id(), campo_id: campoIds[kaeron]['Família'], valor_json: [lysa] })
db.note_valores.push({ id: id(), campo_id: campoIds[lysa]['Família'], valor_json: [kaeron] })

// eventos (notes da predefinição Evento)
const evQueda = note('Evento', 'A queda do porto', ['A muralha norte cedeu na primeira noite de Brumar. O conselho fugiu pelos túneis.'], { Participantes: [orren, kaeron], Local: 'Porto de Brumar' })
const evCerco = note('Evento', 'Cerco de Brumar', ['Durante três meses, a Trupe do Ferrão manteve o porto sob cerco, deixando passar apenas cartas.'], { Participantes: [lysa, orren], Local: 'Porto de Brumar' })
const evSaida = note('Evento', 'Kaeron deixa a ID0', ['Kaeron queima o próprio registro no arquivo da ID0 e desaparece no gelo.'], { Participantes: [kaeron], Local: 'Arquivo da ID0' })

// conexões por campo (uma por valor de relação)
for (const v of db.note_valores) {
  const campo = db.note_campos.find((c) => c.id === v.campo_id)
  if (campo?.tipo !== 'relacao' || !Array.isArray(v.valor_json)) continue
  const aba = db.note_abas.find((a) => a.id === campo.aba_id)
  for (const destino of v.valor_json as string[])
    db.conexoes.push({ id: id(), origem_note_id: aba.note_id, destino_note_id: destino, rotulo: campo.nome, tipo: 'campo', campo_id: campo.id })
}
// uma conexão manual
db.conexoes.push({ id: id(), origem_note_id: id0, destino_note_id: trupe, rotulo: 'vigia', tipo: 'manual', campo_id: null })

// ───────── Gaveteiro e pastas ─────────
const GAV = id()
db.gaveteiros.push({ id: GAV, workspace_id: WS, nome: 'ACDB', cor: '#2F363B', icone: '✶', capa_url: null, ordem: 0 })
const pastaAcdb = id()
db.pastas.push({ id: pastaAcdb, gaveteiro_id: GAV, nome: 'ACDB', cor: null, origem: 'manual', regra_campo_id: null, regra_valor_note_id: null, regra_valor_texto: null })
const pastaEventos = id()
db.pastas.push({ id: pastaEventos, gaveteiro_id: GAV, nome: 'Eventos', cor: null, origem: 'manual', regra_campo_id: null, regra_valor_note_id: null, regra_valor_texto: null })
const regra: Record<string, string> = {}
for (const [nome, nid] of [['ID0', id0], ['Governo', governo], ['Trupe do Ferrão', trupe]] as const) {
  const pid = id()
  regra[nid] = pid
  db.pastas.push({ id: pid, gaveteiro_id: GAV, nome, cor: null, origem: 'regra', regra_campo_id: 'Facção', regra_valor_note_id: nid, regra_valor_texto: null })
}
for (const nid of [id0, governo, trupe, kaeron, lysa, orren]) db.note_pasta.push({ note_id: nid, pasta_id: pastaAcdb })
for (const nid of [evQueda, evCerco, evSaida]) db.note_pasta.push({ note_id: nid, pasta_id: pastaEventos })
for (const [p, fs] of [[kaeron, [id0, governo]], [lysa, [trupe]], [orren, [governo]]] as const)
  for (const f of fs) db.note_pasta.push({ note_id: p, pasta_id: regra[f] })

// ───────── Quadro ─────────
const QD = id()
db.quadros.push({ id: QD, workspace_id: WS, nome: 'Mapa das facções', filtro_json: { gaveteiros: [], pastas: [pastaAcdb] } })
const pos: [string, number, number][] = [[kaeron, 80, 120], [lysa, 80, 320], [orren, 380, 420], [id0, 420, 60], [governo, 700, 220], [trupe, 420, 260]]
for (const [nid, x, y] of pos) db.quadro_posicoes.push({ quadro_id: QD, note_id: nid, x, y, oculto: false })

// ───────── Timeline ─────────
const TL = id()
db.timelines.push({ id: TL, workspace_id: WS, nome: 'História de Brumar', calendario_id: CAL })
const trMundo = id(); const trKaeron = id()
db.trilhas.push({ id: trMundo, timeline_id: TL, nome: 'Mundo', cor: null, ordem: 0, note_id: null, recolhida: false })
db.trilhas.push({ id: trKaeron, timeline_id: TL, nome: 'Kaeron Vell', cor: null, ordem: 1, note_id: kaeron, recolhida: false })
db.eventos_timeline.push({ id: id(), timeline_id: TL, trilha_id: trMundo, note_id: evQueda, inicio_json: { dia: dia(340, 0, 12) }, fim_json: null, expandido: false })
db.eventos_timeline.push({ id: id(), timeline_id: TL, trilha_id: trMundo, note_id: evCerco, inicio_json: { dia: dia(340, 2, 1) }, fim_json: { dia: dia(340, 4, 20) }, expandido: false })
db.eventos_timeline.push({ id: id(), timeline_id: TL, trilha_id: trKaeron, note_id: evSaida, inicio_json: { dia: dia(340, 1, 3) }, fim_json: null, expandido: false })

void pEvento
void notesByName

export const SEED = db
export const SEED_WORKSPACE_ID = WS
