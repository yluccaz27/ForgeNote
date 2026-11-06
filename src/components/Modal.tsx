import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconFechar } from './Icons'

export function Modal({ titulo, rotulo, onFechar, children, largura = 480 }: {
  titulo: ReactNode; /** nome acessível quando o título não é texto puro */ rotulo?: string
  onFechar: () => void; children: ReactNode; largura?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  // onFechar costuma ser inline; guardar em ref evita refazer o foco a cada render
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  useEffect(() => {
    const onFechar = () => fechar.current()
    const anterior = document.activeElement as HTMLElement | null
    const el = ref.current
    const primeiro = el?.querySelector<HTMLElement>('input, select, textarea, button:not([data-fechar])')
    primeiro?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFechar() }
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'))
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); anterior?.focus?.() }
  }, [])

  // portal: painéis com transform (animação de entrada) prenderiam o position:fixed
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4" style={{ background: 'rgb(30 35 38 / .75)', paddingTop: '12vh' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={rotulo ?? (typeof titulo === 'string' ? titulo : undefined)}
        className="elev rounded-painel borda w-full flex flex-col shadow-levantado" style={{ maxWidth: largura, maxHeight: '76vh' }}>
        <div className="flex items-center justify-between px-4 py-3 borda-b">
          <h2 className="text-ui-lg font-semibold">{titulo}</h2>
          <button data-fechar className="btn-icone" onClick={onFechar} aria-label="Fechar"><IconFechar /></button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
