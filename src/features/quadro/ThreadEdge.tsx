import { memo, useLayoutEffect, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, getStraightPath, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react'

export type FioData = {
  tipo: 'manual' | 'campo'
  oculta: boolean
  novo: boolean
  rotulo: string
  esmaecido: boolean
  onRotulo?: (r: string) => void
  onRemover?: () => void
}
export type FioEdgeT = Edge<FioData, 'fio'>

function centro(n: InternalNode) {
  const w = n.measured.width ?? 200, h = n.measured.height ?? 48
  return { x: n.internals.positionAbsolute.x + w / 2, y: n.internals.positionAbsolute.y + h / 2, w, h }
}
/** ponto onde a reta entre os centros cruza a borda do papel */
function borda(a: ReturnType<typeof centro>, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y
  if (!dx && !dy) return a
  const s = Math.min(dx ? a.w / 2 / Math.abs(dx) : Infinity, dy ? a.h / 2 / Math.abs(dy) : Infinity)
  return { x: a.x + dx * s, y: a.y + dy * s }
}

/** Fio de cobre oxidado (verdete). Campo: sólido 2px. Manual: tracejado 1.5px. Oculto: tracejado líquen. */
export const ThreadEdge = memo(function ThreadEdge({ id, source, target, data, selected }: EdgeProps<FioEdgeT>) {
  const s = useInternalNode(source), t = useInternalNode(target)
  const path = useRef<SVGPathElement>(null)
  const [len, setLen] = useState<number | null>(null)
  const [editando, setEditando] = useState(false)
  const [desenhando, setDesenhando] = useState(false)
  useLayoutEffect(() => {
    if (!data?.novo || !path.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setLen(path.current.getTotalLength()); setDesenhando(true)
    const t = setTimeout(() => setDesenhando(false), 520)
    return () => clearTimeout(t)
  }, [data?.novo])
  if (!s || !t || !data) return null

  const cs = centro(s), ct = centro(t)
  const p1 = borda(cs, ct), p2 = borda(ct, cs)
  const [d, lx, ly] = getStraightPath({ sourceX: p1.x, sourceY: p1.y, targetX: p2.x, targetY: p2.y })
  const cor = data.oculta ? 'var(--liquen)' : 'var(--verdete)'
  const style: React.CSSProperties = {
    stroke: cor,
    strokeWidth: data.tipo === 'campo' && !data.oculta ? (selected ? 3 : 2) : selected ? 2.5 : 1.5,
    strokeDasharray: data.tipo === 'manual' || data.oculta ? '6 4' : undefined,
    opacity: data.esmaecido ? 0.25 : 1,
  }

  return (
    <>
      {/* o momento memorável: o fio é desenhado de um papel ao outro (350ms) e vibra 1px no fim */}
      <path ref={path} d={d} fill="none" stroke="none" />
      {desenhando && len != null && (
        <path d={d} fill="none" className="fio-novo" style={{ stroke: cor, strokeWidth: 2, ['--len' as string]: len }} />
      )}
      <BaseEdge id={id} path={d} style={desenhando ? { ...style, opacity: 0 } : style} interactionWidth={16} />
      {(data.rotulo || selected || editando) && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan absolute text-ui-sm px-1 rounded-campo flex items-center gap-1"
            style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`, background: 'var(--mesa)', color: data.oculta ? 'var(--liquen)' : 'var(--papel)', pointerEvents: 'all', opacity: data.esmaecido ? 0.25 : 1 }}
            onDoubleClick={() => data.tipo === 'manual' && setEditando(true)}>
            {editando ? (
              <input autoFocus className="campo text-ui-sm" style={{ minHeight: 24, width: 140 }} defaultValue={data.rotulo} aria-label="Rótulo da conexão"
                onBlur={(e) => { data.onRotulo?.(e.target.value.trim()); setEditando(false) }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditando(false) }} />
            ) : <span title={data.tipo === 'manual' ? 'Duplo clique para editar' : 'Vem do campo da ficha'}>{data.rotulo || (data.tipo === 'manual' ? 'sem rótulo' : '')}</span>}
            {selected && !editando && (
              <button className="btn-fantasma text-ui-sm" style={{ minHeight: 24 }} onClick={data.onRemover}>
                {data.tipo === 'campo' ? (data.oculta ? 'Mostrar conexão' : 'Ocultar conexão') : 'Excluir linha'}
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
