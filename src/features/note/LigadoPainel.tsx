import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTable } from '../../lib/data'
import { definirResumo, excluirNote, usosDoNote } from '../../lib/domain'
import { useNote } from '../../lib/hooks'
import { getBackend } from '../../lib/data'
import { toast } from '../../store/ui'
import { IconProvisorio } from '../../components/Icons'
import { Modal } from '../../components/Modal'
import { SalvarPredefModal } from './SalvarPredefModal'

/** Painel à direita do note: "Ligado a", pastas, timeline, resumo. */
export function LigadoPainel({ noteId }: { noteId: string }) {
  const note = useNote(noteId)
  const notes = useTable('notes')
  const conexoes = useTable('conexoes')
  const notePasta = useTable('note_pasta')
  const pastas = useTable('pastas')
  const gavs = useTable('gaveteiros')
  const eventos = useTable('eventos_timeline')
  const timelines = useTable('timelines')
  const [predef, setPredef] = useState(false)
  const [excluir, setExcluir] = useState<string[] | null>(null)
  const nav = useNavigate()
  if (!note) return null

  const ligados = conexoes
    .filter((c) => c.origem_note_id === noteId || c.destino_note_id === noteId)
    .map((c) => {
      const saida = c.origem_note_id === noteId
      const outro = notes.find((n) => n.id === (saida ? c.destino_note_id : c.origem_note_id))
      return { c, outro, saida }
    })
    .filter((x) => x.outro)
  const minhasPastas = notePasta.filter((x) => x.note_id === noteId).map((x) => pastas.find((p) => p.id === x.pasta_id)).filter(Boolean)
  const meusEventos = eventos.filter((e) => e.note_id === noteId)
  const participacoes = eventos.filter((e) => conexoes.some((c) => c.origem_note_id === e.note_id && c.destino_note_id === noteId && c.tipo === 'campo'))
  const naTimeline = new Set([...meusEventos, ...participacoes].map((e) => e.id)).size
  const tlId = (meusEventos[0] ?? participacoes[0])?.timeline_id
  const eu = getBackend().userId()

  return (
    <aside aria-label="Ligado a" className="flex flex-col gap-6 p-4">
      <section>
        <h2 className="text-ui-lg mb-2">Ligado a</h2>
        {ligados.length === 0 && <p className="meta">Nada ainda. Use um campo Relação ou ligue no quadro.</p>}
        <ul className="flex flex-col gap-1">
          {ligados.map(({ c, outro, saida }) => (
            <li key={c.id} className="flex items-baseline gap-2">
              <span aria-hidden className="text-lacre">─</span>
              <span className="min-w-0">
                <Link to={`/note/${outro!.id}`} className="font-texto">{outro!.titulo}</Link>
                <span className="meta text-ui-sm block">{saida ? c.rotulo || 'ligação' : `${c.rotulo || 'ligação'}, vindo de lá`}{c.tipo === 'manual' ? ', no quadro' : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-ui-lg mb-2">Pastas</h2>
        {minhasPastas.length === 0 ? <p className="meta">Fora de qualquer pasta.</p> : (
          <div className="flex flex-wrap gap-1">
            {minhasPastas.map((p) => (
              <Link key={p!.id} className="chip" to={`/gaveteiro/${p!.gaveteiro_id}?pasta=${p!.id}`}
                title={p!.origem === 'regra' ? 'automática' : gavs.find((g) => g.id === p!.gaveteiro_id)?.nome}>{p!.nome}</Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-ui-lg mb-2">Na timeline: {naTimeline}</h2>
        {tlId && <Link className="btn" to={`/timeline/${tlId}?note=${noteId}`}>Ver na timeline {timelines.find((t) => t.id === tlId)?.nome}</Link>}
      </section>

      <section>
        <h2 className="text-ui-lg mb-2 flex items-center gap-2">Resumo {note.resumo_provisorio && <span className="meta" title="Gerado do texto. Edite para fixar."><IconProvisorio width={16} height={16} /></span>}</h2>
        <textarea key={note.resumo} className="campo py-2" rows={4} defaultValue={note.resumo} aria-label="Resumo"
          placeholder="Gerado das primeiras frases do texto"
          onBlur={(e) => { if (e.target.value.trim() !== note.resumo) definirResumo(noteId, e.target.value) }} />
      </section>

      <section className="flex flex-col gap-2">
        <button className="btn" onClick={() => setPredef(true)}>Salvar como predefinição</button>
        <button className="btn" onClick={() => setExcluir(usosDoNote(noteId))}>Excluir note</button>
        {note.updated_at && (
          <p className="meta text-ui-sm">
            Editado em {new Date(note.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
            {note.updated_by ? (note.updated_by === eu ? ', por você' : ', pelo outro membro') : ''}
          </p>
        )}
      </section>

      {predef && <SalvarPredefModal noteId={noteId} onFechar={() => setPredef(false)} />}
      {excluir && (
        <Modal titulo={`Excluir "${note.titulo}"`} onFechar={() => setExcluir(null)}>
          {excluir.length > 0 ? (
            <>
              <p className="mb-2">Este note é usado em:</p>
              <ul className="mb-3 list-disc" style={{ paddingLeft: 24 }}>{excluir.map((u) => <li key={u}>{u}</li>)}</ul>
              <p className="meta mb-4">Excluir remove essas referências. Os outros notes continuam.</p>
            </>
          ) : <p className="mb-4">Ninguém aponta para este note. A exclusão não pode ser desfeita.</p>}
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setExcluir(null)}>Cancelar</button>
            <button className="btn-primario" onClick={() => { excluirNote(noteId); setExcluir(null); toast('Note excluído'); nav('/note') }}>Excluir note</button>
          </div>
        </Modal>
      )}
    </aside>
  )
}
