import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTable } from '../lib/data'
import { buscar } from '../lib/domain'
import { corMarcacao } from '../lib/color'
import { useUI } from '../store/ui'
import { Modal } from './Modal'

export function BuscaModal() {
  const { wsId, setBusca } = useUI()
  const notes = useTable('notes')
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const nav = useNavigate()
  const res = useMemo(() => (wsId ? buscar(wsId, q) : []), [wsId, q, notes])
  const abrir = (id: string) => { setBusca(false); nav(`/note/${id}`) }

  return (
    <Modal titulo="Buscar" onFechar={() => setBusca(false)} largura={600}>
      <input className="campo mb-3" placeholder="Título, resumo ou trecho do texto" value={q} autoFocus
        aria-label="Buscar notes"
        onChange={(e) => { setQ(e.target.value); setI(0) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(res.length - 1, x + 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
          if (e.key === 'Enter' && res[i]) abrir(res[i].note.id)
        }} />
      {res.length === 0 && <p className="meta">Nada encontrado para "{q}". Tente outra palavra ou crie um note com esse nome.</p>}
      <ul className="flex flex-col gap-1" role="listbox" aria-label="Resultados">
        {res.map((r, idx) => (
          <li key={r.note.id} role="option" aria-selected={idx === i}>
            <button className={`w-full text-left px-3 py-2 rounded-campo ${idx === i ? 'bg-mesa item-ativo' : ''}`}
              onMouseEnter={() => setI(idx)} onClick={() => abrir(r.note.id)}>
              <span className="flex items-center gap-2">
                <span aria-hidden style={{ width: 3, height: 16, background: corMarcacao(r.note.predefinicao_id) }} />
                <span className={`font-texto font-semibold ${r.note.titulo_provisorio ? 'italic' : ''}`}>{r.note.titulo}</span>
              </span>
              {r.trecho && <span className="block meta text-ui-sm mt-1">{r.trecho}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
