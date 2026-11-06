import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NoteEditor } from './NoteEditor'
import { LigadoPainel } from './LigadoPainel'
import { IconPainel } from '../../components/Icons'

export function NotePage() {
  const { id } = useParams()
  const nav = useNavigate()
  const [painel, setPainel] = useState(() => { try { return localStorage.getItem('forgenote:painel') !== '0' } catch { return true } })
  const alternar = () => { setPainel((p) => { try { localStorage.setItem('forgenote:painel', p ? '0' : '1') } catch { /* ok */ } return !p }) }
  if (!id) return null
  return (
    <div className="flex flex-col md:flex-row min-h-full">
      <div className="flex-1 min-w-0 relative">
        <button className="btn-icone meta absolute" style={{ top: 8, right: 8 }} onClick={alternar}
          aria-label={painel ? 'Recolher painel Ligado a' : 'Mostrar painel Ligado a'} aria-expanded={painel}><IconPainel /></button>
        <NoteEditor key={id} noteId={id} onExcluido={() => nav('/note')} />
      </div>
      {painel && (
        <div className="elev md:w-painel shrink-0 md:borda-l painel-desliza">
          <LigadoPainel noteId={id} />
        </div>
      )}
    </div>
  )
}
