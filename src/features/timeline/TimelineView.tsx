import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { cache, uid, useTable, useWsTable, write } from '../../lib/data'
import { asArray, camposDoNote, criarNote, definirTitulo, definirValor } from '../../lib/domain'
import { diasNoAno, formatarDia, formatarIntervalo } from '../../lib/calendar'
import { useCalendario } from '../../lib/hooks'
import { corMarcacao } from '../../lib/color'
import { toast, useUI } from '../../store/ui'
import { textoAtalho, useAtalho } from '../../lib/shortcuts'
import { reduzMovimento } from '../../lib/hooks'
import { excluirEvento, excluirTrilha } from '../../lib/excluir'
import { MenuMais } from '../../components/Menu'
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao'
import { ExcluirTimelineDialogo } from './Excluir'
import { Notepad } from '../../components/Notepad'
import { Modal } from '../../components/Modal'
import { IconArrastar, IconFechar, IconMais, IconSeta } from '../../components/Icons'
import { DataInput } from '../note/Campos'
import { CalendarioModal } from './CalendarioModal'
import { calcularRegua, contexto } from './regua'
import type { CalendarioConfig, EventoTimeline, Note, Trilha } from '../../lib/types'

const COL = 140             // coluna fixa com o nome da trilha
const LINHA_Y = 44          // altura do fio do tempo dentro da trilha
const ALT_TRILHA = 96
const ALT_RECOLHIDA = 32
const ALT_CORPO = 300       // área de descrição do evento expandido
const MIN_ESCALA = 0.0004, MAX_ESCALA = 160

type Vista = { inicio: number; escala: number }
type Gesto =
  | { tipo: 'criar'; trilha: string; x0: number; x1: number }
  | { tipo: 'mover' | 'ini' | 'fim'; ev: string; x0: number; dx: number; ini: number; fim: number | null }
  | { tipo: 'pan'; x0: number; inicio0: number }

