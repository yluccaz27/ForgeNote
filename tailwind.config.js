/** Tokens do sistema "Gabinete do arquivista". Nada fora daqui. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      mesa: '#1E2326',
      'mesa-alta': '#2A3135',
      papel: '#E4DCCB',
      tinta: '#262A2C',
      liquen: '#97A195',
      verdete: '#66AE9F',
      'verdete-tinta': '#2F6B5F',
      latao: '#BC995F',
      perigo: '#DE7660',
    },
    fontFamily: {
      texto: ['Literata', 'Georgia', 'serif'],
      ui: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
    },
    fontSize: {
      'ui-sm': ['12.5px', { lineHeight: '1.4' }],
      ui: ['15px', { lineHeight: '1.45' }],
      'ui-lg': ['18px', { lineHeight: '1.35' }],
      texto: ['18px', { lineHeight: '1.65' }],
      'titulo-papel': ['16px', { lineHeight: '1.25', fontWeight: '600' }],
      'titulo-note': ['30px', { lineHeight: '1.15', fontWeight: '600', letterSpacing: '-0.01em' }],
      'titulo-gaveteiro': ['24px', { lineHeight: '1.15', fontWeight: '500' }],
    },
    fontWeight: { normal: '400', medium: '500', semibold: '600' },
    spacing: {
      0: '0', px: '1px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px',
    },
    borderRadius: { none: '0', papel: '2px', campo: '4px', painel: '8px', chip: '999px' },
    boxShadow: { none: 'none', levantado: '0 12px 32px rgba(0,0,0,.45)' },
    extend: {
      width: { trilha: '140px', painel: '360px' },
      height: { header: '56px', alvo: '32px' },
      maxWidth: { medida: '68ch' },
      minHeight: { alvo: '32px' },
    },
  },
  plugins: [],
}
