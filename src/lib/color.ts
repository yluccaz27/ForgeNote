/**
 * Cor de marcação por predefinição: paleta secundária dessaturada,
 * mesma luminosidade (L 60% em OKLCH), para nunca competir com o lacre.
 * Matizes perto do vermelho do lacre (~20°) são evitados.
 */
const MATIZES = [75, 110, 150, 190, 230, 265, 300, 340]

export function corMarcacao(chave: string | null | undefined): string {
  if (!chave) return 'oklch(60% 0 0)'
  let h = 0
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `oklch(60% 0.07 ${MATIZES[h % MATIZES.length]})`
}

/** Cor de trilha livre (mesma família). */
export const corTrilha = corMarcacao
