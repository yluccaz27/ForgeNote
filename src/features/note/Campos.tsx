import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTable, useWsTable, write } from '../../lib/data'
import { asArray, definirValor, removerCampo, renomearCampo } from '../../lib/domain'
import { anoAbsoluto, diaDePartes, eraIndexDoAno, erasOrdenadas, formatarDia, anoNaEra, partesDeDia } from '../../lib/calendar'
import { useCalendario, usePopover } from '../../lib/hooks'
import { comprimir, useImagem } from '../../lib/images'
import { getBackend } from '../../lib/data'
import { normalizar } from '../../lib/text'
import { corMarcacao } from '../../lib/color'
import { toastErro, useUI } from '../../store/ui'
import type { CampoConfig, DiaJson, NoteCampo, TipoCampo } from '../../lib/types'
import { IconFechar, IconLixo, IconSeta } from '../../components/Icons'

export const NOMES_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto', numero: 'Número', data: 'Data', selecao: 'Seleção', relacao: 'Relação', imagem: 'Imagem',
}

export function ValorCampo({ campo, noteId }: { campo: NoteCampo; noteId: string }) {
  const valores = useTable('note_valores')
  const valor = valores.find((v) => v.campo_id === campo.id)?.valor_json
  switch (campo.tipo) {
    case 'texto': return <TextoCampo campo={campo} valor={valor as string} />
    case 'numero': return <NumeroCampo campo={campo} valor={valor as number} />
    case 'data': return <DataCampo campo={campo} valor={valor as DiaJson | null} />
    case 'selecao': return <SelecaoCampo campo={campo} valor={valor} />
    case 'relacao': return <RelacaoCampo campo={campo} valor={asArray(valor)} noteId={noteId} />
    case 'imagem': return <ImagemCampo campo={campo} valor={valor as string | null} />
  }
}

