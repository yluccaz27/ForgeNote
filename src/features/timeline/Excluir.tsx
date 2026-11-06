import { useState } from 'react'
import { useWsTable } from '../../lib/data'
import { excluirCalendario, excluirTimeline } from '../../lib/excluir'
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao'
import type { Calendario, Timeline } from '../../lib/types'

/**
 * Calendário em uso não sai sem destino: as timelines dele passam para outro.
 * Nenhuma timeline fica sem calendário.
 */
export function ExcluirCalendarioDialogo({ cal, onFechar }: { cal: Calendario; onFechar: () => void }) {
  const tls = useWsTable('timelines')
  const cals = useWsTable('calendarios')
  const usam = tls.filter((t) => t.calendario_id === cal.id)
  const outros = cals.filter((c) => c.id !== cal.id)
  const [destino, setDestino] = useState(outros[0]?.id ?? '')
  const emUso = usam.length > 0
  return (
    <ConfirmarExclusao oque="o calendário" nome={cal.nome} acao="Excluir calendário" onFechar={onFechar}
      digitarNome={emUso && outros.length > 0} bloqueado={emUso && !destino}
      onExcluir={() => excluirCalendario(cal.id, emUso ? destino : null)}>
      {!emUso && <p>Nenhuma timeline usa este calendário.</p>}
      {emUso && (
        <>
          <p>{usam.length === 1 ? 'Esta timeline usa este calendário:' : `Estas ${usam.length} timelines usam este calendário:`}</p>
          <ul className="list-disc valor" style={{ paddingLeft: 24 }}>{usam.map((t) => <li key={t.id}>{t.nome}</li>)}</ul>
          {outros.length > 0 ? (
            <>
              <label className="flex flex-col gap-1">
                <span>Trocar {usam.length === 1 ? 'essa timeline' : 'essas timelines'} para o calendário</span>
                <select className="campo valor" value={destino} onChange={(e) => setDestino(e.target.value)}>
                  {outros.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
              <p className="meta">As datas continuam guardadas como posição na linha do tempo. Em outro calendário, elas serão mostradas com os nomes de meses e eras dele.</p>
            </>
          ) : (
            <p>Uma timeline não pode ficar sem calendário, e este é o único. Crie outro calendário antes de excluir este, ou cancele.</p>
          )}
        </>
      )}
    </ConfirmarExclusao>
  )
}

export function ExcluirTimelineDialogo({ tl, onFechar, onExcluido }: { tl: Timeline; onFechar: () => void; onExcluido?: () => void }) {
  return (
    <ConfirmarExclusao oque="a timeline" nome={tl.nome} acao="Excluir timeline" onFechar={onFechar}
      onExcluir={() => { excluirTimeline(tl.id); onExcluido?.() }}>
      <p>As trilhas e as marcações dos eventos nesta timeline saem junto.</p>
      <p className="meta">Os notes dos eventos continuam existindo, e o calendário também.</p>
    </ConfirmarExclusao>
  )
}
