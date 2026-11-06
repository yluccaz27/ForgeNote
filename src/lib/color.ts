/**
 * Cor de marcação por predefinição: paleta secundária dessaturada com
 * luminosidade fixa (OKLCH L 0,68, C 0,06), em faixa de 3px no papel.
 * Evita os matizes do verdete (~180°), do latão (~80°) e do perigo (~35°),
 * para a marcação nunca se confundir com acento, metal ou exclusão.
 */
const MATIZES = [110, 135, 230, 255, 280, 305, 330]

export function corMarcacao(chave: string | null | undefined): string {
  if (!chave) return 'oklch(68% 0 0)'
  let h = 0
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `oklch(68% 0.06 ${MATIZES[h % MATIZES.length]})`
}

/** Cor de trilha livre (mesma família). */
export const corTrilha = corMarcacao
