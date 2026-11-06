import { memo } from 'react'
import { Handle, Position, useConnection, type NodeProps, type Node } from '@xyflow/react'
import type { Note } from '../../lib/types'
import { Papel } from '../../components/Papel'

export type PaperData = { note: Note; miniatura?: string; esmaecido: boolean; destacado: boolean; arrastando: boolean }
export type PaperNodeT = Node<PaperData, 'papel'>

/**
 * Papel no quadro. A alça de saída fica na borda direita; durante uma
 * conexão o papel inteiro vira alvo, então é só soltar o fio em cima dele.
 */
export const PaperNode = memo(function PaperNode({ data, id }: NodeProps<PaperNodeT>) {
  const conexao = useConnection()
  const alvo = conexao.inProgress && conexao.fromNode?.id !== id
  return (
    <div className={data.esmaecido ? 'foco-esmaecido' : ''} style={{ width: 200 }}>
      <Papel note={data.note} miniatura={data.miniatura}
        className={`${data.arrastando ? 'papel-levantado' : ''}`}
        extra={data.destacado ? <span className="sr-only">em foco</span> : null} />
      {data.destacado && <div aria-hidden className="absolute rounded-papel" style={{ inset: -4, border: '2px solid var(--lacre)', pointerEvents: 'none' }} />}
      <Handle type="source" position={Position.Right} aria-label="Puxar fio" style={{ right: -6 }} />
      <Handle type="target" position={Position.Left} isConnectableStart={false}
        style={alvo ? { position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'none', borderRadius: 2, opacity: 0 } : { opacity: 0, pointerEvents: 'none' }} />
    </div>
  )
})
