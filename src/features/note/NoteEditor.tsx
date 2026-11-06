import { useEffect, useState } from 'react'
import { useTable, write } from '../../lib/data'
import { alternarOrganizaPasta, definirTitulo, novaAba, novoCampo, reordenarAbas, removerAba } from '../../lib/domain'
import { useNote, usePopover } from '../../lib/hooks'
import { corMarcacao } from '../../lib/color'
import { Notepad } from '../../components/Notepad'
import { Modal } from '../../components/Modal'
import { IconEngrenagem, IconLixo, IconMais, IconPasta, IconProvisorio } from '../../components/Icons'
import { ConfigCampo, NOMES_TIPO, ValorCampo } from './Campos'
import type { NoteCampo, TipoCampo } from '../../lib/types'

/** Ficha (abas + campos) em cima, notepad embaixo. */
export function NoteEditor({ noteId, compacto = false }: { noteId: string; compacto?: boolean }) {
  const note = useNote(noteId)
  const predefs = useTable('predefinicoes')
  const todasAbas = useTable('note_abas')
  const todosCampos = useTable('note_campos')
  const abas = todasAbas.filter((a) => a.note_id === noteId).sort((a, b) => a.ordem - b.ordem)
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [config, setConfig] = useState<NoteCampo | null>(null)
  const aba = abas.find((a) => a.id === abaAtiva) ?? abas[0]
  const campos = aba ? todosCampos.filter((c) => c.aba_id === aba.id).sort((a, b) => a.ordem - b.ordem) : []

  useEffect(() => { setAbaAtiva(null) }, [noteId])
  if (!note) return <p className="meta p-6">Este note não existe mais.</p>
  const predef = predefs.find((p) => p.id === note.predefinicao_id)

  function soltarAba(alvo: string) {
    if (!arrastando || arrastando === alvo) return
    const ids = abas.map((a) => a.id).filter((id) => id !== arrastando)
    ids.splice(ids.indexOf(alvo), 0, arrastando)
    reordenarAbas(noteId, ids)
    setArrastando(null)
  }

  return (
    <div className="flex flex-col">
      <section aria-label="Ficha" className={compacto ? 'px-4 pt-4' : 'px-6 pt-6'}>
        <div className="flex items-start gap-2 mb-3" style={{ paddingRight: compacto ? 0 : 32 }}>
          <span aria-hidden style={{ width: 3, alignSelf: 'stretch', background: corMarcacao(note.predefinicao_id) }} />
          <TituloEditavel key={note.titulo} titulo={note.titulo} provisorio={note.titulo_provisorio} onSalvar={(t) => definirTitulo(noteId, t)} />
        </div>
        {predef && <p className="meta text-ui-sm mb-3">{predef.icone} {predef.nome}</p>}

        <div role="tablist" aria-label="Abas da ficha" className="flex flex-wrap items-center gap-1 mb-3">
          {abas.map((a) => renomeando === a.id ? (
            <input key={a.id} autoFocus className="campo" style={{ width: 160 }} defaultValue={a.nome} aria-label="Nome da aba"
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.nome) write.update('note_abas', { id: a.id }, { nome: v }); setRenomeando(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenomeando(null) }} />
          ) : (
            <button key={a.id} role="tab" aria-selected={aba?.id === a.id} className="aba"
              draggable onDragStart={() => setArrastando(a.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => soltarAba(a.id)}
              onClick={() => setAbaAtiva(a.id)} onDoubleClick={() => setRenomeando(a.id)}
              onKeyDown={(e) => {
                if (e.key === 'F2') setRenomeando(a.id)
                if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                  const ids = abas.map((x) => x.id); const i = ids.indexOf(a.id); const j = i + (e.key === 'ArrowLeft' ? -1 : 1)
                  if (j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; reordenarAbas(noteId, ids) }
                }
              }}
              title="Duplo clique ou F2 renomeia. Arraste ou Alt+setas para reordenar.">{a.nome}</button>
          ))}
          <button className="btn-icone" aria-label="Adicionar aba" title="Adicionar aba"
            onClick={() => { const id = novaAba(noteId); setAbaAtiva(id); setRenomeando(id) }}><IconMais width={18} height={18} /></button>
        </div>

        {aba && (
          <div className="mb-4">
            {campos.length === 0 && <p className="meta mb-3">Aba vazia. Adicione o primeiro campo.</p>}
            <div className="grid gap-x-6 gap-y-3 mb-3" style={{ gridTemplateColumns: compacto ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }}>
              {campos.map((c) => (
                <div key={c.id} className="grid items-start gap-2" style={{ gridTemplateColumns: 'minmax(64px, 112px) minmax(0, 1fr) auto' }}>
                  <button className="text-left meta min-h-alvo truncate" title={`${c.nome}: configurar campo`} onClick={() => setConfig(c)}>{c.nome}</button>
                  <ValorCampo campo={c} noteId={noteId} />
                  <div className="flex">
                    {(c.tipo === 'relacao' || c.tipo === 'selecao') && (
                      <button className="btn-icone" aria-pressed={c.organiza_pasta}
                        aria-label={c.organiza_pasta ? `Parar de organizar pastas por ${c.nome}` : `Organizar pastas por ${c.nome}`}
                        title={c.organiza_pasta ? 'Organiza em pastas automáticas. Clique para desligar.' : 'Clique para organizar em pastas automáticas por este campo'}
                        style={{ opacity: c.organiza_pasta ? 1 : 0.45 }}
                        onClick={() => alternarOrganizaPasta(c.id)}><IconPasta width={16} height={16} /></button>
                    )}
                    <button className="btn-icone meta" aria-label={`Configurar ${c.nome}`} onClick={() => setConfig(c)}><IconEngrenagem width={16} height={16} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <NovoCampo abaId={aba.id} />
              <button className="btn-fantasma meta" onClick={() => {
                if (campos.length && !confirm(`Excluir a aba "${aba.nome}" e os ${campos.length} campos dela?`)) return
                removerAba(aba.id); setAbaAtiva(null)
              }}><IconLixo width={16} height={16} /> Excluir aba</button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Notepad" className={`borda-t ${compacto ? 'px-4 py-4' : 'px-6 py-8'}`}>
        <div className="flex justify-center">
          <div className="w-full max-w-medida"><Notepad noteId={noteId} compacto={compacto} /></div>
        </div>
      </section>

      {config && (
        <Modal titulo={`Campo ${config.nome}`} onFechar={() => setConfig(null)}>
          <ConfigCampo campo={todosCampos.find((c) => c.id === config.id) ?? config} onFechar={() => setConfig(null)} />
        </Modal>
      )}
    </div>
  )
}

function TituloEditavel({ titulo, provisorio, onSalvar }: { titulo: string; provisorio: boolean; onSalvar: (t: string) => void }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <input className={`flex-1 bg-transparent font-texto text-titulo-note text-osso min-w-0 ${provisorio ? 'italic' : ''}`}
        style={{ border: 0, color: provisorio ? 'var(--liquen)' : undefined }}
        defaultValue={titulo} aria-label="Título do note"
        onFocus={(e) => { if (provisorio) e.target.select() }}
        onBlur={(e) => { const v = e.target.value.trim(); if (v !== titulo) onSalvar(v) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      {provisorio && <span title="Título gerado automaticamente. Digite um para fixar." className="meta"><IconProvisorio /><span className="sr-only">Título provisório</span></span>}
    </div>
  )
}

const TIPOS: TipoCampo[] = ['texto', 'numero', 'data', 'selecao', 'relacao', 'imagem']
function NovoCampo({ abaId }: { abaId: string }) {
  const pop = usePopover()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoCampo>('texto')
  return (
    <div className="relative" ref={pop.ref}>
      <button className="btn" onClick={() => pop.setAberto(!pop.aberto)} aria-expanded={pop.aberto}><IconMais width={16} height={16} /> Campo</button>
      {pop.aberto && (
        <form className="elev borda rounded-painel absolute z-20 mt-1 p-3 flex flex-col gap-2" style={{ width: 260 }}
          onSubmit={(e) => { e.preventDefault(); novoCampo(abaId, tipo, nome.trim() || NOMES_TIPO[tipo]); setNome(''); pop.setAberto(false) }}>
          <label className="flex flex-col gap-1"><span>Nome</span><input autoFocus className="campo" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span>Tipo</span>
            <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCampo)}>
              {TIPOS.map((t) => <option key={t} value={t}>{NOMES_TIPO[t]}</option>)}
            </select>
          </label>
          <button className="btn-primario justify-center">Adicionar campo</button>
        </form>
      )}
    </div>
  )
}
