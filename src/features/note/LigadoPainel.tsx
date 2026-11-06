import { Link } from 'react-router-dom'
import { useTable } from '../../lib/data'
import { definirResumo } from '../../lib/domain'
import { useNote } from '../../lib/hooks'
import { getBackend } from '../../lib/data'
import { IconProvisorio } from '../../components/Icons'

/** Painel à direita do note: "Ligado a", timeline e resumo. */
export function LigadoPainel({ noteId }: { noteId: string }) {
  const note = useNote(noteId)
  const notes = useTable('notes')
  const conexoes = useTable('conexoes')
  const eventos = useTable('eventos_timeline')
  const timelines = useTable('timelines')
  if (!note) return null

  const ligados = conexoes
    .filter((c) => c.origem_note_id === noteId || c.destino_note_id === noteId)
    .map((c) => {
      const saida = c.origem_note_id === noteId
      const outro = notes.find((n) => n.id === (saida ? c.destino_note_id : c.origem_note_id))
      return { c, outro, saida }
    })
    .filter((x) => x.outro)
  const tlVisivel = new Set(timelines.map((t) => t.id))
  const meusEventos = eventos.filter((e) => e.note_id === noteId && tlVisivel.has(e.timeline_id))
  const participacoes = eventos.filter((e) => tlVisivel.has(e.timeline_id) && conexoes.some((c) => c.origem_note_id === e.note_id && c.destino_note_id === noteId && c.tipo === 'campo'))
  const naTimeline = new Set([...meusEventos, ...participacoes].map((e) => e.id)).size
  const tlId = (meusEventos[0] ?? participacoes[0])?.timeline_id
  const eu = getBackend().userId()

  return (
    <aside aria-label="Ligado a" className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="text-ui-lg mb-2">Ligado a</h2>
        {ligados.length === 0 && <p className="meta">Nada ainda. Use um campo Relação na ficha ou puxe um fio no quadro.</p>}
        <ul className="flex flex-col gap-1">
          {ligados.map(({ c, outro, saida }) => (
            <li key={c.id} className="flex items-baseline gap-2">
              <span aria-hidden className="text-verdete">─</span>
              <span className="min-w-0">
                <Link to={`/note/${outro!.id}`} className="font-texto">{outro!.titulo}</Link>
                <span className="meta text-ui-sm block">{saida ? c.rotulo || 'ligação' : `${c.rotulo || 'ligação'}, vindo de lá`}{c.tipo === 'manual' ? ', no quadro' : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-ui-lg mb-2">Na timeline: {naTimeline}</h2>
        {tlId && <Link className="btn" to={`/timeline/${tlId}?note=${noteId}`}>Ver na timeline {timelines.find((t) => t.id === tlId)?.nome}</Link>}
      </section>

      <section>
        <h2 className="text-ui-lg mb-2 flex items-center gap-2">Resumo {note.resumo_provisorio && <span className="meta" title="Gerado do texto. Edite para fixar."><IconProvisorio width={16} height={16} /></span>}</h2>
        <textarea key={note.resumo} className="campo valor py-2" rows={4} defaultValue={note.resumo} aria-label="Resumo"
          placeholder="Gerado das primeiras frases da história"
          onBlur={(e) => { if (e.target.value.trim() !== note.resumo) definirResumo(noteId, e.target.value) }} />
      </section>

      {note.updated_at && (
        <p className="meta text-ui-sm">
          Editado em {new Date(note.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          {note.updated_by ? (note.updated_by === eu ? ', por você' : ', pelo outro membro') : ''}
        </p>
      )}
    </aside>
  )
}
