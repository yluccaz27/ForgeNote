import { useState } from 'react'
import { write } from '../../lib/data'
import { diasNoAno } from '../../lib/calendar'
import { toast } from '../../store/ui'
import { Modal } from '../../components/Modal'
import { IconFechar } from '../../components/Icons'
import type { Calendario, CalendarioConfig } from '../../lib/types'

export function CalendarioModal({ cal, onFechar }: { cal: Calendario; onFechar: () => void }) {
  const [nome, setNome] = useState(cal.nome)
  const [c, setC] = useState<CalendarioConfig>(structuredClone(cal.config_json))
  const [semana, setSemana] = useState(c.semana.join(', '))
  const set = (patch: Partial<CalendarioConfig>) => setC((x) => ({ ...x, ...patch }))

  return (
    <Modal titulo="Calendário do mundo" onFechar={onFechar} largura={640}>
      <form className="flex flex-col gap-6" onSubmit={(e) => {
        e.preventDefault()
        const cfg = { ...c, semana: semana.split(',').map((s) => s.trim()).filter(Boolean), meses: c.meses.filter((m) => m.nome.trim()) }
        if (!cfg.meses.length) return
        write.update('calendarios', { id: cal.id }, { nome: nome.trim() || cal.nome, config_json: cfg })
        toast('Calendário salvo'); onFechar()
      }}>
        <label className="flex flex-col gap-1"><span>Nome</span><input className="campo" value={nome} onChange={(e) => setNome(e.target.value)} /></label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-ui-lg mb-2">Eras</legend>
          <p className="meta text-ui-sm">Cada era começa num ano. Uma era que conta para trás termina onde a próxima começa, como a.C.</p>
          {c.eras.map((er, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr auto auto' }}>
              <input className="campo" aria-label="Nome da era" value={er.nome} onChange={(e) => set({ eras: c.eras.map((x, j) => j === i ? { ...x, nome: e.target.value } : x) })} />
              <input className="campo" aria-label="Sigla" value={er.sigla} onChange={(e) => set({ eras: c.eras.map((x, j) => j === i ? { ...x, sigla: e.target.value } : x) })} />
              <input className="campo" aria-label="Ano inicial (absoluto)" inputMode="numeric" value={er.ano_inicial}
                onChange={(e) => set({ eras: c.eras.map((x, j) => j === i ? { ...x, ano_inicial: parseInt(e.target.value) || 0 } : x) })} />
              <label className="flex items-center gap-1 text-ui-sm"><input type="checkbox" checked={er.para_tras} onChange={(e) => set({ eras: c.eras.map((x, j) => j === i ? { ...x, para_tras: e.target.checked } : x) })} /> para trás</label>
              <button type="button" className="btn-icone" aria-label={`Remover era ${er.nome}`} onClick={() => set({ eras: c.eras.filter((_, j) => j !== i) })}><IconFechar width={14} height={14} /></button>
            </div>
          ))}
          <button type="button" className="btn self-start" onClick={() => set({ eras: [...c.eras, { nome: 'Nova era', sigla: 'N.E.', ano_inicial: (c.eras.at(-1)?.ano_inicial ?? 0) + 100, para_tras: false }] })}>Adicionar era</button>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-ui-lg mb-2">Meses</legend>
          <p className="meta text-ui-sm">{c.meses.length} meses, {diasNoAno(c)} dias por ano. Mudar os meses muda como as datas existentes aparecem.</p>
          {c.meses.map((m, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr auto auto auto' }}>
              <input className="campo" aria-label="Nome do mês" value={m.nome} onChange={(e) => set({ meses: c.meses.map((x, j) => j === i ? { ...x, nome: e.target.value } : x) })} />
              <input className="campo" aria-label="Dias" inputMode="numeric" value={m.dias}
                onChange={(e) => set({ meses: c.meses.map((x, j) => j === i ? { ...x, dias: Math.max(1, parseInt(e.target.value) || 1) } : x) })} />
              <button type="button" className="btn-icone" aria-label="Subir mês" disabled={i === 0} onClick={() => { const ms = [...c.meses];[ms[i - 1], ms[i]] = [ms[i], ms[i - 1]]; set({ meses: ms }) }}>↑</button>
              <button type="button" className="btn-icone" aria-label="Descer mês" disabled={i === c.meses.length - 1} onClick={() => { const ms = [...c.meses];[ms[i + 1], ms[i]] = [ms[i], ms[i + 1]]; set({ meses: ms }) }}>↓</button>
              <button type="button" className="btn-icone" aria-label={`Remover ${m.nome}`} disabled={c.meses.length <= 1} onClick={() => set({ meses: c.meses.filter((_, j) => j !== i) })}><IconFechar width={14} height={14} /></button>
            </div>
          ))}
          <button type="button" className="btn self-start" onClick={() => set({ meses: [...c.meses, { nome: `Mês ${c.meses.length + 1}`, dias: 30 }] })}>Adicionar mês</button>
        </fieldset>

        <label className="flex flex-col gap-1"><span>Dias da semana <span className="meta">(opcional, separados por vírgula)</span></span>
          <input className="campo" value={semana} onChange={(e) => setSemana(e.target.value)} />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn-primario">Salvar calendário</button>
        </div>
      </form>
    </Modal>
  )
}
