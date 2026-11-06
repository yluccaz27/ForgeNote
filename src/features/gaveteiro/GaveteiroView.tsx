import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { uid, useTable, useWsTable, write } from '../../lib/data'
import { useMiniaturas } from '../../lib/hooks'
import { normalizar } from '../../lib/text'
import { toast, useUI } from '../../store/ui'
import { Papel } from '../../components/Papel'
import { Modal } from '../../components/Modal'
import { MenuMais } from '../../components/Menu'
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao'
import { excluirPasta } from '../../lib/excluir'
import { IconEngrenagem, IconFechar, IconMais, IconPasta } from '../../components/Icons'
import type { Pasta } from '../../lib/types'

export function GaveteiroView() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const gav = useWsTable('gaveteiros').find((g) => g.id === id)
  const todasPastas = useTable('pastas')
  const notePasta = useTable('note_pasta')
  const notes = useWsTable('notes')
  const mini = useMiniaturas()
  const abrirCriar = useUI((s) => s.abrirCriar)
  const nav = useNavigate()
  const [arrastado, setArrastado] = useState<{ note: string; de: string | null } | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [renomear, setRenomear] = useState<string | null>(null)
  const [adicionar, setAdicionar] = useState(false)
  const [excluir, setExcluir] = useState<Pasta | null>(null)

  const pastas = useMemo(() => todasPastas.filter((p) => p.gaveteiro_id === id)
    .sort((a, b) => (a.origem === b.origem ? a.nome.localeCompare(b.nome) : a.origem === 'manual' ? -1 : 1)), [todasPastas, id])
  const pastaSel = params.get('pasta')
  const pasta = pastas.find((p) => p.id === pastaSel) ?? null
  const idsGav = new Set(pastas.map((p) => p.id))

  const naPasta = (pid: string) => new Set(notePasta.filter((x) => x.pasta_id === pid).map((x) => x.note_id))
  const visiveis = useMemo(() => {
    const ids = pasta ? naPasta(pasta.id) : new Set(notePasta.filter((x) => idsGav.has(x.pasta_id)).map((x) => x.note_id))
    return notes.filter((n) => ids.has(n.id)).sort((a, b) => a.titulo.localeCompare(b.titulo))
  }, [pasta, notePasta, notes, pastas])

  if (!gav) return <p className="p-6 meta">Gaveteiro não encontrado. <Link to="/gaveteiro" className="underline">Voltar aos gaveteiros</Link></p>

  const tambemEm = (noteId: string) => notePasta
    .filter((x) => x.note_id === noteId && x.pasta_id !== pasta?.id)
    .map((x) => todasPastas.find((p) => p.id === x.pasta_id)?.nome).filter(Boolean) as string[]

  function soltar(destino: Pasta, copiar: boolean) {
    setSobre(null)
    if (!arrastado || destino.origem === 'regra') return
    const { note, de } = arrastado
    setArrastado(null)
    if (naPasta(destino.id).has(note)) return
    write.insert('note_pasta', [{ note_id: note, pasta_id: destino.id }])
    const origem = pastas.find((p) => p.id === de)
    if (!copiar && origem?.origem === 'manual') write.remove('note_pasta', { note_id: note, pasta_id: origem.id })
    toast(copiar || !origem ? `Note também está em ${destino.nome}` : `Note movido para ${destino.nome}`)
  }

  function novaPasta() {
    const pid = uid()
    write.insert('pastas', [{ id: pid, gaveteiro_id: gav!.id, nome: 'Nova pasta', cor: null, origem: 'manual', regra_campo_id: null, regra_valor_note_id: null, regra_valor_texto: null }])
    setParams({ pasta: pid }); setRenomear(pid)
  }

  return (
    <div className="flex flex-col md:flex-row min-h-full">
      <nav aria-label="Pastas" className="elev md:borda-r md:w-painel shrink-0 p-4 flex flex-col gap-1" style={{ maxWidth: '100%' }}>
        <Link to="/gaveteiro" className="meta text-ui-sm mb-2">Gaveteiros</Link>
        <h1 className="font-texto text-titulo-note mb-4 flex items-center gap-2"><span aria-hidden className="text-ui-lg">{gav.icone}</span>{gav.nome}</h1>
        <button className="guia" aria-current={!pasta} onClick={() => setParams({})}>Todos os notes</button>
        {pastas.map((p) => renomear === p.id ? (
          <input key={p.id} autoFocus className="campo valor" defaultValue={p.nome} aria-label="Nome da pasta"
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.nome) write.update('pastas', { id: p.id }, { nome: v }); setRenomear(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenomear(null) }} />
        ) : (
          <button key={p.id}
            className="guia" aria-current={pasta?.id === p.id}
            style={sobre === p.id ? { outline: '2px dashed var(--verdete)', outlineOffset: -2 } : undefined}
            title={p.origem === 'regra' ? `automática, pelo campo ${p.regra_campo_id ?? ''}` : 'Duplo clique para renomear'}
            onClick={() => setParams({ pasta: p.id })}
            onDoubleClick={() => p.origem === 'manual' && setRenomear(p.id)}
            onDragOver={(e) => { if (p.origem === 'manual' && arrastado) { e.preventDefault(); setSobre(p.id) } }}
            onDragLeave={() => setSobre(null)}
            onDrop={(e) => soltar(p, e.ctrlKey || e.altKey)}>
            {p.origem === 'regra' ? <IconEngrenagem width={14} height={14} className="meta" /> : <IconPasta width={16} height={16} className="meta" />}
            <span className="flex-1 truncate valor">{p.nome}</span>
            <span className="meta text-ui-sm">{naPasta(p.id).size}</span>
          </button>
        ))}
        <button className="btn mt-2" onClick={novaPasta}><IconMais width={16} height={16} /> Nova pasta</button>
        <p className="meta text-ui-sm mt-2">Arraste um papel para outra pasta para mover. Com Ctrl, ele fica nas duas.</p>
      </nav>

      <section className="flex-1 min-w-0 p-6" aria-label={pasta ? `Pasta ${pasta.nome}` : 'Todos os notes'}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className={`text-ui-lg font-semibold ${pasta ? 'font-texto' : ''}`}>{pasta ? pasta.nome : 'Todos os notes'}</h2>
          {pasta?.origem === 'regra' && <span className="chip meta" title={`Mantida pelo campo ${pasta.regra_campo_id ?? ''}`}>automática</span>}
          {pasta?.origem === 'manual' && (
            <MenuMais rotulo={`Opções da pasta ${pasta.nome}`} alinhar="esquerda"
              itens={[
                { rotulo: 'Renomear pasta', onClick: () => setRenomear(pasta.id) },
                { rotulo: 'Adicionar note existente…', onClick: () => setAdicionar(true) },
              ]}
              excluir={() => setExcluir(pasta)} />
          )}
          <div className="flex-1" />
          {pasta?.origem === 'manual' && <button className="btn" onClick={() => setAdicionar(true)}>Adicionar note existente</button>}
          <button className="btn" onClick={() => abrirCriar({ pastaId: pasta?.origem === 'manual' ? pasta.id : pastas.find((p) => p.origem === 'manual')?.id })}><IconMais width={16} height={16} /> Novo note aqui</button>
        </div>

        {visiveis.length === 0 && <p className="meta">{pasta?.origem === 'regra' ? 'Nenhum note tem este valor agora. A pasta some quando ficar vazia.' : 'Arraste notes para cá ou crie um novo.'}</p>}
        <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          {visiveis.map((n) => {
            const em = tambemEm(n.id)
            return (
              <li key={n.id} className="relative" draggable
                onDragStart={(e) => { setArrastado({ note: n.id, de: pasta?.id ?? null }); e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', n.titulo) }}
                onDragEnd={() => { setArrastado(null); setSobre(null) }}>
                <button className="block w-full text-left" onClick={() => nav(`/note/${n.id}`)}>
                  <Papel note={n} miniatura={mini.get(n.id)} resumo className={arrastado?.note === n.id ? 'papel-levantado' : ''}
                    extra={em.length > 0 && <p className="text-ui-sm mt-1" style={{ opacity: 0.75 }}>também em: {em.join(', ')}</p>} />
                </button>
                {pasta?.origem === 'manual' && (
                  <button className="btn-icone absolute text-tinta" style={{ top: 4, right: 4 }} aria-label={`Tirar ${n.titulo} desta pasta`}
                    title="Tirar desta pasta" onClick={() => write.remove('note_pasta', { note_id: n.id, pasta_id: pasta.id })}><IconFechar width={14} height={14} /></button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
      {adicionar && pasta && <AdicionarExistente pasta={pasta} onFechar={() => setAdicionar(false)} />}
      {excluir && (() => {
        const n = [...naPasta(excluir.id)].filter((nid) => notes.some((x) => x.id === nid)).length
        return (
          <ConfirmarExclusao oque="a pasta" nome={excluir.nome} acao="Excluir pasta"
            onExcluir={() => { excluirPasta(excluir); setParams({}) }} onFechar={() => setExcluir(null)}>
            <p>{n ? `Os ${n === 1 ? 'note' : `${n} notes`} dela continuam existindo. Só deixam de estar nesta pasta.` : 'A pasta está vazia.'}</p>
            <p className="meta">Quadros que mostravam esta pasta deixam de mostrar esses notes.</p>
          </ConfirmarExclusao>
        )
      })()}
    </div>
  )
}

function AdicionarExistente({ pasta, onFechar }: { pasta: Pasta; onFechar: () => void }) {
  const notes = useWsTable('notes')
  const notePasta = useTable('note_pasta')
  const [q, setQ] = useState('')
  const dentro = new Set(notePasta.filter((x) => x.pasta_id === pasta.id).map((x) => x.note_id))
  const lista = notes.filter((n) => !dentro.has(n.id) && normalizar(n.titulo).includes(normalizar(q))).slice(0, 30)
  return (
    <Modal titulo={`Adicionar em ${pasta.nome}`} onFechar={onFechar}>
      <input className="campo mb-3" placeholder="Buscar note" value={q} onChange={(e) => setQ(e.target.value)} />
      {lista.length === 0 && <p className="meta">Nenhum note fora desta pasta com esse nome.</p>}
      <ul className="flex flex-col gap-1">
        {lista.map((n) => (
          <li key={n.id}><button className="btn w-full justify-start font-texto" onClick={() => { write.insert('note_pasta', [{ note_id: n.id, pasta_id: pasta.id }]); toast(`${n.titulo} adicionado em ${pasta.nome}`) }}>{n.titulo}</button></li>
        ))}
      </ul>
    </Modal>
  )
}
