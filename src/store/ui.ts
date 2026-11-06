import { create } from 'zustand'

export interface Toast { id: number; texto: string; erro?: boolean; acao?: { rotulo: string; fn: () => void } }

interface CriarNoteReq {
  titulo?: string
  /** predefinições oferecidas primeiro (ex.: filtro do campo Relação) */
  sugeridas?: string[]
  pastaId?: string
  onCriado?: (noteId: string) => void
  /** não navegar para o note depois de criar */
  ficar?: boolean
}

interface UI {
  wsId: string | null
  setWs: (id: string | null) => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  fecharToast: (id: number) => void
  buscaAberta: boolean
  setBusca: (v: boolean) => void
  criar: CriarNoteReq | null
  abrirCriar: (r?: CriarNoteReq) => void
  fecharCriar: () => void
  /** note aberto no painel lateral (quadro e timeline) */
  painelNote: string | null
  setPainelNote: (id: string | null) => void
  /** personagem destacado na timeline */
  destaque: string | null
  setDestaque: (id: string | null) => void
  atalhosAberto: boolean
  setAtalhos: (v: boolean) => void
}

let seq = 0
export const useUI = create<UI>((set, get) => ({
  wsId: (() => { try { return localStorage.getItem('forgenote:ws') } catch { return null } })(),
  setWs: (id) => { try { id ? localStorage.setItem('forgenote:ws', id) : localStorage.removeItem('forgenote:ws') } catch { /* sem storage */ } set({ wsId: id }) },
  toasts: [],
  toast: (t) => {
    const id = ++seq
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] })
    // com Desfazer: 8s para dar tempo de reagir
    setTimeout(() => get().fecharToast(id), t.erro ? 9000 : t.acao ? 8000 : 5000)
  },
  fecharToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  buscaAberta: false,
  setBusca: (v) => set({ buscaAberta: v }),
  criar: null,
  abrirCriar: (r = {}) => set({ criar: r }),
  fecharCriar: () => set({ criar: null }),
  painelNote: null,
  setPainelNote: (id) => set({ painelNote: id }),
  destaque: null,
  setDestaque: (id) => set({ destaque: id }),
  atalhosAberto: false,
  setAtalhos: (v) => set({ atalhosAberto: v }),
}))

export const toast = (texto: string, acao?: Toast['acao']) => useUI.getState().toast({ texto, acao })
/** Toast "X excluído. Desfazer" (8s). */
export const toastDesfazer = (texto: string, desfazer: () => void) => toast(texto, { rotulo: 'Desfazer', fn: desfazer })
export const toastErro = (texto: string) => useUI.getState().toast({ texto, erro: true })
