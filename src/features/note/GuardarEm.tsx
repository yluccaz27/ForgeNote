import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTable, useWsTable } from '../../lib/data'
import { guardarEm, novaPasta } from '../../lib/domain'
import { dica } from '../../lib/shortcuts'
import { normalizar } from '../../lib/text'
import { toast } from '../../store/ui'
import { Modal } from '../../components/Modal'
import { IconFechar, IconMais, IconPasta } from '../../components/Icons'

/** Campo "Guardar em": chips Gaveteiro › Pasta, e as automáticas só para leitura. */
export function GuardarEm({ noteId, onAbrir }: { noteId: string; onAbrir: () => void }) {
  const gavs = useWsTable('gaveteiros')
  const pastas = useTable('pastas')
  const notePasta = useTable('note_pasta')
  const gavNome = new Map(gavs.map((g) => [g.id, g.nome]))
  const minhas = notePasta.filter((x) => x.note_id === noteId)
    .map((x) => pastas.find((p) => p.id === x.pasta_id))
    .filter((p): p is NonNullable<typeof p> => !!p && gavNome.has(p.gaveteiro_id))
  const manuais = minhas.filter((p) => p.origem === 'manual')
  const automaticas = minhas.filter((p) => p.origem === 'regra')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {manuais.length === 0 && (
          <button className="chip chip-tracejado" onClick={onAbrir} title={dica('note.guardar', 'Escolher pasta')}>Sem pasta</button>
        )}
        {manuais.map((p) => (
          <span key={p.id} className="chip">
            <Link to={`/gaveteiro/${p.gaveteiro_id}?pasta=${p.id}`} className="valor text-ui-sm"><span className="meta">{gavNome.get(p.gaveteiro_id)} › </span>{p.nome}</Link>
            <button aria-label={`Tirar da pasta ${p.nome}`} title="Tirar desta pasta" className="meta" onClick={() => guardarEm(noteId, p.id, false)}><IconFechar width={12} height={12} /></button>
          </span>
        ))}
        <button className="btn-fantasma text-ui-sm" style={{ minHeight: 24 }} onClick={onAbrir} title={dica('note.guardar')}><IconMais width={14} height={14} /> Pasta</button>
      </div>
      {automaticas.length > 0 && (
        <p className="flex items-start gap-1 text-ui-sm">
          <IconPasta width={14} height={14} className="meta shrink-0" style={{ marginTop: 2 }} aria-hidden />
          <span>
            {automaticas.map((p, i) => (
              <span key={p.id} title={`Vem do campo ${p.regra_campo_id ?? ''}`}>
                <span className="valor text-ui-sm">{p.nome}</span>{i < automaticas.length - 1 ? ', ' : ' '}
              </span>
            ))}
            <span className="meta">(automáticas)</span>
          </span>
        </p>
      )}
    </div>
  )
}

/** Seletor em árvore: gaveteiros → pastas, com busca e marcação múltipla. */
export function GuardarEmModal({ noteId, onFechar }: { noteId: string; onFechar: () => void }) {
  const gavs = useWsTable('gaveteiros')
  const pastas = useTable('pastas')
  const notePasta = useTable('note_pasta')
  const [q, setQ] = useState('')
  const [criandoEm, setCriandoEm] = useState<string | null>(null)
  const [nomeNova, setNomeNova] = useState('')
  const dentro = new Set(notePasta.filter((x) => x.note_id === noteId).map((x) => x.pasta_id))
  const termo = normalizar(q.trim())
  const arvore = useMemo(() => [...gavs].sort((a, b) => a.ordem - b.ordem).map((g) => ({
    g,
    pastas: pastas.filter((p) => p.gaveteiro_id === g.id && p.origem === 'manual')
      .filter((p) => !termo || normalizar(`${g.nome} ${p.nome}`).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  })).filter((x) => x.pastas.length || !termo || normalizar(x.g.nome).includes(termo)), [gavs, pastas, termo])

  function marcar(pastaId: string, nome: string, on: boolean) {
    guardarEm(noteId, pastaId, on)
    if (on) toast(`Guardado em ${nome}`)
  }
  function criar(gavId: string) {
    const nome = nomeNova.trim()
    if (!nome) { setCriandoEm(null); return }
    const id = novaPasta(gavId, nome)
    marcar(id, nome, true)
    setCriandoEm(null); setNomeNova('')
  }

  return (
    <Modal titulo="Guardar em" onFechar={onFechar} largura={520}>
      <input className="campo mb-3" placeholder="Buscar gaveteiro ou pasta" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pasta" />
      {gavs.length === 0 && (
        <p>Ainda não há gaveteiros. <Link to="/gaveteiro" className="underline" onClick={onFechar}>Crie um na aba Gaveteiro</Link> para guardar notes em pastas.</p>
      )}
      {gavs.length > 0 && arvore.length === 0 && <p className="meta">Nenhuma pasta com "{q}".</p>}
      <div className="flex flex-col gap-4">
        {arvore.map(({ g, pastas: ps }) => (
          <fieldset key={g.id}>
            <legend className="font-texto font-semibold mb-1">{g.nome}</legend>
            <ul className="flex flex-col" style={{ paddingLeft: 12, borderLeft: '1px solid var(--borda)' }}>
              {ps.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2 min-h-alvo px-2 rounded-campo">
                    <input type="checkbox" checked={dentro.has(p.id)} onChange={(e) => marcar(p.id, p.nome, e.target.checked)} />
                    <IconPasta width={16} height={16} className="meta" aria-hidden />
                    <span className="valor">{p.nome}</span>
                  </label>
                </li>
              ))}
              <li>
                {criandoEm === g.id ? (
                  <form className="flex gap-2 px-2 py-1" onSubmit={(e) => { e.preventDefault(); criar(g.id) }}>
                    <input autoFocus className="campo valor" placeholder="Nome da pasta, ex.: Personagens" value={nomeNova} onChange={(e) => setNomeNova(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setCriandoEm(null) } }} aria-label={`Nome da nova pasta em ${g.nome}`} />
                    <button className="btn">Criar</button>
                  </form>
                ) : (
                  <button className="btn-fantasma meta text-ui-sm" onClick={() => { setCriandoEm(g.id); setNomeNova(q.trim()) }}>
                    <IconMais width={14} height={14} /> Nova pasta neste gaveteiro
                  </button>
                )}
              </li>
            </ul>
          </fieldset>
        ))}
      </div>
      <p className="meta text-ui-sm mt-4">Um note pode ficar em várias pastas. As pastas automáticas vêm dos campos com pasta e não aparecem aqui.</p>
      <div className="flex justify-end mt-4"><button className="btn-primario" onClick={onFechar}>Pronto</button></div>
    </Modal>
  )
}