// campos de texto salvam ao sair (blur/Enter); key = valor externo, então
// uma edição do outro usuário recarrega o campo
function TextoCampo({ campo, valor }: { campo: NoteCampo; valor?: string }) {
  return (
    <input key={valor ?? ''} className="campo" defaultValue={valor ?? ''} aria-label={campo.nome}
      onBlur={(e) => { if (e.target.value !== (valor ?? '')) definirValor(campo.id, e.target.value) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

function NumeroCampo({ campo, valor }: { campo: NoteCampo; valor?: number }) {
  return (
    <input key={String(valor)} className="campo" inputMode="decimal" defaultValue={valor == null ? '' : String(valor)} aria-label={campo.nome}
      onBlur={(e) => {
        const t = e.target.value.trim()
        const n = t === '' ? null : Number(t.replace(',', '.'))
        if (n !== null && Number.isNaN(n)) { e.target.value = valor == null ? '' : String(valor); return }
        if (n !== (valor ?? null)) definirValor(campo.id, n)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

// ───────── Data (calendário do mundo) ─────────
export function DataInput({ valor, onChange, rotulo }: { valor: number | null; onChange: (dia: number | null) => void; rotulo: string }) {
  const cal = useCalendario()
  const p = valor != null ? partesDeDia(cal, valor) : null
  const eras = erasOrdenadas(cal)
  const eraIdx = p ? eraIndexDoAno(cal, p.ano) : Math.max(0, eras.findIndex((e) => !e.para_tras))
  const anoExib = p ? anoNaEra(cal, p.ano).ano : ''
  const set = (mes: number, dia: number, ano: number, era: number) => {
    const abs = anoAbsoluto(cal, era, ano)
    const max = cal.meses[mes]?.dias ?? 30
    onChange(diaDePartes(cal, { ano: abs, mes, dia: Math.min(dia, max) }))
  }
  const base = p ?? { mes: 0, dia: 1 }
  const anoNum = typeof anoExib === 'number' ? anoExib : 1
  return (
    <div className="flex flex-wrap gap-1 items-center" role="group" aria-label={rotulo}>
      <select className="campo" style={{ width: 'auto' }} aria-label="Dia" value={p ? p.dia : ''}
        onChange={(e) => set(base.mes, Number(e.target.value), anoNum, eraIdx)}>
        {!p && <option value="">dia</option>}
        {Array.from({ length: cal.meses[base.mes]?.dias ?? 30 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
      </select>
      <select className="campo" style={{ width: 'auto' }} aria-label="Mês" value={p ? p.mes : ''}
        onChange={(e) => set(Number(e.target.value), base.dia, anoNum, eraIdx)}>
        {!p && <option value="">mês</option>}
        {cal.meses.map((m, i) => <option key={i} value={i}>{m.nome}</option>)}
      </select>
      <input className="campo" style={{ width: 72 }} aria-label="Ano" inputMode="numeric" defaultValue={anoExib} key={String(valor)}
        onBlur={(e) => { const a = parseInt(e.target.value); if (!Number.isNaN(a)) set(base.mes, base.dia, a, eraIdx) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      {eras.length > 0 && (
        <select className="campo" style={{ width: 'auto' }} aria-label="Era" value={eraIdx}
          onChange={(e) => set(base.mes, base.dia, anoNum, Number(e.target.value))}>
          {eras.map((er, i) => <option key={i} value={i}>{er.sigla}</option>)}
        </select>
      )}
      {valor != null && <button className="btn-icone" aria-label="Limpar data" onClick={() => onChange(null)}><IconFechar width={14} height={14} /></button>}
    </div>
  )
}

function DataCampo({ campo, valor }: { campo: NoteCampo; valor: DiaJson | null }) {
  const cal = useCalendario()
  return (
    <div>
      <DataInput rotulo={campo.nome} valor={valor?.dia ?? null} onChange={(d) => definirValor(campo.id, d == null ? null : { dia: d })} />
      {valor && <p className="meta text-ui-sm mt-1">{formatarDia(cal, valor.dia)}{campo.config_json.marco ? ', marco na timeline' : ''}</p>}
    </div>
  )
}

// ───────── Seleção ─────────
function SelecaoCampo({ campo, valor }: { campo: NoteCampo; valor: unknown }) {
  const opcoes = campo.config_json.opcoes ?? []
  const multiplo = !!campo.config_json.multiplo
  const sel = asArray(valor)
  const pop = usePopover()
  const alternar = (o: string) => {
    if (multiplo) definirValor(campo.id, sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])
    else { definirValor(campo.id, sel[0] === o ? null : o); pop.setAberto(false) }
  }
  return (
    <div className="relative" ref={pop.ref}>
      <button className="campo flex items-center gap-1 flex-wrap text-left" aria-haspopup="listbox" aria-expanded={pop.aberto}
        aria-label={`${campo.nome}: ${sel.join(', ') || 'vazio'}`} onClick={() => pop.setAberto(!pop.aberto)}>
        {sel.length === 0 && <span className="meta">Escolher</span>}
        {multiplo ? sel.map((s) => <span key={s} className="chip">{s}</span>) : <span>{sel[0]}</span>}
        <span className="flex-1" /><IconSeta width={14} height={14} className="meta" />
      </button>
      {pop.aberto && (
        <div className="elev borda rounded-painel absolute z-20 mt-1 w-full p-1" role="listbox" aria-multiselectable={multiplo}>
          {opcoes.length === 0 && <p className="meta p-2">Sem opções. Adicione nas configurações do campo.</p>}
          {opcoes.map((o) => (
            <button key={o} role="option" aria-selected={sel.includes(o)}
              className={`w-full text-left px-2 min-h-alvo rounded-campo ${sel.includes(o) ? 'item-ativo bg-ardosia' : ''}`}
              onClick={() => alternar(o)}>{o}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────── Relação (estilo Notion) ─────────
function RelacaoCampo({ campo, valor, noteId }: { campo: NoteCampo; valor: string[]; noteId: string }) {
  const notes = useWsTable('notes')
  const notePasta = useTable('note_pasta')
  const abrirCriar = useUI((s) => s.abrirCriar)
  const pop = usePopover()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const cfg = campo.config_json
  const multiplo = cfg.multiplo !== false

  const candidatos = useMemo(() => {
    const pastasOk = cfg.pastas?.length ? new Set(notePasta.filter((x) => cfg.pastas!.includes(x.pasta_id)).map((x) => x.note_id)) : null
    const termo = normalizar(q)
    return notes
      .filter((n) => n.id !== noteId)
      .filter((n) => !cfg.predefinicoes?.length || (n.predefinicao_id && cfg.predefinicoes.includes(n.predefinicao_id)))
      .filter((n) => !pastasOk || pastasOk.has(n.id))
      .filter((n) => !termo || normalizar(n.titulo).includes(termo))
      .sort((a, b) => a.titulo.localeCompare(b.titulo))
      .slice(0, 50)
  }, [notes, notePasta, q, cfg, noteId])
  const existeExato = candidatos.some((n) => normalizar(n.titulo) === normalizar(q.trim()))
  const podeCriar = q.trim() && !existeExato
  const total = candidatos.length + (podeCriar ? 1 : 0)

  const escolher = (id: string) => {
    if (valor.includes(id)) definirValor(campo.id, valor.filter((x) => x !== id))
    else definirValor(campo.id, multiplo ? [...valor, id] : [id])
    setQ('')
    if (!multiplo) pop.setAberto(false)
  }
  const criarNovo = () => {
    const titulo = q.trim()
    pop.setAberto(false); setQ('')
    // cria na hora, sem sair da ficha
    abrirCriar({ titulo, sugeridas: cfg.predefinicoes, ficar: true,
      onCriado: (id) => definirValor(campo.id, multiplo ? [...valor, id] : [id]) })
  }

  return (
    <div className="relative" ref={pop.ref}>
      <div className="campo flex items-center gap-1 flex-wrap py-1" style={{ height: 'auto' }}>
        {valor.map((id) => {
          const n = notes.find((x) => x.id === id)
          return (
            <span key={id} className="chip" style={{ borderLeft: `3px solid ${corMarcacao(n?.predefinicao_id)}` }}>
              <Link to={`/note/${id}`} className="font-texto">{n?.titulo ?? 'Note removido'}</Link>
              <button aria-label={`Remover ${n?.titulo ?? ''}`} onClick={() => escolher(id)} className="meta"><IconFechar width={12} height={12} /></button>
            </span>
          )
        })}
        <button className="btn-fantasma meta text-ui-sm" style={{ minHeight: 24 }} aria-haspopup="listbox" aria-expanded={pop.aberto}
          onClick={() => { pop.setAberto(!pop.aberto); setI(0) }}>{valor.length ? 'Adicionar' : 'Escolher'}</button>
      </div>
      {pop.aberto && (
        <div className="elev borda rounded-painel absolute z-20 mt-1 w-full p-1" style={{ minWidth: 240 }}>
          <input className="campo mb-1" autoFocus placeholder="Buscar ou criar" value={q} aria-label={`Buscar em ${campo.nome}`}
            onChange={(e) => { setQ(e.target.value); setI(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(total - 1, x + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
              if (e.key === 'Enter') { e.preventDefault(); if (i < candidatos.length) escolher(candidatos[i].id); else if (podeCriar) criarNovo() }
            }} />
          <div role="listbox" aria-multiselectable={multiplo} className="overflow-auto" style={{ maxHeight: 240 }}>
            {candidatos.map((n, idx) => (
              <button key={n.id} role="option" aria-selected={valor.includes(n.id)} onMouseEnter={() => setI(idx)}
                className={`w-full text-left px-2 min-h-alvo rounded-campo flex items-center gap-2 ${idx === i ? 'bg-ardosia' : ''} ${valor.includes(n.id) ? 'item-ativo' : ''}`}
                onClick={() => escolher(n.id)}>
                <span aria-hidden style={{ width: 3, height: 16, background: corMarcacao(n.predefinicao_id) }} />
                <span className="font-texto">{n.titulo}</span>
              </button>
            ))}
            {candidatos.length === 0 && !podeCriar && <p className="meta p-2">Nenhum note combina com o filtro deste campo.</p>}
            {podeCriar && (
              <button className={`w-full text-left px-2 min-h-alvo rounded-campo ${i === candidatos.length ? 'bg-ardosia' : ''}`}
                onMouseEnter={() => setI(candidatos.length)} onClick={criarNovo}>+ Criar "{q.trim()}"</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ───────── Imagem ─────────
function ImagemCampo({ campo, valor }: { campo: NoteCampo; valor: string | null }) {
  const url = useImagem(valor)
  const ws = useUI((s) => s.wsId)
  const [enviando, setEnviando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  async function enviar(f: File) {
    if (!ws) return
    setEnviando(true)
    try {
      const blob = await comprimir(f)
      const path = await getBackend().uploadImage(ws, blob)
      definirValor(campo.id, path)
    } catch (e) { toastErro(`Não foi possível enviar a imagem: ${(e as Error).message}`) }
    setEnviando(false)
  }
  return (
    <div className="flex items-center gap-2">
      {url && <img src={url} alt={campo.nome} className="rounded-papel" style={{ width: 64, height: 64, objectFit: 'cover' }} />}
      <input ref={input} type="file" accept="image/*" className="sr-only" aria-label={`Enviar ${campo.nome}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); e.target.value = '' }} />
      <button className="btn" disabled={enviando} onClick={() => input.current?.click()}>{enviando ? 'Enviando…' : url ? 'Trocar imagem' : 'Enviar imagem'}</button>
      {valor && <button className="btn-fantasma meta" onClick={() => definirValor(campo.id, null)}>Remover</button>}
    </div>
  )
}

// ───────── Configuração do campo ─────────
export function ConfigCampo({ campo, onFechar }: { campo: NoteCampo; onFechar: () => void }) {
  const predefs = useWsTable('predefinicoes')
  const gavs = useWsTable('gaveteiros')
  const pastas = useTable('pastas')
  const [nome, setNome] = useState(campo.nome)
  const [novaOpcao, setNovaOpcao] = useState('')
  const cfg = campo.config_json
  const setCfg = (patch: Partial<CampoConfig>) => write.update('note_campos', { id: campo.id }, { config_json: { ...cfg, ...patch } })
  const toggle = (lista: string[] | undefined, id: string) => (lista ?? []).includes(id) ? (lista ?? []).filter((x) => x !== id) : [...(lista ?? []), id]
  const pastasWs = pastas.filter((p) => gavs.some((g) => g.id === p.gaveteiro_id))

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span>Nome do campo</span>
        <input className="campo" value={nome} onChange={(e) => setNome(e.target.value)}
          onBlur={() => nome.trim() && nome !== campo.nome && renomearCampo(campo.id, nome.trim())} />
      </label>
      <p className="meta">Tipo: {NOMES_TIPO[campo.tipo]}</p>

      {campo.tipo === 'selecao' && (
        <>
          <label className="flex items-center gap-2"><input type="checkbox" checked={!!cfg.multiplo} onChange={(e) => setCfg({ multiplo: e.target.checked })} /> Permitir várias opções</label>
          <div>
            <p className="mb-1">Opções</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {(cfg.opcoes ?? []).map((o) => (
                <span key={o} className="chip">{o}<button aria-label={`Remover opção ${o}`} onClick={() => setCfg({ opcoes: (cfg.opcoes ?? []).filter((x) => x !== o) })}><IconFechar width={12} height={12} /></button></span>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const o = novaOpcao.trim(); if (o && !(cfg.opcoes ?? []).includes(o)) setCfg({ opcoes: [...(cfg.opcoes ?? []), o] }); setNovaOpcao('') }}>
              <input className="campo" placeholder="Nova opção" value={novaOpcao} onChange={(e) => setNovaOpcao(e.target.value)} />
              <button className="btn">Adicionar</button>
            </form>
          </div>
        </>
      )}

      {campo.tipo === 'relacao' && (
        <>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.multiplo !== false} onChange={(e) => setCfg({ multiplo: e.target.checked })} /> Permitir vários notes</label>
          <fieldset>
            <legend className="mb-1">Mostrar só notes da predefinição</legend>
            {predefs.length === 0 && <p className="meta">Nenhuma predefinição salva.</p>}
            <div className="flex flex-wrap gap-2">
              {predefs.map((p) => (
                <label key={p.id} className="flex items-center gap-1"><input type="checkbox" checked={(cfg.predefinicoes ?? []).includes(p.id)} onChange={() => setCfg({ predefinicoes: toggle(cfg.predefinicoes, p.id) })} /> {p.nome}</label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1">E só das pastas</legend>
            <div className="flex flex-wrap gap-2">
              {pastasWs.map((p) => (
                <label key={p.id} className="flex items-center gap-1"><input type="checkbox" checked={(cfg.pastas ?? []).includes(p.id)} onChange={() => setCfg({ pastas: toggle(cfg.pastas, p.id) })} /> {p.nome}</label>
              ))}
            </div>
            <p className="meta text-ui-sm mt-1">Nada marcado = qualquer note do workspace.</p>
          </fieldset>
        </>
      )}

      {campo.tipo === 'data' && (
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!cfg.marco} onChange={(e) => setCfg({ marco: e.target.checked })} /> Marco de timeline (aparece na trilha deste note)</label>
      )}

      <div className="borda-t pt-3 flex justify-between">
        <button className="btn" onClick={() => { removerCampo(campo.id); onFechar() }}><IconLixo width={16} height={16} /> Excluir campo</button>
        <button className="btn-primario" onClick={onFechar}>Pronto</button>
      </div>
    </div>
  )
}
