import { useEffect, useState, type ReactNode } from 'react'
import { useTable, useWsTable, write } from '../../lib/data'
import {
  alternarOrganizaPasta, alternarTituloLigado, campoNomeDoNote, definirTipo, definirTitulo,
  novaAba, reordenarAbas, tituloLigado, usosDoNote,
} from '../../lib/domain'
import { excluirCampo, excluirNote, excluirSecao } from '../../lib/excluir'
import { useNote } from '../../lib/hooks'
import { useAtalho } from '../../lib/shortcuts'
import { corMarcacao } from '../../lib/color'
import { Notepad } from '../../components/Notepad'
import { Modal } from '../../components/Modal'
import { MenuMais } from '../../components/Menu'
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao'
import { IconInfo, IconLink, IconLinkQuebrado, IconMais, IconPasta, IconProvisorio } from '../../components/Icons'
import { ConfigCampo, NovoCampoModal, ValorCampo } from './Campos'
import { GuardarEm, GuardarEmModal } from './GuardarEm'
import { SalvarPredefModal } from './SalvarPredefModal'
import type { NoteAba, NoteCampo } from '../../lib/types'

/** Ajuda de cada bloco: pode ser recolhida, ⓘ reabre. Fica salva no navegador. */
function useAjuda(id: string): [boolean, () => void] {
  const k = `forgenote:ajuda:${id}`
  const [ver, setVer] = useState(() => { try { return localStorage.getItem(k) !== '0' } catch { return true } })
  return [ver, () => setVer((v) => { try { localStorage.setItem(k, v ? '0' : '1') } catch { /* ok */ } return !v })]
}

