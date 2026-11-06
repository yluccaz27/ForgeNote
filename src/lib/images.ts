import { useEffect, useState } from 'react'
import { getBackend } from './data'

/** Comprime no cliente: máx. 1600px no maior lado, webp. */
export async function comprimir(file: File, max = 1600, qualidade = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  return await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('falha ao comprimir a imagem'))), 'image/webp', qualidade),
  )
}

const urlCache = new Map<string, Promise<string>>()
export function useImagem(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) { setUrl(null); return }
    let vivo = true
    if (!urlCache.has(path)) urlCache.set(path, getBackend().imageUrl(path))
    urlCache.get(path)!.then((u) => vivo && setUrl(u)).catch(() => vivo && setUrl(null))
    return () => { vivo = false }
  }, [path])
  return url
}
