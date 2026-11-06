import { useState } from 'react'
import { useTable } from '../../lib/data'
import { salvarComoPredefinicao } from '../../lib/domain'
import { toast } from '../../store/ui'
import { Modal } from '../../components/Modal'

const ICONES = ['▣', '☉', '⚑', '◆', '✶', '⌂', '☾', '⚔', '✦', '◈']

export function SalvarPredefModal({ noteId, onFechar }: { noteId: string; onFechar: () => void }) {
  const abas = useTable('note_abas').filter((a) => a.note_id === noteId)
  const campos = useTable('note_campos').filter((c) => abas.some((a) => a.id === c.aba_id))
  // só Relação e Seleção podem organizar pastas
  const elegiveis = campos.filter((c) => c.tipo === 'relacao' || c.tipo === 'selecao')
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState(ICONES[0])
  const [marcados, setMarcados] = useState<string[]>(elegiveis.filter((c) => c.organiza_pasta).map((c) => c.id))

  return (
    <Modal titulo="Salvar como predefinição" onFechar={onFechar}>
      <form className="flex flex-col gap-4" onSubmit={(e) => {
        e.preventDefault()
        if (!nome.trim()) return
        salvarComoPredefinicao(noteId, nome.trim(), icone, marcados)
        toast('Predefinição salva')
        onFechar()
      }}>
        <label className="flex flex-col gap-1"><span>Nome</span>
          <input className="campo" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <fieldset>
          <legend className="mb-1">Ícone</legend>
          <div className="flex flex-wrap gap-1">
            {ICONES.map((i) => (
              <button type="button" key={i} aria-pressed={icone === i} aria-label={`Ícone ${i}`}
                className={`btn-icone ${icone === i ? 'item-ativo bg-ardosia' : ''}`} onClick={() => setIcone(i)}>{i}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1">Organizar em pastas por: <span className="meta">(opcional)</span></legend>
          {elegiveis.length === 0
            ? <p className="meta">Este note não tem campos de Relação ou Seleção.</p>
            : (
              <div className="flex flex-wrap gap-3">
                {elegiveis.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={marcados.includes(c.id)}
                      onChange={() => setMarcados((m) => m.includes(c.id) ? m.filter((x) => x !== c.id) : [...m, c.id])} />
                    {c.nome}
                  </label>
                ))}
              </div>
            )}
        </fieldset>
        <p className="meta text-ui-sm">Campos e abas são copiados. Valores não entram na predefinição.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn-primario">Salvar predefinição</button>
        </div>
      </form>
    </Modal>
  )
}
