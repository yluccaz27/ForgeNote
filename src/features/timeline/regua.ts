import { anoNaEra, diaDePartes, diasNoAno, erasOrdenadas, formatarAno, partesDeDia } from '../../lib/calendar'
import type { CalendarioConfig } from '../../lib/types'

export interface Tick { dia: number; rotulo: string }
export interface Regua { nivel: 'era' | 'ano' | 'mes' | 'dia'; menores: Tick[]; maiores: Tick[] }

const passoBonito = (min: number) => {
  let base = 1
  for (;;) {
    for (const m of [1, 2, 5]) if (base * m >= min) return base * m
    base *= 10
  }
}

/** Ticks da régua para a faixa visível. Nível troca conforme o zoom. */
export function calcularRegua(cal: CalendarioConfig, inicio: number, escala: number, largura: number): Regua {
  const fim = inicio + largura / escala
  const ano = diasNoAno(cal)
  const pxAno = escala * ano
  const menores: Tick[] = [], maiores: Tick[] = []

  if (escala >= 14) {
    const k = passoBonito(28 / escala)
    for (let d = Math.floor(inicio); d <= fim; d++) {
      const p = partesDeDia(cal, d)
      if (p.dia === 1) maiores.push({ dia: d, rotulo: `${cal.meses[p.mes].nome}, ${formatarAno(cal, p.ano)}` })
      if ((p.dia - 1) % k === 0) menores.push({ dia: d, rotulo: String(p.dia) })
    }
    return { nivel: 'dia', menores, maiores }
  }

  if (pxAno >= 240) {
    const a0 = partesDeDia(cal, inicio).ano, a1 = partesDeDia(cal, fim).ano
    const pxMesMedio = pxAno / cal.meses.length
    for (let a = a0; a <= a1; a++) {
      maiores.push({ dia: diaDePartes(cal, { ano: a, mes: 0, dia: 1 }), rotulo: formatarAno(cal, a) })
      cal.meses.forEach((m, i) => {
        const d = diaDePartes(cal, { ano: a, mes: i, dia: 1 })
        if (d >= inicio - 400 && d <= fim) menores.push({ dia: d, rotulo: pxMesMedio >= 56 ? m.nome : pxMesMedio >= 24 ? m.nome.slice(0, 3) : '' })
      })
    }
    return { nivel: 'mes', menores, maiores }
  }

  const k = passoBonito(72 / pxAno)
  const a0 = Math.floor(inicio / ano) + 1, a1 = Math.ceil(fim / ano) + 1
  const primeiro = Math.floor((a0 - 1) / k) * k + 1
  for (let a = primeiro; a <= a1; a += k) menores.push({ dia: (a - 1) * ano, rotulo: formatarAno(cal, a) })
  for (const er of erasOrdenadas(cal)) {
    const d = (er.ano_inicial - 1) * ano
    maiores.push({ dia: d, rotulo: er.nome })
  }
  return { nivel: k >= 100 ? 'era' : 'ano', menores, maiores }
}

/** "Era do Selo ▸ 340" no canto da régua, para o ponto à esquerda. */
export function contexto(cal: CalendarioConfig, dia: number) {
  const p = partesDeDia(cal, dia)
  const { era, ano } = anoNaEra(cal, p.ano)
  return era ? `${era.nome} ▸ ${ano}` : String(ano)
}
