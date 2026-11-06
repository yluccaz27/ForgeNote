import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTable, useWsTable } from '../../lib/data'
import { useMiniaturas } from '../../lib/hooks'
import { useUI } from '../../store/ui'
import { Papel } from '../../components/Papel'

export function NotesList() {
  const notes = useWsTable('notes')
  const predefs = useWsTable('predefinicoes')
  const notePasta = useTable('note_pasta')
  const pastas = useTable('pastas')
  const mini = useMiniaturas()
  const abrirCriar = useUI((s) => s.abrirCriar)
  const [filtro, setFiltro] = useState<string>('todos')
  const lista = useMemo(() => notes
    .filter((n) => filtro === 'todos' || (filtro === 'zerado' ? !n.predefinicao_id : n.predefinicao_id === filtro))
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')), [notes, filtro])

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-ui-lg font-semibold">Notes</h1>
        <span className="meta text-ui-sm">{notes.length} no workspace</span>
        <div className="flex-1" />
        <label className="flex items-center gap-2"><span className="meta">Mostrar</span>
          <select className="campo" style={{ width: 'auto' }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {predefs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            <option value="zerado">Sem predefinição</option>
          </select>
        </label>
      </div>
      {lista.length === 0 && (
        <div className="flex flex-col items-start gap-3">
          <p>Nenhum note aqui ainda.</p>
          <button className="btn-primario" onClick={() => abrirCriar()}>Criar note</button>
        </div>
      )}
      <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {lista.map((n) => {
          const em = notePasta.filter((x) => x.note_id === n.id).map((x) => pastas.find((p) => p.id === x.pasta_id)?.nome).filter(Boolean)
          return (
            <li key={n.id}>
              <Link to={`/note/${n.id}`} className="block">
                <Papel note={n} miniatura={mini.get(n.id)} resumo
                  extra={em.length > 0 && <p className="text-ui-sm mt-1" style={{ opacity: 0.75 }}>em {em.join(', ')}</p>} />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
