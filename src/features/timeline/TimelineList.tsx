import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { uid, useWsTable, write } from '../../lib/data'
import { CALENDARIO_PADRAO } from '../../lib/calendar'
import { toast, useUI } from '../../store/ui'
import { Modal } from '../../components/Modal'
import { IconMais } from '../../components/Icons'
import { CalendarioModal } from './CalendarioModal'
import { MenuMais } from '../../components/Menu'
import { ExcluirCalendarioDialogo, ExcluirTimelineDialogo } from './Excluir'
import type { Calendario, Timeline } from '../../lib/types'

export function TimelineList() {
  const tls = useWsTable('timelines')
  const cals = useWsTable('calendarios')
  const ws = useUI((s) => s.wsId)!
  const nav = useNavigate()
  const [nova, setNova] = useState(false)
  const [nome, setNome] = useState('')
  const [calId, setCalId] = useState<string>('')
  const [editCal, setEditCal] = useState<Calendario | null>(null)
  const [exCal, setExCal] = useState<Calendario | null>(null)
  const [exTl, setExTl] = useState<Timeline | null>(null)

  /** cria um calendário-base e abre o editor para o usuário dar nomes às eras e meses */
  function criarCalendario() {
    const cal: Calendario = { id: uid(), workspace_id: ws, nome: cals.length ? 'Novo calendário' : 'Calendário do mundo', config_json: structuredClone(CALENDARIO_PADRAO) }
    write.insert('calendarios', [cal])
    setEditCal(cal)
  }

  function criar(e: React.FormEvent) {
    e.preventDefault()
    let cid = calId || cals[0]?.id
    if (!cid) {
      cid = uid()
      write.insert('calendarios', [{ id: cid, workspace_id: ws, nome: 'Calendário do mundo', config_json: CALENDARIO_PADRAO }])
    }
    const id = uid()
    write.insert('timelines', [{ id, workspace_id: ws, nome: nome.trim() || 'Nova timeline', calendario_id: cid }])
    write.insert('trilhas', [{ id: uid(), timeline_id: id, nome: 'Mundo', cor: null, ordem: 0, note_id: null, recolhida: false }])
    toast('Timeline criada'); nav(`/timeline/${id}`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-ui-lg font-semibold">Timelines</h1>
        <div className="flex-1" />
        <button className="btn" onClick={() => setNova(true)} disabled={cals.length === 0}
          title={cals.length === 0 ? 'Crie o calendário do mundo primeiro' : undefined}><IconMais width={16} height={16} /> Nova timeline</button>
      </div>
      {cals.length === 0 && (
        <div className="elev borda rounded-painel p-6 mb-8 flex flex-col items-start gap-3" style={{ maxWidth: 640 }}>
          <h2 className="text-ui-lg font-semibold">Crie o calendário do mundo</h2>
          <p>A timeline conta o tempo no calendário que você inventar: eras, meses com quantos dias quiser e dias da semana. Comece por ele.</p>
          <button className="btn-primario" onClick={criarCalendario}>Criar calendário</button>
        </div>
      )}
      <ul className="flex flex-col gap-2 mb-8" style={{ maxWidth: 640 }}>
        {tls.map((t) => (
          <li key={t.id} className="flex items-center gap-1">
            <Link to={`/timeline/${t.id}`} className="btn flex-1 justify-start valor">{t.nome}</Link>
            <MenuMais rotulo={`Opções da timeline ${t.nome}`} itens={[{ rotulo: 'Abrir timeline', onClick: () => nav(`/timeline/${t.id}`) }]} excluir={() => setExTl(t)} />
          </li>
        ))}
      </ul>
      {tls.length === 0 && cals.length > 0 && <p className="mb-8">Uma timeline organiza os eventos do mundo em trilhas, no calendário que você inventar.</p>}

      {cals.length > 0 && <h2 className="text-ui-lg mb-2">Calendários</h2>}
      <ul className="flex flex-col gap-2" style={{ maxWidth: 640 }}>
        {cals.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <span className="flex-1"><span className="valor">{c.nome}</span> <span className="meta text-ui-sm">{c.config_json.meses.length} meses, {c.config_json.eras.map((e) => e.sigla).join(', ')}</span></span>
            <button className="btn" onClick={() => setEditCal(c)}>Editar calendário</button>
            <MenuMais rotulo={`Opções do calendário ${c.nome}`} excluir={() => setExCal(c)} />
          </li>
        ))}
        {cals.length > 0 && <li><button className="btn" onClick={criarCalendario}><IconMais width={16} height={16} /> Novo calendário</button></li>}
      </ul>
      {exCal && <ExcluirCalendarioDialogo cal={exCal} onFechar={() => setExCal(null)} />}
      {exTl && <ExcluirTimelineDialogo tl={exTl} onFechar={() => setExTl(null)} />}

      {nova && (
        <Modal titulo="Nova timeline" onFechar={() => setNova(false)}>
          <form className="flex flex-col gap-4" onSubmit={criar}>
            <label className="flex flex-col gap-1"><span>Nome</span><input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
            {cals.length > 0 && (
              <label className="flex flex-col gap-1"><span>Calendário</span>
                <select className="campo" value={calId} onChange={(e) => setCalId(e.target.value)}>
                  {cals.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setNova(false)}>Cancelar</button>
              <button className="btn-primario">Criar timeline</button>
            </div>
          </form>
        </Modal>
      )}
      {editCal && <CalendarioModal cal={editCal} onFechar={() => setEditCal(null)} />}
    </div>
  )
}
