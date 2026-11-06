import { useEffect, useRef, type ReactNode } from 'react'
import { usePopover } from '../lib/hooks'
import { IconLixo, IconMaisOpcoes } from './Icons'

export interface ItemMenu { rotulo: string; onClick: () => void; icone?: ReactNode; titulo?: string; desativado?: boolean }

/**
 * Menu ⋯ de um item. Excluir nunca é botão colorido fora de diálogo:
 * fica aqui, por último, depois de uma divisória, na cor normal do texto.
 */
export function MenuMais({ rotulo, itens = [], excluir, alinhar = 'direita', className = '', style, acima = false }: {
  style?: React.CSSProperties
  /** abre para cima (botão perto do fim de uma área recortada) */
  acima?: boolean
  /** nome acessível, ex.: "Opções do quadro Mapa" */
  rotulo: string
  itens?: (ItemMenu | false | null | undefined)[]
  excluir?: () => void
  alinhar?: 'direita' | 'esquerda'
  className?: string
}) {
  const pop = usePopover()
  const menu = useRef<HTMLDivElement>(null)
  const lista = itens.filter(Boolean) as ItemMenu[]

  // teclado: foco no primeiro item ao abrir, setas percorrem
  useEffect(() => {
    if (pop.aberto) menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus()
  }, [pop.aberto])
  const setas = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const els = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])]
    const i = els.indexOf(document.activeElement as HTMLElement)
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus()
  }
  const fazer = (fn: () => void) => { pop.setAberto(false); fn() }

  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} ${className}`} style={style} ref={pop.ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="btn-icone" aria-label={rotulo} title={rotulo} aria-haspopup="menu" aria-expanded={pop.aberto}
        onClick={(e) => { e.preventDefault(); pop.setAberto(!pop.aberto) }}><IconMaisOpcoes /></button>
      {pop.aberto && (
        <div ref={menu} role="menu" aria-label={rotulo} className={`menu ${acima ? '' : 'mt-1'}`} onKeyDown={setas}
          style={{ ...(alinhar === 'direita' ? { right: 0 } : { left: 0 }), ...(acima ? { bottom: '100%', marginBottom: 4 } : {}) }}>
          {lista.map((it) => (
            <button key={it.rotulo} type="button" role="menuitem" className="menu-item" title={it.titulo} disabled={it.desativado}
              onClick={(e) => { e.preventDefault(); fazer(it.onClick) }}>{it.icone}{it.rotulo}</button>
          ))}
          {excluir && (
            <>
              {lista.length > 0 && <div className="menu-divisoria" role="separator" />}
              <button type="button" role="menuitem" className="menu-item" onClick={(e) => { e.preventDefault(); fazer(excluir) }}>
                <IconLixo width={16} height={16} /> Excluir…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