function Bloco({ n, id, titulo, ajuda, acoes, children, compacto, ultimo = false }: {
  n: number; id: string; titulo: string; ajuda: ReactNode; acoes?: ReactNode; children: ReactNode; compacto: boolean; ultimo?: boolean
}) {
  const [ver, alternar] = useAjuda(id)
  const recuo = compacto ? 0 : 28
  return (
    <section aria-labelledby={`bloco-${id}`} className={`${compacto ? 'px-4 py-4' : 'px-6 py-6'} ${ultimo ? '' : 'borda-b'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="num-bloco" aria-hidden>{n}</span>
        <h2 id={`bloco-${id}`} className="text-ui-lg font-semibold">{titulo}</h2>
        <button className="btn-icone meta" aria-pressed={ver} title={ver ? 'Ocultar ajuda' : 'Mostrar ajuda'}
          aria-label={ver ? `Ocultar ajuda de ${titulo}` : `Mostrar ajuda de ${titulo}`} onClick={alternar}><IconInfo width={16} height={16} /></button>
        <div className="flex-1" />
        {acoes}
      </div>
      {ver && <p className="meta mb-3" style={{ paddingLeft: recuo, maxWidth: '72ch' }}>{ajuda}</p>}
      <div style={{ paddingLeft: recuo }}>{children}</div>
    </section>
  )
}

/** Note em 3 blocos: Identificação, Ficha e História. */
export function NoteEditor({ noteId, compacto = false, onExcluido }: { noteId: string; compacto?: boolean; onExcluido?: () => void }) {
  const note = useNote(noteId)
  const predefs = useWsTable('predefinicoes')
  const todasAbas = useTable('note_abas')
  const todosCampos = useTable('note_campos')
  useTable('note_valores') // o nome ligado depende dos valores
  const abas = todasAbas.filter((a) => a.note_id === noteId).sort((a, b) => a.ordem - b.ordem)
  const [abaAtiva, setAbaAtiva] = useState<string | null>(null)
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [recemCriada, setRecemCriada] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [config, setConfig] = useState<NoteCampo | null>(null)
  const [novoCampo, setNovoCampo] = useState(false)
  const [guardar, setGuardar] = useState(false)
  const [predef, setPredef] = useState(false)
  const [exNote, setExNote] = useState<string[] | null>(null)
  const [exSecao, setExSecao] = useState<NoteAba | null>(null)
  const [exCampo, setExCampo] = useState<NoteCampo | null>(null)
  const aba = abas.find((a) => a.id === abaAtiva) ?? abas[0]
  const campos = aba ? todosCampos.filter((c) => c.aba_id === aba.id).sort((a, b) => a.ordem - b.ordem) : []

  useEffect(() => { setAbaAtiva(null) }, [noteId])
  useAtalho('note.guardar', () => setGuardar(true), !compacto && !!note)
  if (!note) return <p className="meta p-6">Este note não existe mais.</p>
  const campoNome = campoNomeDoNote(noteId)
  const ligado = tituloLigado(note)

  function soltarAba(alvo: string) {
    if (!arrastando || arrastando === alvo) return
    const ids = abas.map((a) => a.id).filter((id) => id !== arrastando)
    ids.splice(ids.indexOf(alvo), 0, arrastando)
    reordenarAbas(noteId, ids)
    setArrastando(null)
  }
  const criarSecao = () => { const id = novaAba(noteId); setAbaAtiva(id); setRenomeando(id); setRecemCriada(id) }
  const moverSecao = (d: -1 | 1) => {
    if (!aba) return
    const ids = abas.map((x) => x.id); const i = ids.indexOf(aba.id); const j = i + d
    if (j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; reordenarAbas(noteId, ids) }
  }

  return (
    <div className="flex flex-col">
      {/* ───────── 1 Identificação ───────── */}
      <Bloco n={1} id="ident" titulo="Identificação" compacto={compacto}
        ajuda="O título é o nome curto do note, usado no gaveteiro, no quadro e na timeline. Como o personagem ou lugar se chama na história fica no campo Nome da ficha."
        acoes={
          <div style={{ marginRight: compacto ? 0 : 32 }}>
            <MenuMais rotulo={`Opções do note ${note.titulo}`}
              itens={[{ rotulo: 'Salvar como predefinição…', onClick: () => setPredef(true) }]}
              excluir={() => setExNote(usosDoNote(noteId))} />
          </div>
        }>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="rotulo" htmlFor={`titulo-${noteId}`}>Título do note</label>
            <div className="flex items-center gap-2">
              <span aria-hidden style={{ width: 3, alignSelf: 'stretch', background: corMarcacao(note.predefinicao_id) }} />
              <TituloEditavel key={note.titulo} id={`titulo-${noteId}`} titulo={note.titulo} provisorio={note.titulo_provisorio}
                compacto={compacto} onSalvar={(t) => definirTitulo(noteId, t)} />
              {campoNome && (
                <button className="btn-icone meta shrink-0" aria-pressed={ligado}
                  title={ligado ? `Título igual ao ${campoNome.nome}. Clique para deixar independente.` : `Título independente. Clique para igualar ao ${campoNome.nome}.`}
                  aria-label={ligado ? `Título igual ao ${campoNome.nome}` : 'Título independente'}
                  style={ligado ? { color: 'var(--verdete)' } : undefined}
                  onClick={() => alternarTituloLigado(noteId)}>{ligado ? <IconLink /> : <IconLinkQuebrado />}</button>
              )}
            </div>
            <p className="meta text-ui-sm">
              {note.titulo_provisorio ? 'Título provisório, tirado da primeira linha da história. Digite um para fixar.'
                : campoNome ? (ligado ? `Acompanha o campo ${campoNome.nome}.` : `Independente do campo ${campoNome.nome}.`) : 'Como este note aparece no gaveteiro, quadro e timeline.'}
            </p>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: compacto ? 'minmax(0,1fr)' : 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))' }}>
            <label className="flex flex-col gap-1">
              <span className="rotulo">Tipo</span>
              <select className="campo valor" value={note.predefinicao_id ?? ''} onChange={(e) => definirTipo(noteId, e.target.value || null)}>
                <option value="">Sem tipo</option>
                {predefs.map((p) => <option key={p.id} value={p.id}>{p.icone} {p.nome}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              <span className="rotulo">Guardar em</span>
              <GuardarEm noteId={noteId} onAbrir={() => setGuardar(true)} />
            </div>
          </div>
        </div>
      </Bloco>

      {/* ───────── 2 Ficha ───────── */}
      <Bloco n={2} id="ficha" titulo="Ficha" compacto={compacto}
        ajuda={<>Seções agrupam campos parecidos. Exemplos: <em>Identidade</em> (nome, idade, aparência), <em>Afiliação</em> (facção, quem representa, aliados), <em>Estado</em> (vivo ou morto, ferimentos, paradeiro).</>}>
        {abas.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p>Esta ficha ainda não tem seções. Crie uma para começar a organizar os dados.</p>
            <button className="btn" onClick={criarSecao}><IconMais width={16} height={16} /> Seção</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1 mb-4">
              <div role="tablist" aria-label="Seções da ficha" className="flex flex-wrap items-center gap-1">
                {abas.map((a) => renomeando === a.id ? (
                  <input key={a.id} autoFocus className="campo valor" style={{ width: 220 }} defaultValue={recemCriada === a.id ? '' : a.nome}
                    placeholder="Nome da seção, ex.: Afiliação" aria-label="Nome da seção"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== a.nome) write.update('note_abas', { id: a.id }, { nome: v }); setRenomeando(null); setRecemCriada(null) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setRenomeando(null); setRecemCriada(null) } }} />
                ) : (
                  <button key={a.id} role="tab" aria-selected={aba?.id === a.id} className="aba valor"
                    draggable onDragStart={() => setArrastando(a.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => soltarAba(a.id)}
                    onClick={() => setAbaAtiva(a.id)} onDoubleClick={() => setRenomeando(a.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'F2') { e.preventDefault(); setRenomeando(a.id) }
                      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); setAbaAtiva(a.id); moverSecao(e.key === 'ArrowLeft' ? -1 : 1) }
                    }}
                    title="Duplo clique ou F2 renomeia. Arraste ou Alt+setas para reordenar.">{a.nome}</button>
                ))}
              </div>
              <button className="btn-fantasma text-ui-sm" onClick={criarSecao}><IconMais width={14} height={14} /> Seção</button>
              {aba && (
                <MenuMais rotulo={`Opções da seção ${aba.nome}`} alinhar="esquerda"
                  itens={[
                    { rotulo: 'Renomear seção', titulo: 'F2', onClick: () => setRenomeando(aba.id) },
                    abas.length > 1 && { rotulo: 'Mover para a esquerda', onClick: () => moverSecao(-1), desativado: abas[0].id === aba.id },
                    abas.length > 1 && { rotulo: 'Mover para a direita', onClick: () => moverSecao(1), desativado: abas[abas.length - 1].id === aba.id },
                  ]}
                  excluir={() => setExSecao(aba)} />
              )}
            </div>

            {aba && campos.length === 0 && (
              <div className="flex flex-col items-start gap-3">
                <p>Seção vazia. Adicione o primeiro campo.</p>
                <button className="btn" onClick={() => setNovoCampo(true)}><IconMais width={16} height={16} /> Campo</button>
              </div>
            )}
            {campos.length > 0 && (
              <>
                <div className="grid gap-x-6 gap-y-4 mb-4" style={{ gridTemplateColumns: compacto ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
                  {campos.map((c) => (
                    <div key={c.id} className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <button className="rotulo text-left truncate flex-1 min-w-0" title={`${c.nome}: configurar campo`} onClick={() => setConfig(c)}>{c.nome}</button>
                        {(c.tipo === 'relacao' || c.tipo === 'selecao') && (
                          <button className="btn-icone" aria-pressed={c.organiza_pasta} style={{ width: 24, minHeight: 24, color: c.organiza_pasta ? 'var(--verdete)' : 'var(--liquen)' }}
                            aria-label={c.organiza_pasta ? `Parar de organizar pastas por ${c.nome}` : `Organizar pastas por ${c.nome}`}
                            title={c.organiza_pasta ? 'Cria pastas automáticas por este campo. Clique para desligar.' : 'Clique para criar pastas automáticas por este campo'}
                            onClick={() => alternarOrganizaPasta(c.id)}><IconPasta width={14} height={14} /></button>
                        )}
                        <MenuMais rotulo={`Opções do campo ${c.nome}`} itens={[{ rotulo: 'Configurar campo…', onClick: () => setConfig(c) }]} excluir={() => setExCampo(c)} />
                      </div>
                      <ValorCampo campo={c} noteId={noteId} />
                    </div>
                  ))}
                </div>
                <button className="btn" onClick={() => setNovoCampo(true)}><IconMais width={16} height={16} /> Campo</button>
              </>
            )}
          </>
        )}
      </Bloco>

      {/* ───────── 3 História ───────── */}
      <Bloco n={3} id="historia" titulo="História" compacto={compacto} ultimo
        ajuda="Texto livre. Escreva [[Nome de outro note]] para citá-lo: vira um link.">
        <div className="max-w-medida"><Notepad noteId={noteId} compacto={compacto} /></div>
      </Bloco>

      {config && (
        <Modal titulo={`Campo ${config.nome}`} onFechar={() => setConfig(null)}>
          <ConfigCampo campo={todosCampos.find((c) => c.id === config.id) ?? config} onFechar={() => setConfig(null)} />
        </Modal>
      )}
      {novoCampo && aba && <NovoCampoModal abaId={aba.id} onFechar={() => setNovoCampo(false)} />}
      {guardar && <GuardarEmModal noteId={noteId} onFechar={() => setGuardar(false)} />}
      {predef && <SalvarPredefModal noteId={noteId} onFechar={() => setPredef(false)} />}

      {exNote && (
        <ConfirmarExclusao oque="o note" nome={note.titulo} acao="Excluir note" onFechar={() => setExNote(null)}
          onExcluir={() => { excluirNote(noteId); onExcluido?.() }}>
          {exNote.length > 0 ? (
            <>
              <p>Este note é usado em:</p>
              <ul className="list-disc" style={{ paddingLeft: 24 }}>{exNote.map((u) => <li key={u}>{u}</li>)}</ul>
              <p className="meta">Essas referências deixam de aparecer. Os outros notes continuam existindo.</p>
            </>
          ) : <p>Ninguém aponta para este note. A ficha, a história e as posições no quadro e na timeline saem junto.</p>}
          <p className="meta">Dá para desfazer logo depois. Ele fica guardado por 30 dias antes de sumir de vez.</p>
        </ConfirmarExclusao>
      )}
      {exSecao && (
        <ConfirmarExclusao oque="a seção" nome={exSecao.nome} acao="Excluir seção" onFechar={() => setExSecao(null)}
          onExcluir={() => { excluirSecao(exSecao); setAbaAtiva(null) }}>
          {(() => { const n = todosCampos.filter((c) => c.aba_id === exSecao.id).length; return (
            <p>{n ? `Os ${n === 1 ? 'campo' : `${n} campos`} desta seção e o que foi preenchido neles saem deste note.` : 'A seção está vazia.'} A predefinição e os outros notes não mudam.</p>
          ) })()}
        </ConfirmarExclusao>
      )}
      {exCampo && (
        <ConfirmarExclusao oque="o campo" nome={exCampo.nome} acao="Excluir campo" onFechar={() => setExCampo(null)}
          onExcluir={() => excluirCampo(exCampo)}>
          <p>O valor preenchido sai deste note.{exCampo.tipo === 'relacao' ? ' As conexões que este campo criava no quadro também saem.' : ''}{exCampo.organiza_pasta ? ' As pastas automáticas deste campo deixam de receber o note.' : ''}</p>
          <p className="meta">A predefinição e os outros notes não mudam.</p>
        </ConfirmarExclusao>
      )}
    </div>
  )
}

function TituloEditavel({ id, titulo, provisorio, compacto, onSalvar }: { id: string; titulo: string; provisorio: boolean; compacto: boolean; onSalvar: (t: string) => void }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <input id={id} className={`flex-1 bg-transparent font-texto ${compacto ? 'text-ui-lg font-semibold' : 'text-titulo-note'} text-papel min-w-0 ${provisorio ? 'italic' : ''}`}
        style={{ border: 0, color: provisorio ? 'var(--liquen)' : undefined }}
        defaultValue={titulo} placeholder="Ex.: Mara"
        onFocus={(e) => { if (provisorio) e.target.select() }}
        onBlur={(e) => { const v = e.target.value.trim(); if (v !== titulo) onSalvar(v) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      {provisorio && <span title="Título gerado automaticamente. Digite um para fixar." className="meta"><IconProvisorio /><span className="sr-only">Título provisório</span></span>}
    </div>
  )
}
