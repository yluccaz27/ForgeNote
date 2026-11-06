import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'

/**
 * Diálogo único de exclusão do app.
 * Diz o que sai pelo nome, o que acontece e o que não acontece.
 * [Cancelar] neutro à esquerda; [Excluir …] à direita, o único uso da cor perigo.
 * Alto impacto: `digitarNome` exige digitar o nome antes de liberar o botão.
 */
export function ConfirmarExclusao({ oque, nome, acao, children, digitarNome = false, bloqueado = false, onExcluir, onFechar }: {
  /** "o quadro", "a pasta" */
  oque: string
  nome: string
  /** rótulo do botão final: "Excluir quadro" */
  acao: string
  children?: ReactNode
  digitarNome?: boolean
  /** impede excluir (ex.: falta escolher outro calendário) */
  bloqueado?: boolean
  onExcluir: () => void
  onFechar: () => void
}) {
  const [digitado, setDigitado] = useState('')
  const confere = !digitarNome || digitado.trim() === nome.trim()
  return (
    <Modal titulo={<>Excluir {oque} <em className="font-texto">{nome}</em>?</>} rotulo={`Excluir ${oque} ${nome}?`} onFechar={onFechar} largura={520}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (confere && !bloqueado) { onExcluir(); onFechar() } }}>
        <div className="flex flex-col gap-3">{children}</div>
        {digitarNome && (
          <label className="flex flex-col gap-1">
            <span>Para confirmar, digite <strong className="font-texto">{nome}</strong></span>
            <input className="campo font-texto" value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" />
          </label>
        )}
        <div className="flex justify-between gap-2 borda-t pt-4">
          <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn-perigo" disabled={!confere || bloqueado}>{acao}</button>
        </div>
      </form>
    </Modal>
  )
}
