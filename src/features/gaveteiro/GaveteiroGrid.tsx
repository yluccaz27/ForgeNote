import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getBackend, uid, useTable, useWsTable, write } from '../../lib/data'
import { comprimir, useImagem } from '../../lib/images'
import { reduzMovimento } from '../../lib/hooks'
import { excluirGaveteiro } from '../../lib/excluir'
import { toast, toastErro, useUI } from '../../store/ui'
import { Modal } from '../../components/Modal'
import { MenuMais } from '../../components/Menu'
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao'
import { IconMais } from '../../components/Icons'
import type { Gaveteiro } from '../../lib/types'

// cores de capa: a mesma família dessaturada das marcações, mais escura para o texto papel
export const CORES_CAPA = ['#2A3135', ...[75, 150, 190, 230, 265, 300, 340].map((h) => `oklch(38% 0.04 ${h})`)]
const ICONES = ['✶', '▤', '☾', '⚔', '⌂', '✦', '◈', '☉']

export function GaveteiroGrid() {
  const gavs = useWsTable('gaveteiros')
  const pastas = useTable('pastas')
  const notePasta = useTable('note_pasta')
  const notes = useWsTable('notes')
  const [editar, setEditar] = useState<Gaveteiro | 'novo' | null>(null)
  const [excluir, setExcluir] = useState<Gaveteiro | null>(null)
  const vivos = new Set(notes.map((n) => n.id))
  const contagem = (gid: string) => {
    const ps = new Set(pastas.filter((p) => p.gaveteiro_id === gid).map((p) => p.id))
    return new Set(notePasta.filter((x) => ps.has(x.pasta_id) && vivos.has(x.note_id)).map((x) => x.note_id)).size
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-ui-lg font-semibold">Gaveteiros</h1>
        <div className="flex-1" />
        <button className="btn" onClick={() => setEditar('novo')}><IconMais width={16} height={16} /> Novo gaveteiro</button>
      </div>
      {gavs.length === 0 && (
        <div className="flex flex-col items-start gap-3 mb-4">
          <p>Um gaveteiro é um projeto: um livro, uma campanha de RPG. Dentro dele ficam as pastas com os notes.</p>
          <button className="btn" onClick={() => setEditar('novo')}><IconMais width={16} height={16} /> Novo gaveteiro</button>
        </div>
      )}
      <ul className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {[...gavs].sort((a, b) => a.ordem - b.ordem).map((g) => (
          <li key={g.id} className="relative">
            <FrenteGaveta g={g} contagem={contagem(g.id)} />
            <MenuMais rotulo={`Opções do gaveteiro ${g.nome}`} className="absolute" style={{ top: 8, right: 8 }}
              itens={[{ rotulo: 'Editar gaveteiro…', onClick: () => setEditar(g) }]} excluir={() => setExcluir(g)} />
          </li>
        ))}
      </ul>
      {editar && <EditarGaveteiro g={editar === 'novo' ? null : editar} onFechar={() => setEditar(null)} />}
      {excluir && (() => {
        const n = contagem(excluir.id)
        const np = pastas.filter((p) => p.gaveteiro_id === excluir.id).length
        return (
          <ConfirmarExclusao oque="o gaveteiro" nome={excluir.nome} acao="Excluir gaveteiro" digitarNome={n > 0}
            onExcluir={() => excluirGaveteiro(excluir.id)} onFechar={() => setExcluir(null)}>
            <p>{np === 1 ? 'A pasta dele sai junto.' : `As ${np} pastas dele saem junto.`}</p>
            <p>{n > 0 ? `Os ${n === 1 ? 'note guardado' : `${n} notes guardados`} aqui continuam existindo, em outros gaveteiros, no quadro e na timeline.` : 'Não há notes guardados aqui.'}</p>
          </ConfirmarExclusao>
        )
      })()}
    </div>
  )
}

