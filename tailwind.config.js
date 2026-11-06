/** Tokens do sistema "Mesa do arquivista". Nada fora daqui. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      ardosia: '#22272B',
      'ardosia-alta': '#2F363B',
      osso: '#DAD5C8',
      liquen: '#8D978B',
      lacre: '#B23A44',
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
      'titulo-gaveteiro': ['38px', { lineHeight: '1.1', fontWeight: '500' }],
    },
    fontWeight: { normal: '400', medium: '500', semibold: '600' },
    spacing: {
      0: '0', px: '1px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px', 12: '48px',
    },
    borderRadius: { none: '0', papel: '2px', campo: '4px', painel: '8px', chip: '999px' },
    boxShadow: { none: 'none', levantado: '0 6px 14px rgba(0,0,0,.35)' },
    extend: {
      width: { rail: '64px', trilha: '140px', painel: '360px' },
      maxWidth: { medida: '68ch' },
      minHeight: { alvo: '32px' },
      height: { alvo: '32px' },
    },
  },
  plugins: [],
}
