import type { SVGProps } from 'react'

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
})

export const IconNote = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3h9l3 3v15H6z" /><path d="M9 9h6M9 13h6M9 17h4" /></svg>
)
export const IconGaveteiro = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M4 9h16M4 15h16M10 6h4M10 12h4M10 18h4" /></svg>
)
export const IconQuadro = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="4" width="7" height="5" /><rect x="14" y="13" width="7" height="5" /><path d="M10 6.5c5 0 3 9 4 9" /></svg>
)
export const IconTimeline = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12h18" /><circle cx="8" cy="12" r="2" /><path d="M14 9h5v6h-5z" /></svg>
)
export const IconBusca = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>
)
export const IconMais = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconFechar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconPasta = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 6h6l2 2h10v11H3z" /></svg>
)
export const IconEngrenagem = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></svg>
)
/** lápis tracejado = gerado automaticamente (provisório) */
export const IconProvisorio = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} strokeDasharray="2.5 2.5"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
)
export const IconUsuario = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" /></svg>
)
export const IconSeta = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
)
export const IconLixo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
)
export const IconPainel = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M15 4v16" /></svg>
)
export const IconErro = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></svg>
)
export const IconOlho = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const IconArrastar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="9" cy="6" r=".8" /><circle cx="15" cy="6" r=".8" /><circle cx="9" cy="12" r=".8" /><circle cx="15" cy="12" r=".8" /><circle cx="9" cy="18" r=".8" /><circle cx="15" cy="18" r=".8" /></svg>
)
export const IconMaisOpcoes = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></svg>
)
export const IconTeclado = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="2.5" y="6" width="19" height="12" rx="1.5" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" /></svg>
)
/** título ligado ao campo Nome */
export const IconLink = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
)
export const IconLinkQuebrado = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15.7 14 18.7 11a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M8.3 10 5.3 13a4 4 0 0 0 5.7 5.7l1-1" /><path d="M4 4l3 3M20 20l-3-3" /></svg>
)
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>
)