/** Frente de gaveta de fichário: porta-etiqueta de latão com o nome e um puxador. */
function FrenteGaveta({ g, contagem }: { g: Gaveteiro; contagem: number }) {
  const img = useImagem(g.capa_url)
  const nav = useNavigate()
  const [abrindo, setAbrindo] = useState(false)
  return (
    <Link to={`/gaveteiro/${g.id}`} className={`gaveta ${abrindo ? 'gaveta-abrindo' : ''}`}
      style={{ ['--frente' as string]: g.cor }}
      onClick={(e) => {
        // a gaveta desliza 8px antes da troca de tela
        if (reduzMovimento() || e.ctrlKey || e.metaKey) return
        e.preventDefault(); setAbrindo(true)
        setTimeout(() => nav(`/gaveteiro/${g.id}`), 160)
      }}>
      <span className="porta-etiqueta">
        {img ? (
          <span className="etiqueta-papel flex items-center gap-2">
            <img src={img} alt="" className="rounded-papel shrink-0" style={{ width: 40, height: 40, objectFit: 'cover' }} />
            <span className="font-texto text-titulo-gaveteiro flex-1" style={{ overflowWrap: 'anywhere' }}>{g.nome}</span>
          </span>
        ) : (
          <span className="font-texto text-titulo-gaveteiro text-center" style={{ overflowWrap: 'anywhere' }}>{g.nome}</span>
        )}
      </span>
      <span className="puxador" aria-hidden />
      <span className="text-ui-sm meta">{contagem} {contagem === 1 ? 'note' : 'notes'}</span>
    </Link>
  )
}

function EditarGaveteiro({ g, onFechar }: { g: Gaveteiro | null; onFechar: () => void }) {
  const ws = useUI((s) => s.wsId)!
  const gavs = useWsTable('gaveteiros')
  const [nome, setNome] = useState(g?.nome ?? '')
  const [cor, setCor] = useState(g?.cor ?? CORES_CAPA[0])
  const [icone, setIcone] = useState(g?.icone ?? ICONES[0])
  const [capa, setCapa] = useState<string | null>(g?.capa_url ?? null)
  const [enviando, setEnviando] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  async function enviar(f: File) {
    setEnviando(true)
    try { setCapa(await getBackend().uploadImage(ws, await comprimir(f, 1200))) }
    catch (e) { toastErro(`Não foi possível enviar a capa: ${(e as Error).message}`) }
    setEnviando(false)
  }
  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    if (g) { write.update('gaveteiros', { id: g.id }, { nome: nome.trim(), cor, icone, capa_url: capa }); toast('Gaveteiro salvo') }
    else {
      const id = uid()
      write.insert('gaveteiros', [{ id, workspace_id: ws, nome: nome.trim(), cor, icone, capa_url: capa, ordem: gavs.length }])
      write.insert('pastas', [{ id: uid(), gaveteiro_id: id, nome: 'Geral', cor: null, origem: 'manual', regra_campo_id: null, regra_valor_note_id: null, regra_valor_texto: null }])
      toast('Gaveteiro criado')
    }
    onFechar()
  }

  return (
    <Modal titulo={g ? 'Editar gaveteiro' : 'Novo gaveteiro'} onFechar={onFechar}>
      <form className="flex flex-col gap-4" onSubmit={salvar}>
        <label className="flex flex-col gap-1"><span>Nome</span><input className="campo" required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <fieldset><legend className="mb-1">Cor</legend>
          <div className="flex flex-wrap gap-2">
            {CORES_CAPA.map((c) => (
              <button type="button" key={c} aria-label={`Cor ${c}`} aria-pressed={cor === c} onClick={() => setCor(c)}
                className="rounded-campo" style={{ width: 32, height: 32, background: c, border: cor === c ? '2px solid var(--papel)' : '1px solid var(--borda)' }} />
            ))}
          </div>
        </fieldset>
        <fieldset><legend className="mb-1">Ícone</legend>
          <div className="flex flex-wrap gap-1">
            {ICONES.map((i) => <button type="button" key={i} aria-pressed={icone === i} className={`btn-icone ${icone === i ? 'item-ativo bg-mesa' : ''}`} onClick={() => setIcone(i)}>{i}</button>)}
          </div>
        </fieldset>
        <div className="flex items-center gap-2">
          <input ref={file} type="file" accept="image/*" className="sr-only" aria-label="Imagem de capa" onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f) }} />
          <button type="button" className="btn" disabled={enviando} onClick={() => file.current?.click()}>{enviando ? 'Enviando…' : capa ? 'Trocar capa' : 'Enviar capa'}</button>
          {capa && <button type="button" className="btn-fantasma meta" onClick={() => setCapa(null)}>Remover capa</button>}
        </div>
        <div className="flex justify-end gap-2 borda-t pt-4">
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
            <button className="btn-primario">{g ? 'Salvar gaveteiro' : 'Criar gaveteiro'}</button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
