import { Fragment, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ATALHOS, GRUPOS, nomeTecla, type Atalho, type Grupo } from '../lib/shortcuts'
import { normalizar } from '../lib/text'
import { useUI } from '../store/ui'
import { Modal } from './Modal'

// palavras que não são teclas físicas: aparecem como texto
const SEM_TECLA = new Set(['rolar', 'Setas'])

export function Teclas({ a }: { a: Atalho }) {
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {a.teclas.map((combo, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="meta px-1">{a.sep ?? ''}</span>}
          {combo.map((t, j) => (
            <Fragment key={j}>
              {j > 0 && SEM_TECLA.has(t) && <span className="meta">+</span>}
              {SEM_TECLA.has(t) && t !== 'Setas' ? <span>{t}</span> : <kbd className="tecla">{nomeTecla(t)}</kbd>}
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  )
}

const grupoDaRota = (p: string): Grupo =>
  p.startsWith('/note') ? 'Note' : p.startsWith('/quadro') ? 'Quadro' : p.startsWith('/timeline') ? 'Timeline' : 'Geral'

/** Painel "Atalhos do teclado", gerado do registro central. */
export function AtalhosModal() {
  const setAtalhos = useUI((s) => s.setAtalhos)
  const { pathname } = useLocation()
  const [q, setQ] = useState('')
  const atual = grupoDaRota(pathname)
  const ordem = [atual, ...GRUPOS.filter((g) => g !== atual)]
  const lista = Object.values(ATALHOS) as Atalho[]
  const filtrados = useMemo(() => {
    const t = normalizar(q.trim())
    return lista.filter((a) => !t || normalizar(`${a.descricao} ${a.grupo} ${a.teclas.flat().join(' ')}`).includes(t))
  }, [q])

  return (
    <Modal titulo="Atalhos do teclado" onFechar={() => setAtalhos(false)} largura={640}>
      <input className="campo mb-4" placeholder="Filtrar atalhos, ex.: zoom" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar atalhos" />
      {filtrados.length === 0 && <p className="meta">Nenhum atalho com "{q}".</p>}
      <div className="flex flex-col gap-4">
        {ordem.map((g) => {
          const itens = filtrados.filter((a) => a.grupo === g)
          if (!itens.length) return null
          return (
            <section key={g} aria-label={g}>
              <h3 className="text-ui font-semibold mb-2">{g}{g === atual && g !== 'Geral' ? <span className="meta font-normal">, nesta aba</span> : null}</h3>
              <dl className="grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: 'minmax(120px, auto) 1fr' }}>
                {itens.map((a) => (
                  <Fragment key={a.descricao}>
                    <dt><Teclas a={a} /></dt>
                    <dd className="m-0 self-center">{a.descricao}</dd>
                  </Fragment>
                ))}
              </dl>
            </section>
          )
        })}
      </div>
      <p className="meta text-ui-sm mt-4">Atalhos de uma tecla não funcionam enquanto você digita num campo ou no texto.</p>
    </Modal>
  )
}
