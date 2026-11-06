import type { Note } from '../lib/types'
import { corMarcacao } from '../lib/color'
import { useImagem } from '../lib/images'

/** O papelzinho: título, faixa de marcação da predefinição e miniatura. */
export function Papel({ note, miniatura, resumo = false, extra, className = '' }: {
  note: Note; miniatura?: string | null; resumo?: boolean; extra?: React.ReactNode; className?: string
}) {
  const img = useImagem(miniatura)
  return (
    <div className={`papel ${note.titulo_provisorio ? 'papel-provisorio' : ''} px-3 py-2 flex gap-2 ${className}`}
      style={{ ['--marca' as string]: corMarcacao(note.predefinicao_id) }}>
      {img && <img src={img} alt="" className="rounded-papel shrink-0" style={{ width: 40, height: 40, objectFit: 'cover' }} />}
      <div className="min-w-0 flex-1">
        <p className="titulo-papel font-texto text-titulo-papel">{note.titulo}</p>
        {resumo && note.resumo && <p className="text-ui-sm mt-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{note.resumo}</p>}
        {extra}
      </div>
    </div>
  )
}
