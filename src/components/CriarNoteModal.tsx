import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWsTable } from '../lib/data'
import { criarNote } from '../lib/domain'
import { corMarcacao } from '../lib/color'
import { useUI } from '../store/ui'
import { Modal } from './Modal'

export function CriarNoteModal({ req }: { req: NonNullable<ReturnType<typeof useUI.getState>['criar']> }) {
  const { wsId, fecharCriar } = useUI()
  const predefs = useWsTable('predefinicoes')
  const [titulo, setTitulo] = useState(req.titulo ?? '')
  const nav = useNavigate()
  const ordenadas = [...predefs].sort((a, b) =>
    Number(req.sugeridas?.includes(b.id) ?? 0) - Number(req.sugeridas?.includes(a.id) ?? 0) || a.nome.localeCompare(b.nome))

  function criar(predefId: string | null) {
    if (!wsId) return
    const id = criarNote({ workspaceId: wsId, predefinicaoId: predefId, titulo, pastaId: req.pastaId })
    fecharCriar()
    req.onCriado?.(id)
    if (!req.ficar) nav(`/note/${id}`)
  }

  return (
    <Modal titulo="Criar note" onFechar={fecharCriar}>
      <label className="flex flex-col gap-1 mb-4">
        <span>Título</span>
        <input className="campo font-texto" placeholder="Pode deixar em branco" value={titulo} onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') criar(req.sugeridas?.[0] ?? null) }} />
      </label>
      <h3 className="mb-2">Tipo</h3>
      {ordenadas.length === 0 && <p className="meta mb-3">Nenhuma predefinição salva ainda. Crie um note zerado e use "Salvar como predefinição".</p>}
      <ul className="flex flex-col gap-1 mb-4">
        {ordenadas.map((p) => (
          <li key={p.id}>
            <button className="btn w-full justify-start" onClick={() => criar(p.id)}>
              <span aria-hidden style={{ width: 3, alignSelf: 'stretch', background: corMarcacao(p.id), margin: '6px 0' }} />
              <span aria-hidden>{p.icone}</span> {p.nome}
            </button>
          </li>
        ))}
      </ul>
      <div className="borda-t pt-4">
        <button className="btn w-full justify-start" onClick={() => criar(null)}>
          Sem tipo <span className="meta text-ui-sm">ficha vazia, só a história</span>
        </button>
      </div>
    </Modal>
  )
}
