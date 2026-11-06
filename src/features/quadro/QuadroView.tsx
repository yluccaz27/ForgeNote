import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ReactFlow, ReactFlowProvider, Controls, useReactFlow, applyNodeChanges, ConnectionMode,
  type NodeChange, type Connection, type EdgeMouseHandler,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { uid, useTable, useWsTable, write, cache } from '../../lib/data'
import { useMiniaturas } from '../../lib/hooks'
import { toast, toastDesfazer, useUI } from '../../store/ui'
import { dica, digitando, useAtalho } from '../../lib/shortcuts'
import { MenuMais } from '../../components/Menu'
import { ExcluirQuadroDialogo } from './ExcluirQuadro'
import { NoteEditor } from '../note/NoteEditor'
import { IconFechar } from '../../components/Icons'
import { FiltroModal } from './QuadroList'
import { PaperNode, type PaperNodeT } from './PaperNode'
import { ThreadEdge, type FioEdgeT } from './ThreadEdge'
import type { Conexao } from '../../lib/types'

const nodeTypes = { papel: PaperNode }
const edgeTypes = { fio: ThreadEdge }

export function QuadroView() {
  return <ReactFlowProvider><Quadro /></ReactFlowProvider>
}

function Quadro() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const quadro = useWsTable('quadros').find((q) => q.id === id)
  const notes = useWsTable('notes')
  const pastas = useTable('pastas')
  const notePasta = useTable('note_pasta')
  const posicoes = useTable('quadro_posicoes')
  const conexoes = useTable('conexoes')
  const ocultas = useTable('quadro_conexoes_ocultas')
  const mini = useMiniaturas()
  const { painelNote, setPainelNote } = useUI()
  const rf = useReactFlow()
  const nav = useNavigate()
  const [foco, setFoco] = useState<string | null>(params.get('foco'))
  const [mostrarOcultas, setMostrarOcultas] = useState(false)
  const [filtro, setFiltro] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [selNode, setSelNode] = useState<string | null>(null)
  const conhecidas = useRef<Set<string> | null>(null)
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 767px)').matches

  // notes que entram pelo filtro
  const idsNoQuadro = useMemo(() => {
    if (!quadro) return new Set<string>()
    const f = quadro.filtro_json
    const ps = new Set([...(f.pastas ?? []), ...pastas.filter((p) => (f.gaveteiros ?? []).includes(p.gaveteiro_id)).map((p) => p.id)])
    return new Set(notePasta.filter((x) => ps.has(x.pasta_id)).map((x) => x.note_id))
  }, [quadro, pastas, notePasta])
  const minhasPos = useMemo(() => new Map(posicoes.filter((p) => p.quadro_id === id).map((p) => [p.note_id, p])), [posicoes, id])
  const visiveis = useMemo(() => notes.filter((n) => idsNoQuadro.has(n.id) && !minhasPos.get(n.id)?.oculto), [notes, idsNoQuadro, minhasPos])
  const foraDoQuadro = notes.filter((n) => idsNoQuadro.has(n.id) && minhasPos.get(n.id)?.oculto).length
  const idsVis = useMemo(() => new Set(visiveis.map((n) => n.id)), [visiveis])
  const ocultasSet = useMemo(() => new Set(ocultas.filter((o) => o.quadro_id === id).map((o) => o.conexao_id)), [ocultas, id])
  const fios = useMemo(() => conexoes.filter((c) => idsVis.has(c.origem_note_id) && idsVis.has(c.destino_note_id)), [conexoes, idsVis])

  // posições iniciais para quem ainda não tem: grade, e grava
  useEffect(() => {
    if (!id) return
    const faltam = visiveis.filter((n) => !minhasPos.has(n.id))
    if (!faltam.length) return
    const base = minhasPos.size
    write.upsert('quadro_posicoes', faltam.map((n, i) => ({
      quadro_id: id, note_id: n.id, x: 40 + ((base + i) % 5) * 260, y: 40 + Math.floor((base + i) / 5) * 140, oculto: false,
    })))
  }, [visiveis, minhasPos, id])

  const vizinhos = useMemo(() => {
    if (!foco) return null
    const s = new Set([foco])
    fios.forEach((c) => { if (c.origem_note_id === foco) s.add(c.destino_note_id); if (c.destino_note_id === foco) s.add(c.origem_note_id) })
    return s
  }, [foco, fios])

  const [nodes, setNodes] = useState<PaperNodeT[]>([])
  useEffect(() => {
    setNodes((atual) => visiveis.map((n) => {
      const p = minhasPos.get(n.id)
      const velho = atual.find((x) => x.id === n.id)
      return {
        id: n.id, type: 'papel',
        position: arrastando === n.id && velho ? velho.position : { x: p?.x ?? 0, y: p?.y ?? 0 },
        selected: velho?.selected ?? false,
        data: { note: n, miniatura: mini.get(n.id), esmaecido: !!vizinhos && !vizinhos.has(n.id), destacado: foco === n.id, arrastando: arrastando === n.id },
        ariaLabel: `${n.titulo}. Enter abre, setas movem.`,
      }
    }))
  }, [visiveis, minhasPos, mini, vizinhos, foco, arrastando])

  const removerFio = useCallback((c: Conexao) => {
    if (!id) return
    if (c.tipo === 'campo') {
      if (ocultasSet.has(c.id)) { write.remove('quadro_conexoes_ocultas', { quadro_id: id, conexao_id: c.id }); toast('Conexão mostrada neste quadro'); return }
      // apagar fio de campo só esconde neste quadro; a ficha continua com a relação
      write.insert('quadro_conexoes_ocultas', [{ quadro_id: id, conexao_id: c.id }])
      toast('Conexão ocultada neste quadro.', { rotulo: 'Desfazer', fn: () => write.remove('quadro_conexoes_ocultas', { quadro_id: id, conexao_id: c.id }) })
    } else {
      write.remove('conexoes', { id: c.id })
      toastDesfazer('Linha excluída.', () => write.insert('conexoes', [c]))
    }
  }, [id, ocultasSet])

  const edges: FioEdgeT[] = useMemo(() => {
    const novas = conhecidas.current
    const out = fios
      .filter((c) => mostrarOcultas || !ocultasSet.has(c.id))
      .map((c) => ({
        id: c.id, source: c.origem_note_id, target: c.destino_note_id, type: 'fio' as const,
        data: {
          tipo: c.tipo, oculta: ocultasSet.has(c.id), novo: !!novas && !novas.has(c.id), rotulo: c.rotulo,
          esmaecido: !!foco && c.origem_note_id !== foco && c.destino_note_id !== foco,
          onRotulo: (r: string) => write.update('conexoes', { id: c.id }, { rotulo: r }),
          onRemover: () => removerFio(c),
        },
      }))
    return out
  }, [fios, ocultasSet, mostrarOcultas, foco, removerFio])
  // registra as conexões já vistas, para animar só as que nascerem depois
  useEffect(() => {
    if (!conhecidas.current) { conhecidas.current = new Set(fios.map((c) => c.id)); return }
    const t = setTimeout(() => fios.forEach((c) => conhecidas.current!.add(c.id)), 400)
    return () => clearTimeout(t)
  }, [fios])

  const salvarPos = (noteId: string, x: number, y: number) =>
    id && write.upsert('quadro_posicoes', [{ quadro_id: id, note_id: noteId, x: Math.round(x), y: Math.round(y), oculto: false }])

  const onNodesChange = useCallback((ch: NodeChange<PaperNodeT>[]) => {
    setNodes((ns) => applyNodeChanges(ch, ns))
    for (const c of ch) if (c.type === 'select' && c.selected) setSelNode(c.id)
  }, [])

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return
    // a conexão manual lembra o quadro onde foi puxada (para excluir junto com ele)
    write.insert('conexoes', [{ id: uid(), origem_note_id: c.source, destino_note_id: c.target, rotulo: '', tipo: 'manual', campo_id: null, quadro_id: id ?? null }])
    toast('Linha criada. Dê duplo clique no rótulo para nomear.')
  }, [id])

  const onEdgeClick: EdgeMouseHandler<FioEdgeT> = useCallback(() => {}, [])

  function organizar() {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'LR', nodesep: 48, ranksep: 120 })
    g.setDefaultEdgeLabel(() => ({}))
    for (const n of rf.getNodes()) g.setNode(n.id, { width: n.measured?.width ?? 200, height: n.measured?.height ?? 48 })
    for (const e of edges) if (!e.data?.oculta) g.setEdge(e.source, e.target)
    dagre.layout(g)
    if (!id) return
    write.upsert('quadro_posicoes', visiveis.map((n) => {
      const p = g.node(n.id)
      return { quadro_id: id, note_id: n.id, x: Math.round(p.x - p.width / 2), y: Math.round(p.y - p.height / 2), oculto: false }
    }))
    setTimeout(() => rf.fitView({ padding: 0.2, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 }), 50)
    toast('Quadro organizado')
  }

  // teclado: Tab entre papéis (nativo do React Flow), Enter abre, setas movem 8px (Shift 32px), F foco
  function onKeyDown(e: React.KeyboardEvent) {
    if (digitando(e.nativeEvent)) return
    const el = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement | null
    const nid = el?.dataset.id ?? selNode
    if (e.key === 'Escape') { if (painelNote) setPainelNote(null); else setFoco(null); return }
    if (!el || !nid) return
    if (e.key === 'Enter') { e.preventDefault(); setPainelNote(nid); return }
    const passo = e.shiftKey ? 32 : 8
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key]
    if (d) {
      e.preventDefault()
      const p = minhasPos.get(nid)
      if (p) salvarPos(nid, p.x + d[0], p.y + d[1])
    }
  }

  useEffect(() => {
    const f = params.get('foco')
    if (f) { setFoco(f); setTimeout(() => rf.fitView({ nodes: [{ id: f }], maxZoom: 1.2, padding: 1 }), 100) }
  }, [params, rf])
  useEffect(() => () => setPainelNote(null), [setPainelNote])
  // F: foco no papel com o foco do teclado, ou no selecionado
  useAtalho('quadro.foco', () => {
    const el = (document.activeElement as HTMLElement | null)?.closest('.react-flow__node') as HTMLElement | null
    const nid = el?.dataset.id ?? selNode
    setFoco((f) => (f ? null : nid ?? null))
  })

  if (!quadro) return <p className="p-6 meta">Quadro não encontrado. <Link to="/quadro" className="underline">Voltar aos quadros</Link></p>
  const vazio = !(quadro.filtro_json.gaveteiros?.length || quadro.filtro_json.pastas?.length)
  const ligados = new Set(fios.filter((c) => !ocultasSet.has(c.id)).flatMap((c) => [c.origem_note_id, c.destino_note_id]))
  const soltos = visiveis.filter((n) => !ligados.has(n.id)).length

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 borda-b">
        <input key={quadro.nome} className="bg-transparent font-texto text-ui-lg font-semibold" style={{ border: 0, minWidth: 0 }} defaultValue={quadro.nome} aria-label="Nome do quadro"
          onBlur={(e) => e.target.value.trim() && e.target.value !== quadro.nome && write.update('quadros', { id: quadro.id }, { nome: e.target.value.trim() })} />
        <MenuMais rotulo={`Opções do quadro ${quadro.nome}`} alinhar="esquerda"
          excluir={() => setExcluir(true)} />
        <span className="meta text-ui-sm" aria-live="polite">{soltos === 0 ? 'Todos os notes estão ligados' : `${soltos} ${soltos === 1 ? 'note sem conexão' : 'notes sem conexão'}`}</span>
        <div className="flex-1" />
        <button className="btn" onClick={() => setFiltro(true)}>Escolher pastas</button>
        <label className="btn"><input type="checkbox" checked={mostrarOcultas} onChange={(e) => setMostrarOcultas(e.target.checked)} /> Mostrar conexões ocultas</label>
        {foraDoQuadro > 0 && (
          <button className="btn" onClick={() => write.update('quadro_posicoes', { quadro_id: quadro.id, oculto: true }, { oculto: false })}>Trazer de volta {foraDoQuadro} {foraDoQuadro === 1 ? 'papel' : 'papéis'}</button>
        )}
        <button className="btn" onClick={organizar} disabled={!visiveis.length}>Organizar automaticamente</button>
        <button className="btn" aria-pressed={!!foco} onClick={() => setFoco((f) => (f ? null : selNode))} disabled={!foco && !selNode} title={dica('quadro.foco', foco ? 'Sair do foco' : 'Focar')}>{foco ? 'Sair do foco' : 'Focar'}</button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 relative mesa-quadro" onKeyDown={onKeyDown}>
          {vazio ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <p>Escolha as pastas que entram neste quadro.</p>
              <button className="btn-primario" onClick={() => setFiltro(true)}>Escolher pastas</button>
            </div>
          ) : (
            <ReactFlow<PaperNodeT, FioEdgeT>
              nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStart={(_, n) => setArrastando(n.id)}
              onNodeDragStop={(_, n) => { setArrastando(null); salvarPos(n.id, n.position.x, n.position.y) }}
              onNodeClick={(_, n) => setFoco(n.id)}
              onNodeDoubleClick={(_, n) => setPainelNote(n.id)}
              onPaneClick={() => setFoco(null)}
              onConnect={onConnect} onEdgeClick={onEdgeClick}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={!mobile} nodesConnectable={!mobile}
              deleteKeyCode={null} disableKeyboardA11y zoomOnDoubleClick={false}
              fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} maxZoom={2}
              proOptions={{ hideAttribution: true }}
              aria-label={`Quadro ${quadro.nome}`}
            >
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          )}
          {!vazio && visiveis.length === 0 && (
            <p className="absolute meta" style={{ top: 16, left: 16 }}>As pastas escolhidas estão vazias. Coloque notes nelas pelo gaveteiro.</p>
          )}
        </div>

        {painelNote && (
          <aside className="elev borda-l shrink-0 overflow-auto painel-desliza" style={{ width: 'min(480px, 100%)' }} aria-label="Note aberto">
            <div className="flex items-center gap-2 px-4 py-2 borda-b">
              <button className="btn" onClick={() => nav(`/note/${painelNote}`)}>Abrir note</button>
              <button className="btn" onClick={() => { write.upsert('quadro_posicoes', [{ ...(minhasPos.get(painelNote) ?? { quadro_id: quadro.id, note_id: painelNote, x: 0, y: 0 }), oculto: true }]); setPainelNote(null); toast('Papel tirado deste quadro') }}>Tirar deste quadro</button>
              <div className="flex-1" />
              <button className="btn-icone" aria-label="Fechar painel" onClick={() => setPainelNote(null)}><IconFechar /></button>
            </div>
            {cache('notes').some((n) => n.id === painelNote) && <NoteEditor key={painelNote} noteId={painelNote} compacto onExcluido={() => setPainelNote(null)} />}
          </aside>
        )}
      </div>

      {excluir && <ExcluirQuadroDialogo quadro={quadro} onFechar={() => setExcluir(false)} onExcluido={() => nav('/quadro')} />}
      {filtro && (
        <FiltroModal titulo="Pastas deste quadro" inicial={quadro.filtro_json} onFechar={() => setFiltro(false)}
          onSalvar={(f) => { write.update('quadros', { id: quadro.id }, { filtro_json: f }); setFiltro(false); toast('Pastas salvas') }} />
      )}
    </div>
  )
}
