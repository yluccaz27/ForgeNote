import type { CalendarioConfig, Era } from './types'

/**
 * Datas são guardadas como número absoluto de dias.
 * Dia 0 = primeiro dia do ano absoluto 1. Ano absoluto pode ser ≤ 0.
 * Cada era começa num ano absoluto; uma era "para trás" conta os anos
 * de forma decrescente até a era seguinte (como a.C.).
 */
export interface DataPartes { ano: number; mes: number; dia: number } // ano absoluto, mes 0-based, dia 1-based

export const CALENDARIO_PADRAO: CalendarioConfig = {
  eras: [{ nome: 'Era Comum', sigla: 'E.C.', ano_inicial: 1, para_tras: false }],
  meses: Array.from({ length: 12 }, (_, i) => ({ nome: `Mês ${i + 1}`, dias: 30 })),
  semana: [],
}

export function diasNoAno(c: CalendarioConfig) {
  return Math.max(1, c.meses.reduce((s, m) => s + Math.max(1, m.dias), 0))
}

export function partesDeDia(c: CalendarioConfig, abs: number): DataPartes {
  const len = diasNoAno(c)
  const anoIdx = Math.floor(abs / len)
  let resto = abs - anoIdx * len
  let mes = 0
  while (mes < c.meses.length - 1 && resto >= c.meses[mes].dias) { resto -= c.meses[mes].dias; mes++ }
  return { ano: anoIdx + 1, mes, dia: resto + 1 }
}

export function diaDePartes(c: CalendarioConfig, p: DataPartes): number {
  const len = diasNoAno(c)
  let d = (p.ano - 1) * len
  for (let i = 0; i < p.mes && i < c.meses.length; i++) d += c.meses[i].dias
  return d + (p.dia - 1)
}

function erasOrdenadas(c: CalendarioConfig): Era[] {
  return [...c.eras].sort((a, b) => a.ano_inicial - b.ano_inicial)
}

/** Era de um ano absoluto e o ano exibido dentro dela. */
export function anoNaEra(c: CalendarioConfig, anoAbs: number): { era: Era | null; ano: number } {
  const eras = erasOrdenadas(c)
  if (!eras.length) return { era: null, ano: anoAbs }
  let idx = eras.findIndex((e, i) => anoAbs >= e.ano_inicial && (i === eras.length - 1 || anoAbs < eras[i + 1].ano_inicial))
  if (idx < 0) {
    // antes da primeira era: se ela conta para trás, cabe nela; senão, anos negativos da primeira
    idx = 0
  }
  const era = eras[idx]
  if (era.para_tras) {
    const fim = eras[idx + 1]?.ano_inicial ?? era.ano_inicial + 1
    return { era, ano: fim - anoAbs }
  }
  return { era, ano: anoAbs - era.ano_inicial + 1 }
}

/** Inverso: ano exibido numa era → ano absoluto. */
export function anoAbsoluto(c: CalendarioConfig, eraIdx: number, ano: number): number {
  const eras = erasOrdenadas(c)
  const era = eras[eraIdx]
  if (!era) return ano
  if (era.para_tras) {
    const fim = eras[eraIdx + 1]?.ano_inicial ?? era.ano_inicial + 1
    return fim - ano
  }
  return era.ano_inicial + ano - 1
}

export function formatarAno(c: CalendarioConfig, anoAbs: number) {
  const { era, ano } = anoNaEra(c, anoAbs)
  return era ? `${ano} ${era.sigla}` : String(ano)
}

/** "12 de Brumar, 340 E.S." */
export function formatarDia(c: CalendarioConfig, abs: number) {
  const p = partesDeDia(c, abs)
  const mes = c.meses[p.mes]?.nome ?? ''
  return `${p.dia} de ${mes}, ${formatarAno(c, p.ano)}`
}

export function formatarIntervalo(c: CalendarioConfig, ini: number, fim?: number | null) {
  if (fim == null || fim === ini) return formatarDia(c, ini)
  return `${formatarDia(c, ini)} até ${formatarDia(c, fim)}`
}

export function diaDaSemana(c: CalendarioConfig, abs: number) {
  if (!c.semana.length) return null
  const n = c.semana.length
  return c.semana[((abs % n) + n) % n]
}

export function eraIndexDoAno(c: CalendarioConfig, anoAbs: number) {
  const eras = erasOrdenadas(c)
  const { era } = anoNaEra(c, anoAbs)
  return era ? eras.indexOf(era) : 0
}

export { erasOrdenadas }