export function TimelineView() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const tl = useWsTable('timelines').find((t) => t.id === id)
  const calRow = useWsTable('calendarios').find((c) => c.id === tl?.calendario_id)
  const cal = useCalendario(tl?.calendario_id)
  const todasTrilhas = useTable('trilhas')
  const todosEventos = useTable('eventos_timeline')
  const notes = useWsTable('notes')
  const conexoes = useTable('conexoes')
  const predefs = useWsTable('predefinicoes')
  const quadros = useWsTable('quadros')
  const pastas = useTable('pastas')
  const notePasta = useTable('note_pasta')
  const valores = useTable('note_valores')
  const campos = useTable('note_campos')
  const abas = useTable('note_abas')
  const { destaque, setDestaque, wsId } = useUI()
  const nav = useNavigate()

  const trilhas = useMemo(() => todasTrilhas.filter((t) => t.timeline_id === id).sort((a, b) => a.ordem - b.ordem), [todasTrilhas, id])
  const noteMap = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes])
  // eventos de trilhas ou notes na lixeira ficam de fora
  const eventos = useMemo(() => {
    const tr = new Set(trilhas.map((t) => t.id))
    return todosEventos.filter((e) => e.timeline_id === id && tr.has(e.trilha_id) && noteMap.has(e.note_id))
  }, [todosEventos, id, trilhas, noteMap])
  const [exTl, setExTl] = useState(false)

  const area = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(800)
  const [vista, setVista] = useState<Vista | null>(null)
  const [gesto, setGesto] = useState<Gesto | null>(null)
  const [calAberto, setCalAberto] = useState(false)
  const [novaTrilha, setNovaTrilha] = useState<'livre' | 'note' | null>(null)
  const [arrastandoTrilha, setArrastandoTrilha] = useState<string | null>(null)
  const chaveVista = `forgenote:vista:${id}`

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const ro = new ResizeObserver(() => setLargura(Math.max(200, el.clientWidth - COL)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [tl])

  // marcos: campos de data "marco de timeline" dos notes das trilhas por note
  const marcos = useMemo(() => {
    const abaNote = new Map(abas.map((a) => [a.id, a.note_id]))
    const out = new Map<string, { campo: string; dia: number }[]>()
    for (const c of campos) {
      if (c.tipo !== 'data') continue
      const n = abaNote.get(c.aba_id)
      if (!n) continue
      const v = valores.find((x) => x.campo_id === c.id)?.valor_json as { dia: number } | null
      if (!v || typeof v.dia !== 'number') continue
      const l = out.get(n) ?? []
      l.push({ campo: c.nome, dia: v.dia }) // todas as datas do note: formam a barra de vida
      out.set(n, l)
    }
    return out
  }, [abas, campos, valores])
  const marcoDe = (noteId: string) => {
    const abaNote = new Map(abas.map((a) => [a.id, a.note_id]))
    return campos.filter((c) => c.tipo === 'data' && c.config_json.marco && abaNote.get(c.aba_id) === noteId)
      .map((c) => ({ campo: c.nome, dia: (valores.find((v) => v.campo_id === c.id)?.valor_json as { dia: number } | null)?.dia }))
      .filter((m): m is { campo: string; dia: number } => typeof m.dia === 'number')
  }

  function ajustar() {
    const dias: number[] = []
    eventos.forEach((e) => { dias.push(e.inicio_json.dia); if (e.fim_json) dias.push(e.fim_json.dia) })
    trilhas.forEach((t) => t.note_id && (marcos.get(t.note_id) ?? []).forEach((m) => dias.push(m.dia)))
    const ano = diasNoAno(cal)
    let min = dias.length ? Math.min(...dias) : 0, max = dias.length ? Math.max(...dias) : ano
    if (max - min < 30) { min -= 30; max += 30 }
    const pad = (max - min) * 0.08
    setVista({ inicio: min - pad, escala: Math.min(MAX_ESCALA, largura / (max - min + 2 * pad)) })
  }
  useEffect(() => {
    if (vista || !tl || largura <= 200) return
    try { const v = JSON.parse(localStorage.getItem(chaveVista) || 'null'); if (v?.escala) { setVista(v); return } } catch { /* ok */ }
    ajustar()
  }, [tl, largura])
  useEffect(() => { if (vista) try { localStorage.setItem(chaveVista, JSON.stringify(vista)) } catch { /* ok */ } }, [vista, chaveVista])

  // ?note=… vem do "Ver na timeline" do note
  useEffect(() => { const n = params.get('note'); if (n) setDestaque(n) }, [params, setDestaque])

  const zoom = useCallback((fator: number, xPx: number) => {
    setVista((v) => {
      if (!v) return v
      const dia = v.inicio + xPx / v.escala
      const escala = Math.min(MAX_ESCALA, Math.max(MIN_ESCALA, v.escala * fator))
      return { escala, inicio: dia - xPx / escala }
    })
  }, [])

  // Ctrl+scroll = zoom no cursor; scroll = pan horizontal
  useEffect(() => {
    const el = area.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const r = el.getBoundingClientRect()
      const x = e.clientX - r.left - COL
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.0025), Math.max(0, x)); return }
      // scroll vertical também anda no tempo, a menos que haja trilhas para rolar (aí, Shift+scroll)
      const temRolagem = el.scrollHeight > el.clientHeight + 1
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey || !temRolagem) ? e.deltaY : 0
      if (d) { e.preventDefault(); setVista((v) => v && { ...v, inicio: v.inicio + d / v.escala }) }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, tl])

  const x = (dia: number) => (vista ? (dia - vista.inicio) * vista.escala : 0)
  const diaEm = (px: number) => (vista ? Math.round(vista.inicio + px / vista.escala) : 0)

  // gestos com o ponteiro
  useEffect(() => {
    if (!gesto) return
    const mover = (e: PointerEvent) => {
      if (gesto.tipo === 'pan') { setVista((v) => v && { ...v, inicio: gesto.inicio0 - (e.clientX - gesto.x0) / v.escala }); return }
      const r = area.current!.getBoundingClientRect()
      if (gesto.tipo === 'criar') setGesto({ ...gesto, x1: e.clientX - r.left - COL })
      else setGesto({ ...gesto, dx: e.clientX - gesto.x0 })
    }
    const soltar = () => {
      const g = gesto
      setGesto(null)
      if (g.tipo === 'criar') {
        const a = diaEm(Math.min(g.x0, g.x1)), b = diaEm(Math.max(g.x0, g.x1))
        criarEvento(g.trilha, a, Math.abs(g.x1 - g.x0) > 6 && b > a ? b : null)
      } else if (g.tipo !== 'pan') {
        const ev = eventos.find((e) => e.id === g.ev)
        if (!ev || !vista) return
        if (Math.abs(g.dx) < 3) { alternarExpandido(ev); return }
        const dd = Math.round(g.dx / vista.escala)
        const [ini, fim] = aplicar(g, dd)
        write.update('eventos_timeline', { id: ev.id }, { inicio_json: { dia: ini }, fim_json: fim == null ? null : { dia: fim } })
      }
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar, { once: true })
    return () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar) }
  }, [gesto, vista, eventos])

  function aplicar(g: Extract<Gesto, { ev: string }>, dd: number): [number, number | null] {
    if (g.tipo === 'mover') return [g.ini + dd, g.fim == null ? null : g.fim + dd]
    if (g.tipo === 'ini') return [Math.min(g.ini + dd, (g.fim ?? g.ini) - 1), g.fim]
    return [g.ini, Math.max(g.ini + 1, (g.fim ?? g.ini) + dd)]
  }

  function criarEvento(trilhaId: string, ini: number, fim: number | null) {
    if (!wsId || !id) return
    const pEvento = predefs.find((p) => p.nome.toLowerCase() === 'evento')
    const noteId = criarNote({ workspaceId: wsId, predefinicaoId: pEvento?.id ?? null })
    const trilha = trilhas.find((t) => t.id === trilhaId)
    // trilha por note: o note entra como participante
    if (trilha?.note_id) {
      const part = camposDoNote(noteId).find((c) => c.tipo === 'relacao' && /participante/i.test(c.nome))
      if (part) definirValor(part.id, [trilha.note_id])
    }
    write.update('eventos_timeline', { timeline_id: id, expandido: true }, { expandido: false })
    write.insert('eventos_timeline', [{ id: uid(), timeline_id: id, trilha_id: trilhaId, note_id: noteId, inicio_json: { dia: ini }, fim_json: fim == null ? null : { dia: fim }, expandido: true }])
  }

  function alternarExpandido(ev: EventoTimeline) {
    if (!ev.expandido) write.update('eventos_timeline', { timeline_id: ev.timeline_id, expandido: true }, { expandido: false })
    write.update('eventos_timeline', { id: ev.id }, { expandido: !ev.expandido })
  }
  const recolherTudo = () => { if (eventos.some((e) => e.expandido)) write.update('eventos_timeline', { timeline_id: id!, expandido: true }, { expandido: false }) }

  // Esc recolhe o evento aberto (tratado aqui: vale também de dentro do editor)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"], [role="menu"]')) { recolherTudo(); (document.activeElement as HTMLElement | null)?.blur?.() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useAtalho('timeline.zoomTeclas', (_, combo) => zoom(combo === '-' ? 1 / 1.4 : 1.4, largura / 2))

  // destaque cruzado
  const participa = useCallback((ev: EventoTimeline, pid: string) =>
    ev.note_id === pid
    || trilhas.find((t) => t.id === ev.trilha_id)?.note_id === pid
    || conexoes.some((c) => c.origem_note_id === ev.note_id && c.destino_note_id === pid && c.tipo === 'campo'), [conexoes, trilhas])
  const candidatosDestaque = useMemo(() => {
    const ids = new Set<string>()
    trilhas.forEach((t) => t.note_id && ids.add(t.note_id))
    eventos.forEach((e) => conexoes.filter((c) => c.origem_note_id === e.note_id && c.tipo === 'campo').forEach((c) => ids.add(c.destino_note_id)))
    const pPers = predefs.find((p) => p.nome.toLowerCase() === 'personagem')
    if (pPers) notes.filter((n) => n.predefinicao_id === pPers.id).forEach((n) => ids.add(n.id))
    return [...ids].map((i) => noteMap.get(i)).filter(Boolean).sort((a, b) => a!.titulo.localeCompare(b!.titulo)) as Note[]
  }, [trilhas, eventos, conexoes, predefs, notes, noteMap])
  function verNoQuadro(pid: string) {
    const q = quadros.find((qd) => {
      const ps = new Set([...(qd.filtro_json.pastas ?? []), ...pastas.filter((p) => (qd.filtro_json.gaveteiros ?? []).includes(p.gaveteiro_id)).map((p) => p.id)])
      return notePasta.some((x) => x.note_id === pid && ps.has(x.pasta_id))
    })
    if (q) nav(`/quadro/${q.id}?foco=${pid}`)
    else toast('Nenhum quadro mostra este note ainda. Inclua uma pasta dele num quadro.')
  }

  if (!tl) return <p className="p-6 meta">Timeline não encontrada. <Link to="/timeline" className="underline">Voltar às timelines</Link></p>
  const regua = vista ? calcularRegua(cal, vista.inicio, vista.escala, largura) : null

  // densidade: quantos eventos caem em cada faixa de 8px
  const densidade = (() => {
    if (!vista) return []
    const n = Math.ceil(largura / 8), bins = new Array(n).fill(0)
    for (const e of eventos) {
      const a = Math.floor(x(e.inicio_json.dia) / 8), b = Math.floor(x(e.fim_json?.dia ?? e.inicio_json.dia) / 8)
      for (let i = Math.max(0, a); i <= Math.min(n - 1, b); i++) bins[i]++
    }
    const max = Math.max(1, ...bins)
    return bins.map((c) => c / max)
  })()

  const semEventos = eventos.length === 0

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 borda-b">
        <input key={tl.nome} className="bg-transparent font-texto text-ui-lg font-semibold" style={{ border: 0, minWidth: 0 }} defaultValue={tl.nome} aria-label="Nome da timeline"
          onBlur={(e) => e.target.value.trim() && e.target.value !== tl.nome && write.update('timelines', { id: tl.id }, { nome: e.target.value.trim() })} />
        <MenuMais rotulo={`Opções da timeline ${tl.nome}`} alinhar="esquerda" excluir={() => setExTl(true)} />
        <div className="flex-1" />
        <label className="flex items-center gap-2"><span className="meta">Destacar</span>
          <select className="campo" style={{ width: 'auto' }} value={destaque ?? ''} onChange={(e) => setDestaque(e.target.value || null)}>
            <option value="">Ninguém</option>
            {candidatosDestaque.map((n) => <option key={n.id} value={n.id}>{n.titulo}</option>)}
          </select>
        </label>
        {destaque && <button className="btn" onClick={() => verNoQuadro(destaque)}>Ver no quadro</button>}
        <div className="flex">
          <button className="btn-icone" aria-label="Afastar" title={`Afastar (−, ou ${textoAtalho('timeline.zoom')})`} onClick={() => zoom(1 / 1.6, largura / 2)}>−</button>
          <button className="btn-icone" aria-label="Aproximar" title={`Aproximar (+, ou ${textoAtalho('timeline.zoom')})`} onClick={() => zoom(1.6, largura / 2)}>+</button>
        </div>
        <button className="btn" onClick={ajustar}>Ajustar à história</button>
        {calRow && <button className="btn" onClick={() => setCalAberto(true)}>Calendário</button>}
        <button className="btn" onClick={() => setNovaTrilha('livre')}><IconMais width={16} height={16} /> Trilha</button>
        <button className="btn" onClick={() => setNovaTrilha('note')}>Trilha para note</button>
      </div>

      <div ref={area} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative select-none" role="region" aria-label={`Timeline ${tl.nome}`}>
        {/* régua */}
        <div className="flex sticky top-0 z-10 bg-mesa borda-b">
          <div className="shrink-0 px-3 flex items-end pb-1 text-ui-sm meta" style={{ width: COL }}>{vista ? contexto(cal, vista.inicio) : ''}</div>
          <div className="relative flex-1 overflow-hidden" style={{ height: 72, cursor: gesto?.tipo === 'pan' ? 'grabbing' : 'grab' }}
            onPointerDown={(e) => vista && setGesto({ tipo: 'pan', x0: e.clientX, inicio0: vista.inicio })}>
            {regua && (
              <svg width={largura} height={72} className="absolute inset-0" aria-hidden>
                {regua.maiores.map((t) => x(t.dia) > -200 && x(t.dia) < largura && (
                  <g key={`M${t.dia}`}>
                    <line x1={x(t.dia)} x2={x(t.dia)} y1={0} y2={44} stroke="var(--liquen)" strokeOpacity={0.5} />
                    <text x={x(t.dia) + 4} y={14} fill="var(--papel)" fontSize={12.5} fontFamily="Instrument Sans">{t.rotulo}</text>
                  </g>
                ))}
                {regua.menores.map((t) => x(t.dia) >= -60 && x(t.dia) <= largura && (
                  <g key={`m${t.dia}`}>
                    <line x1={x(t.dia)} x2={x(t.dia)} y1={30} y2={44} stroke="var(--liquen)" strokeOpacity={0.6} strokeDasharray="1 2" />
                    {t.rotulo && <text x={x(t.dia) + 3} y={40} fill="var(--liquen)" fontSize={12.5} fontFamily="Instrument Sans">{t.rotulo}</text>}
                  </g>
                ))}
                {/* faixa de densidade: mostra os períodos vazios da história */}
                {densidade.map((v, i) => v > 0 && (
                  <rect key={i} x={i * 8} y={70 - v * 20} width={7} height={v * 20} fill="var(--liquen)" fillOpacity={0.6} />
                ))}
                <line x1={0} x2={largura} y1={70.5} y2={70.5} stroke="var(--liquen)" strokeOpacity={0.35} />
              </svg>
            )}
          </div>
        </div>

        {trilhas.length === 0 && (
          <div className="p-6 flex flex-col items-start gap-3">
            <p>Esta timeline ainda não tem trilhas.</p>
            <button className="btn-primario" onClick={() => write.insert('trilhas', [{ id: uid(), timeline_id: tl.id, nome: 'Mundo', cor: null, ordem: 0, note_id: null, recolhida: false }])}>Criar trilha Mundo</button>
          </div>
        )}

        {vista && trilhas.map((t, i) => (
          <TrilhaLinha key={t.id} trilha={t} par={i % 2 === 1} cal={cal} largura={largura} x={x}
            eventos={eventos.filter((e) => e.trilha_id === t.id)} noteMap={noteMap}
            marcos={t.note_id ? marcoDe(t.note_id) : []}
            vida={t.note_id ? marcos.get(t.note_id) ?? [] : []}
            gesto={gesto} setGesto={setGesto} aplicar={aplicar} escala={vista.escala}
            destaque={destaque} participa={participa}
            alternar={alternarExpandido} recolherTudo={recolherTudo}
            arrastando={arrastandoTrilha} setArrastando={setArrastandoTrilha}
            soltarEm={(alvo) => {
              if (!arrastandoTrilha || arrastandoTrilha === alvo) return
              const ids = trilhas.map((x) => x.id).filter((x) => x !== arrastandoTrilha)
              ids.splice(ids.indexOf(alvo), 0, arrastandoTrilha)
              ids.forEach((tid, ordem) => write.update('trilhas', { id: tid }, { ordem }))
              setArrastandoTrilha(null)
            }}
            onPointerDownVazio={(e) => {
              if (e.button !== 0) return
              const r = area.current!.getBoundingClientRect()
              const px = e.clientX - r.left - COL
              recolherTudo()
              setGesto({ tipo: 'criar', trilha: t.id, x0: px, x1: px })
            }} />
        ))}

        {semEventos && trilhas.length > 0 && (
          <p className="meta px-4 py-3" style={{ paddingLeft: COL + 16 }}>Clique numa trilha para marcar o primeiro evento. Arraste para marcar um intervalo.</p>
        )}
      </div>

      {calAberto && calRow && <CalendarioModal cal={calRow} onFechar={() => setCalAberto(false)} />}
      {exTl && <ExcluirTimelineDialogo tl={tl} onFechar={() => setExTl(false)} onExcluido={() => nav('/timeline')} />}
      {novaTrilha && <NovaTrilhaModal modo={novaTrilha} timelineId={tl.id} ordem={trilhas.length} onFechar={() => setNovaTrilha(null)} />}
    </div>
  )
}

