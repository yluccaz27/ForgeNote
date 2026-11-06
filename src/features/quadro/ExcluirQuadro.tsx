import { useState } from 'react'
import { manuaisDoQuadro, excluirQuadro } from '../../lib/excluir'
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao'
import type { Quadro } from '../../lib/types'

export function ExcluirQuadroDialogo({ quadro, onFechar, onExcluido }: { quadro: Quadro; onFechar: () => void; onExcluido?: () => void }) {
  const n = manuaisDoQuadro(quadro.id).length
  const [comManuais, setComManuais] = useState(true)
  return (
    <ConfirmarExclusao oque="o quadro" nome={quadro.nome} acao="Excluir quadro" onFechar={onFechar}
      onExcluir={() => { excluirQuadro(quadro.id, n > 0 && comManuais); onExcluido?.() }}>
      <p>Os notes e as conexões da ficha continuam existindo. Saem só a posição dos papéis e as conexões ocultadas neste quadro.</p>
      {n > 0 && (
        <label className="flex items-start gap-2">
          <input type="checkbox" style={{ marginTop: 4 }} checked={comManuais} onChange={(e) => setComManuais(e.target.checked)} />
          <span>Excluir também {n === 1 ? 'a conexão manual criada aqui' : `as ${n} conexões manuais criadas aqui`}</span>
        </label>
      )}
    </ConfirmarExclusao>
  )
}
