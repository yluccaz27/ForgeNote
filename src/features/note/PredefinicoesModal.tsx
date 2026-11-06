import { useState } from 'react'
import { useTable, useWsTable, write } from '../../lib/data'
import { excluirPredefinicao } from '../../lib/excluir'
import { corMarcacao } from '../../lib/color'
import { Modal } from '../../components/Modal'
import { MenuMais } from '../../components/Menu'
import { ConfirmarExclusao } from '../../components/ConfirmarExclusao'
import type { Predefinicao } from '../../lib/types'

/** Predefinições do workspace: renomear e excluir. */
export function PredefinicoesModal({ onFechar }: { onFechar: () => void }) {
  const predefs = useWsTable('predefinicoes')
  const notes = useWsTable('notes')
  const abas = useTable('predef_abas')
  const campos = useTable('predef_campos')
  const [renomear, setRenomear] = useState<string | null>(null)
  const [excluir, setExcluir] = useState<Predefinicao | null>(null)
  const usos = (id: string) => notes.filter((n) => n.predefinicao_id === id).length

  return (
    <Modal titulo="Predefinições" onFechar={onFechar} largura={560}>
      {predefs.length === 0 && <p>Nenhuma predefinição ainda. Monte a ficha de um note e use ⋯, Salvar como predefinição.</p>}
      <ul className="flex flex-col gap-1">
        {[...predefs].sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => {
          const nAbas = abas.filter((a) => a.predefinicao_id === p.id)
          const nCampos = campos.filter((c) => nAbas.some((a) => a.id === c.aba_id)).length
          return (
            <li key={p.id} className="flex items-center gap-2 px-2 min-h-alvo rounded-campo" style={{ borderLeft: `3px solid ${corMarcacao(p.id)}` }}>
              <span aria-hidden>{p.icone}</span>
              {renomear === p.id ? (
                <input autoFocus className="campo valor flex-1" defaultValue={p.nome} aria-label="Nome da predefinição"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p.nome) write.update('predefinicoes', { id: p.id }, { nome: v }); setRenomear(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
              ) : (
                <span className="flex-1 min-w-0">
                  <span className="valor">{p.nome}</span>{' '}
                  <span className="meta text-ui-sm">{nAbas.length} {nAbas.length === 1 ? 'seção' : 'seções'}, {nCampos} {nCampos === 1 ? 'campo' : 'campos'}, {usos(p.id)} {usos(p.id) === 1 ? 'note' : 'notes'}</span>
                </span>
              )}
              <MenuMais rotulo={`Opções da predefinição ${p.nome}`} itens={[{ rotulo: 'Renomear predefinição', onClick: () => setRenomear(p.id) }]} excluir={() => setExcluir(p)} />
            </li>
          )
        })}
      </ul>
      {excluir && (
        <ConfirmarExclusao oque="a predefinição" nome={excluir.nome} acao="Excluir predefinição" onFechar={() => setExcluir(null)}
          onExcluir={() => excluirPredefinicao(excluir.id)}>
          <p>Ela deixa de aparecer em Criar note.{usos(excluir.id) ? ` Os ${usos(excluir.id) === 1 ? 'note criado' : `${usos(excluir.id)} notes criados`} com ela continuam iguais: cada um tem a própria cópia da ficha.` : ''}</p>
        </ConfirmarExclusao>
      )}
    </Modal>
  )
}
