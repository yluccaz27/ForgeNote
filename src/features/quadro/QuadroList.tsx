import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { uid, useTable, useWsTable, write } from '../../lib/data'
import { useUI, toast } from '../../store/ui'
import { Modal } from '../../components/Modal'
import { IconMais } from '../../components/Icons'
import type { Quadro } from '../../lib/types'

export function QuadroList() {
  const quadros = useWsTable('quadros')
  const [novo, setNovo] = useState(false)
  const nav = useNavigate()
  const ws = useUI((s) => s.wsId)!
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-ui-lg font-semibold">Quadros</h1>
        <div className="flex-1" />
        <button className="btn" onClick={() => setNovo(true)}><IconMais width={16} height={16} /> Novo quadro</button>
      </div>
      {quadros.length === 0 && <p className="mb-4">Um quadro mostra os notes de algumas pastas como papéis numa mesa, ligados por fios. Crie o primeiro.</p>}
      <ul className="flex flex-col gap-2" style={{ maxWidth: 640 }}>
        {quadros.map((q) => (
          <li key={q.id}><Link to={`/quadro/${q.id}`} className="btn w-full justify-start">{q.nome}</Link></li>
        ))}
      </ul>
      {novo && (
        <FiltroModal titulo="Novo quadro" comNome onFechar={() => setNovo(false)} inicial={{ gaveteiros: [], pastas: [] }}
          onSalvar={(f, nome) => {
            const id = uid()
            write.insert('quadros', [{ id, workspace_id: ws, nome: nome || 'Quadro sem nome', filtro_json: f }])
            toast('Quadro criado'); setNovo(false); nav(`/quadro/${id}`)
          }} />
      )}
    </div>
  )
}

export function FiltroModal({ titulo, inicial, onSalvar, onFechar, comNome = false, nomeInicial = '' }: {
  titulo: string; inicial: Quadro['filtro_json']; comNome?: boolean; nomeInicial?: string
  onSalvar: (f: Quadro['filtro_json'], nome: string) => void; onFechar: () => void
}) {
  const gavs = useWsTable('gaveteiros')
  const pastas = useTable('pastas')
  const [nome, setNome] = useState(nomeInicial)
  const [g, setG] = useState<string[]>(inicial.gaveteiros ?? [])
  const [p, setP] = useState<string[]>(inicial.pastas ?? [])
  const tog = (l: string[], set: (x: string[]) => void, id: string) => set(l.includes(id) ? l.filter((x) => x !== id) : [...l, id])
  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); onSalvar({ gaveteiros: g, pastas: p }, nome.trim()) }}>
        {comNome && <label className="flex flex-col gap-1"><span>Nome</span><input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} /></label>}
        <p className="meta">Marque um gaveteiro inteiro ou só algumas pastas.</p>
        {gavs.map((gv) => (
          <fieldset key={gv.id}>
            <label className="flex items-center gap-2 font-semibold mb-1">
              <input type="checkbox" checked={g.includes(gv.id)} onChange={() => tog(g, setG, gv.id)} /> {gv.nome} inteiro
            </label>
            <div className="flex flex-wrap gap-3" style={{ paddingLeft: 24, opacity: g.includes(gv.id) ? 0.5 : 1 }}>
              {pastas.filter((x) => x.gaveteiro_id === gv.id).map((x) => (
                <label key={x.id} className="flex items-center gap-1">
                  <input type="checkbox" disabled={g.includes(gv.id)} checked={p.includes(x.id) || g.includes(gv.id)} onChange={() => tog(p, setP, x.id)} /> {x.nome}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn-primario">Salvar pastas</button>
        </div>
      </form>
    </Modal>
  )
}