function TrilhaLinha(p: {
  trilha: Trilha; par: boolean; cal: CalendarioConfig; largura: number; x: (d: number) => number; escala: number
  eventos: EventoTimeline[]; noteMap: Map<string, Note>; marcos: { campo: string; dia: number }[]; vida: { campo: string; dia: number }[]
  gesto: Gesto | null; setGesto: (g: Gesto) => void; aplicar: (g: Extract<Gesto, { ev: string }>, dd: number) => [number, number | null]
  destaque: string | null; participa: (ev: EventoTimeline, pid: string) => boolean
  alternar: (ev: EventoTimeline) => void; recolherTudo: () => void
  arrastando: string | null; setArrastando: (id: string | null) => void; soltarEm: (id: string) => void
  onPointerDownVazio: (e: React.PointerEvent) => void
}) {
  const { trilha: t, x, cal } = p
  const [renomear, setRenomear] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const nav = useNavigate()
  const expandido = p.eventos.find((e) => e.expandido)
  const altura = t.recolhida ? ALT_RECOLHIDA : ALT_TRILHA + (expandido ? ALT_CORPO : 0)
  const linhaY = t.recolhida ? ALT_RECOLHIDA / 2 : LINHA_Y
  const noteTrilha = t.note_id ? p.noteMap.get(t.note_id) : undefined
  const marca = t.cor ?? (noteTrilha ? corMarcacao(noteTrilha.predefinicao_id) : 'var(--liquen)')
  const vidaDias = p.vida.map((v) => v.dia)
  const temVida = vidaDias.length >= 2

  return (
    <div className={`flex borda-b ${p.par ? 'elev' : 'bg-mesa'}`} style={{ height: altura, transition: 'height 180ms ease-out', opacity: p.arrastando === t.id ? 0.6 : 1 }}
      onDragOver={(e) => { if (p.arrastando) e.preventDefault() }} onDrop={() => p.soltarEm(t.id)}>
      {/* nome da trilha, fixo à esquerda */}
      <div className="shrink-0 flex items-start gap-1 px-2 borda-r" style={{ width: COL, paddingTop: t.recolhida ? 0 : 8, alignItems: t.recolhida ? 'center' : 'flex-start', borderLeft: `3px solid ${marca}` }}>
        <span draggable className="meta cursor-grab" style={{ marginTop: t.recolhida ? 0 : 6 }} aria-hidden title="Arraste para reordenar"
          onDragStart={() => p.setArrastando(t.id)} onDragEnd={() => p.setArrastando(null)}><IconArrastar width={14} height={14} /></span>
        <div className="min-w-0 flex-1">
          {renomear ? (
            <input autoFocus className="campo" defaultValue={t.nome} aria-label="Nome da trilha"
              onBlur={(e) => { const v = e.target.value.trim(); if (v) write.update('trilhas', { id: t.id }, { nome: v }); setRenomear(false) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenomear(false) }} />
          ) : (
            <button className="text-left text-ui truncate w-full min-h-alvo" aria-label={`Trilha ${t.nome}. Duplo clique renomeia.`} title={t.nome} onDoubleClick={() => setRenomear(true)}
              onClick={() => noteTrilha && useUI.getState().setDestaque(noteTrilha.id)}>{t.nome}</button>
          )}
          {!t.recolhida && (
            <div className="flex items-center gap-1">
              <MenuMais rotulo={`Opções da trilha ${t.nome}`} alinhar="esquerda"
                itens={[
                  { rotulo: 'Renomear trilha', onClick: () => setRenomear(true) },
                  noteTrilha && { rotulo: 'Abrir note', onClick: () => nav(`/note/${noteTrilha.id}`) },
                ]}
                excluir={() => setExcluir(true)} />
              {noteTrilha && <Link className="meta text-ui-sm" to={`/note/${noteTrilha.id}`}>Abrir note</Link>}
            </div>
          )}
        </div>
        {excluir && (
          <ConfirmarExclusao oque="a trilha" nome={t.nome} acao="Excluir trilha" onFechar={() => setExcluir(false)} onExcluir={() => excluirTrilha(t.id)}>
            <p>{p.eventos.length ? `${p.eventos.length === 1 ? 'O evento dela sai' : `Os ${p.eventos.length} eventos dela saem`} da timeline.` : 'A trilha não tem eventos.'} Os notes continuam existindo.</p>
          </ConfirmarExclusao>
        )}
        <button className="btn-icone meta" aria-label={t.recolhida ? `Expandir trilha ${t.nome}` : `Recolher trilha ${t.nome}`} aria-expanded={!t.recolhida}
          onClick={() => write.update('trilhas', { id: t.id }, { recolhida: !t.recolhida })}>
          <IconSeta width={14} height={14} style={{ transform: t.recolhida ? 'rotate(-90deg)' : undefined }} />
        </button>
      </div>

      {/* área do tempo */}
      <div className="relative flex-1 overflow-hidden" style={{ cursor: 'crosshair' }}
        onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as Element).tagName === 'svg') p.onPointerDownVazio(e) }}>
        <svg width={p.largura} height={altura} className="absolute inset-0" style={{ pointerEvents: 'none' }} aria-hidden>
          {temVida && (
            <rect x={x(Math.min(...vidaDias))} y={linhaY - 5} width={Math.max(2, x(Math.max(...vidaDias)) - x(Math.min(...vidaDias)))} height={10}
              fill="var(--papel)" fillOpacity={0.12} rx={2}><title>Vida de {t.nome}</title></rect>
          )}
          {/* o fio do tempo */}
          <line x1={0} x2={p.largura} y1={linhaY} y2={linhaY} stroke="var(--verdete)" strokeWidth={2} />
          {p.gesto?.tipo === 'criar' && p.gesto.trilha === t.id && (
            Math.abs(p.gesto.x1 - p.gesto.x0) > 6
              ? <rect x={Math.min(p.gesto.x0, p.gesto.x1)} y={linhaY - 12} width={Math.abs(p.gesto.x1 - p.gesto.x0)} height={24} fill="var(--papel)" fillOpacity={0.4} rx={2} />
              : <circle cx={p.gesto.x0} cy={linhaY} r={6} fill="var(--papel)" fillOpacity={0.5} />
          )}
        </svg>

        {/* marcos de data do note da trilha */}
        {p.marcos.map((m) => (
          <div key={m.campo} className="absolute" style={{ left: x(m.dia) - 6, top: linhaY - 6 }} title={`${m.campo}: ${formatarDia(cal, m.dia)}`}>
            <svg width={12} height={12} aria-hidden><circle cx={6} cy={6} r={5} fill="var(--mesa)" stroke="var(--verdete)" strokeWidth={2} /></svg>
            {!t.recolhida && <span className="absolute text-ui-sm meta whitespace-nowrap" style={{ top: 16, left: -2 }}>{m.campo}</span>}
          </div>
        ))}

        {[...p.eventos].sort((a, b) => a.inicio_json.dia - b.inicio_json.dia).map((ev, idx, ordenados) => {
          const note = p.noteMap.get(ev.note_id)
          if (!note) return null
          // eventos muito próximos: só o marcador, para os rótulos não se atropelarem
          const vizinho = ordenados[idx + 1], anterior = ordenados[idx - 1]
          const apertado = !ev.expandido && (
            (!!vizinho && x(vizinho.inicio_json.dia) - x(ev.inicio_json.dia) < 150)
            || (!!anterior && x(ev.inicio_json.dia) - x(anterior.inicio_json.dia) < 150))
          const g = p.gesto && 'ev' in p.gesto && p.gesto.ev === ev.id ? p.gesto : null
          const [ini, fim] = g ? p.aplicar(g, Math.round(g.dx / p.escala)) : [ev.inicio_json.dia, ev.fim_json?.dia ?? null]
          const x1 = x(ini), x2 = fim != null ? x(fim) : x1
          if (x2 < -400 || x1 > p.largura + 400) return null
          const dim = p.destaque && !p.participa(ev, p.destaque)
          const real = p.destaque && !dim
          const comecar = (tipo: 'mover' | 'ini' | 'fim') => (e: React.PointerEvent) => {
            e.stopPropagation(); if (e.button !== 0) return
            p.setGesto({ tipo, ev: ev.id, x0: e.clientX, dx: 0, ini: ev.inicio_json.dia, fim: ev.fim_json?.dia ?? null })
          }
          const rotuloData = formatarIntervalo(cal, ini, fim)
          return (
            <div key={ev.id} style={{ opacity: dim ? 0.25 : 1 }}>
              {!t.recolhida && !apertado && (
                <span className="absolute carimbo" style={{ left: x1 - 4, top: 6, ['--giro' as string]: `${giroDe(ev.id)}deg` }}>{formatarDia(cal, ini)}</span>
              )}
              {fim == null ? (
                <button className="absolute" style={{ left: x1 - 8, top: linhaY - 8, width: 16, height: 16, cursor: 'grab' }}
                  aria-label={`${note.titulo}, ${rotuloData}. Enter abre a descrição.`} aria-expanded={ev.expandido}
                  onPointerDown={comecar('mover')} onKeyDown={(e) => teclaEvento(e, ev, p.alternar)}>
                  <svg width={16} height={16} aria-hidden><circle cx={8} cy={8} r={6} fill="var(--verdete)" stroke={real || ev.expandido ? 'var(--papel)' : 'var(--mesa)'} strokeWidth={2} /></svg>
                </button>
              ) : (
                <div className="absolute papel flex items-center" style={{ left: x1, top: linhaY - 12, width: Math.max(8, x2 - x1), height: 24, borderLeftWidth: 0, outline: real || ev.expandido ? '2px solid var(--papel)' : undefined }}>
                  <span className="absolute h-full" style={{ left: 0, width: 8, cursor: 'ew-resize' }} onPointerDown={comecar('ini')} aria-hidden />
                  <button className="flex-1 h-full px-2 text-left truncate font-texto text-titulo-papel" style={{ cursor: 'grab', minWidth: 0 }}
                    aria-label={`${note.titulo}, ${rotuloData}. Enter abre a descrição.`} aria-expanded={ev.expandido}
                    onPointerDown={comecar('mover')} onKeyDown={(e) => teclaEvento(e, ev, p.alternar)}>{x2 - x1 > 60 ? note.titulo : ''}</button>
                  <span className="absolute h-full" style={{ right: 0, width: 8, cursor: 'ew-resize' }} onPointerDown={comecar('fim')} aria-hidden />
                </div>
              )}
              {!t.recolhida && !apertado && (fim == null || x2 - x1 <= 60) && (
                <p className={`absolute font-texto text-titulo-papel whitespace-nowrap ${note.titulo_provisorio ? 'italic meta' : ''}`}
                  style={{ left: x1 - 2, top: linhaY + 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={note.resumo}>{note.titulo}</p>
              )}
              {ev.expandido && !t.recolhida && <CorpoEvento ev={ev} note={note} left={Math.max(4, Math.min(x1, p.largura - 384))} top={linhaY + 40} cal={cal} onRecolher={() => p.alternar(ev)} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Rotação fixa do carimbo de cada evento, entre −1° e 1°. */
function giroDe(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return ((h % 201) - 100) / 100
}

function teclaEvento(e: React.KeyboardEvent, ev: EventoTimeline, alternar: (ev: EventoTimeline) => void) {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(ev); return }
  const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  if (d) {
    e.preventDefault()
    const passo = d * (e.shiftKey ? 10 : 1)
    write.update('eventos_timeline', { id: ev.id }, { inicio_json: { dia: ev.inicio_json.dia + passo }, fim_json: ev.fim_json ? { dia: ev.fim_json.dia + passo } : null })
  }
}

/** Expandido: abaixo da linha, a descrição editável (o notepad do note). */
function CorpoEvento({ ev, note, left, top, cal, onRecolher }: { ev: EventoTimeline; note: Note; left: number; top: number; cal: CalendarioConfig; onRecolher: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const nav = useNavigate()
  useEffect(() => { const r = requestAnimationFrame(() => setAberto(true)); return () => cancelAnimationFrame(r) }, [])
  const participantes = (() => {
    const c = camposDoNote(note.id).find((x) => x.tipo === 'relacao' && /participante/i.test(x.nome))
    if (!c) return []
    const v = cache('note_valores').find((x) => x.campo_id === c.id)?.valor_json
    return asArray(v).map((id) => cache('notes').find((n) => n.id === id)?.titulo).filter(Boolean)
  })()
  return (
    <div className="absolute elev borda rounded-painel" onPointerDown={(e) => e.stopPropagation()}
      style={{ left, top, width: 380, display: 'grid', gridTemplateRows: aberto ? '1fr' : '0fr', transition: 'grid-template-rows 180ms ease-out', cursor: 'auto' }}
      onTransitionEnd={() => setPronto(true)}>
      {/* depois de abrir, deixa o menu ⋯ sair da caixa */}
      <div style={{ overflow: pronto || reduzMovimento() ? 'visible' : 'hidden', minHeight: 0 }}>
        <div className="p-3 flex flex-col gap-2" style={{ maxHeight: ALT_CORPO - 52, overflowY: 'auto' }}>
          <input key={note.titulo} className={`bg-transparent font-texto text-titulo-papel ${note.titulo_provisorio ? 'italic' : ''}`} style={{ border: 0 }}
            defaultValue={note.titulo_provisorio ? '' : note.titulo} placeholder={note.titulo} aria-label="Título do evento"
            onBlur={(e) => { if (e.target.value.trim() !== (note.titulo_provisorio ? '' : note.titulo)) definirTitulo(note.id, e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
          <div className="flex flex-col gap-1 text-ui-sm">
            <span className="meta">Início</span>
            <DataInput rotulo="Início" valor={ev.inicio_json.dia} onChange={(d) => d != null && write.update('eventos_timeline', { id: ev.id }, { inicio_json: { dia: d } })} />
            <span className="meta">Fim <span>(vazio = evento pontual)</span></span>
            <DataInput rotulo="Fim" valor={ev.fim_json?.dia ?? null} onChange={(d) => write.update('eventos_timeline', { id: ev.id }, { fim_json: d == null || d <= ev.inicio_json.dia ? null : { dia: d } })} />
          </div>
          {participantes.length > 0 && <p className="meta text-ui-sm">Participantes: {participantes.join(', ')}</p>}
          <Notepad noteId={note.id} compacto placeholder="O que aconteceu?" />
        </div>
        <div className="flex gap-2 px-3 py-2 borda-t">
          <button className="btn" onClick={() => nav(`/note/${note.id}`)}>Abrir note</button>
          <MenuMais rotulo={`Opções do evento ${note.titulo}`} alinhar="esquerda" acima excluir={() => setExcluir(true)} />
          <div className="flex-1" />
          <button className="btn-icone" aria-label="Recolher evento" title={`Recolher (Esc). ${formatarDia(cal, ev.inicio_json.dia)}`} onClick={onRecolher}><IconFechar width={16} height={16} /></button>
        </div>
      </div>
      {excluir && (
        <ConfirmarExclusao oque="o evento" nome={note.titulo} acao="Excluir evento" onFechar={() => setExcluir(false)} onExcluir={() => excluirEvento(ev.id)}>
          <p>Sai só a marcação nesta timeline. O note do evento continua existindo, com a ficha e a história.</p>
        </ConfirmarExclusao>
      )}
    </div>
  )
}

function NovaTrilhaModal({ modo, timelineId, ordem, onFechar }: { modo: 'livre' | 'note'; timelineId: string; ordem: number; onFechar: () => void }) {
  const notes = useWsTable('notes')
  const [nome, setNome] = useState('')
  const [q, setQ] = useState('')
  const CORES = [75, 150, 190, 230, 265, 300].map((h) => `oklch(60% 0.07 ${h})`)
  const [cor, setCor] = useState(CORES[0])
  const criar = (n: string, noteId: string | null, c: string | null) => {
    write.insert('trilhas', [{ id: uid(), timeline_id: timelineId, nome: n, cor: c, ordem, note_id: noteId, recolhida: false }])
    toast('Trilha criada'); onFechar()
  }
  return (
    <Modal titulo={modo === 'livre' ? 'Nova trilha' : 'Trilha para note'} onFechar={onFechar}>
      {modo === 'livre' ? (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) criar(nome.trim(), null, cor) }}>
          <label className="flex flex-col gap-1"><span>Nome</span><input className="campo" required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <fieldset><legend className="mb-1">Cor</legend>
            <div className="flex gap-2">{CORES.map((c) => <button type="button" key={c} aria-label={`Cor ${c}`} aria-pressed={cor === c} onClick={() => setCor(c)} className="rounded-campo" style={{ width: 32, height: 32, background: c, border: cor === c ? '2px solid var(--papel)' : '1px solid var(--borda)' }} />)}</div>
          </fieldset>
          <div className="flex justify-end gap-2"><button type="button" className="btn" onClick={onFechar}>Cancelar</button><button className="btn-primario">Criar trilha</button></div>
        </form>
      ) : (
        <div>
          <p className="meta mb-2">A trilha fica ligada ao note. Datas marcadas como marco aparecem nela, e eventos criados nela ganham o note como participante.</p>
          <input className="campo mb-2" autoFocus placeholder="Buscar personagem, facção…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="flex flex-col gap-1" style={{ maxHeight: 320, overflow: 'auto' }}>
            {notes.filter((n) => n.titulo.toLowerCase().includes(q.toLowerCase())).slice(0, 40).map((n) => (
              <li key={n.id}><button className="btn w-full justify-start font-texto" onClick={() => criar(n.titulo, n.id, null)}>{n.titulo}</button></li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
