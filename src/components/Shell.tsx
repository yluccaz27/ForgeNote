import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useTable } from '../lib/data'
import { resetLocal, supabaseConfigured } from '../lib/backend'
import { useUI } from '../store/ui'
import { IconBusca, IconGaveteiro, IconNote, IconQuadro, IconTimeline, IconUsuario } from './Icons'
import { Toasts } from './Toasts'
import { BuscaModal } from './BuscaModal'
import { CriarNoteModal } from './CriarNoteModal'
import { Modal } from './Modal'

const ABAS = [
  { to: '/note', nome: 'Note', Icon: IconNote },
  { to: '/gaveteiro', nome: 'Gaveteiro', Icon: IconGaveteiro },
  { to: '/quadro', nome: 'Quadro', Icon: IconQuadro },
  { to: '/timeline', nome: 'Timeline', Icon: IconTimeline },
]

export const digitando = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

export function Shell({ children, email, onSair }: { children: ReactNode; email: string | null; onSair: () => void }) {
  const workspaces = useTable('workspaces')
  const { wsId, setWs, setBusca, abrirCriar, buscaAberta, criar } = useUI()
  const [conta, setConta] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBusca(true); return }
      if (digitando(e) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') {
        if (document.querySelector('[role="dialog"]')) return
        e.preventDefault(); abrirCriar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setBusca, abrirCriar])

  return (
    <div className="h-full flex">
      <nav aria-label="Abas" className="elev borda-r w-rail shrink-0 flex flex-col items-center py-3 gap-1">
        {ABAS.map(({ to, nome, Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `w-full flex flex-col items-center gap-1 py-2 text-ui-sm ${isActive ? 'text-osso item-ativo' : 'meta'}`}>
            {({ isActive }) => (<><Icon className={isActive ? 'text-lacre' : undefined} /><span>{nome}</span></>)}
          </NavLink>
        ))}
        <div className="flex-1" />
        <button className="btn-icone meta" style={{ width: 44, minHeight: 44 }} aria-label="Conta" onClick={() => setConta(true)}><IconUsuario /></button>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="borda-b flex items-center gap-4 px-4" style={{ minHeight: 48 }}>
          <label className="sr-only" htmlFor="ws">Workspace</label>
          <select id="ws" className="btn-fantasma font-semibold text-ui-lg" value={wsId ?? ''} onChange={(e) => setWs(e.target.value)}
            style={{ appearance: 'auto' }}>
            {workspaces.map((w) => <option key={w.id} value={w.id} className="bg-ardosia-alta">{w.nome}</option>)}
          </select>
          {!supabaseConfigured && <span className="chip meta hidden sm:inline-flex">modo local</span>}
          <div className="flex-1" />
          <button className="btn meta" onClick={() => setBusca(true)} aria-label="Buscar (Ctrl+K)">
            <IconBusca width={16} height={16} /> <span className="hidden sm:inline">Buscar</span> <span className="text-ui-sm hidden md:inline">Ctrl+K</span>
          </button>
          <button className="btn-primario" onClick={() => abrirCriar()} title="Atalho: N"><span>Novo</span><span className="hidden sm:inline" style={{ marginLeft: '-4px' }}>&nbsp;note</span></button>
        </header>
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      </div>

      {buscaAberta && <BuscaModal />}
      {criar && <CriarNoteModal req={criar} />}
      {conta && (
        <Modal titulo="Conta" onFechar={() => setConta(false)} largura={360}>
          <p className="mb-4">{email ?? 'Sem e-mail'}</p>
          <div className="flex flex-col gap-2">
            {!supabaseConfigured && (
              <button className="btn" onClick={() => { if (confirm('Apagar os dados deste navegador e voltar aos dados de exemplo?')) { resetLocal(); location.reload() } }}>
                Restaurar dados de exemplo
              </button>
            )}
            <button className="btn" onClick={onSair}>Sair</button>
          </div>
        </Modal>
      )}
      <Toasts />
    </div>
  )
}
