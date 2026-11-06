import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTable } from '../lib/data'
import { resetLocal, supabaseConfigured } from '../lib/backend'
import { dica, ehMac, ouvirAtalhos, textoAtalho, useAtalho } from '../lib/shortcuts'
import { usePopover } from '../lib/hooks'
import { useUI } from '../store/ui'
import { IconBusca, IconGaveteiro, IconMais, IconNote, IconQuadro, IconTeclado, IconTimeline } from './Icons'
import { Toasts } from './Toasts'
import { BuscaModal } from './BuscaModal'
import { CriarNoteModal } from './CriarNoteModal'
import { AtalhosModal } from './Atalhos'

const ABAS = [
  { to: '/note', nome: 'Note', Icon: IconNote },
  { to: '/gaveteiro', nome: 'Gaveteiro', Icon: IconGaveteiro },
  { to: '/quadro', nome: 'Quadro', Icon: IconQuadro },
  { to: '/timeline', nome: 'Timeline', Icon: IconTimeline },
]
const DICA_KEY = 'forgenote:dica-atalhos'

export function Shell({ children, email, onSair }: { children: ReactNode; email: string | null; onSair: () => void }) {
  const workspaces = useTable('workspaces')
  const { wsId, setWs, setBusca, abrirCriar, buscaAberta, criar, atalhosAberto, setAtalhos } = useUI()
  const nav = useNavigate()
  const [dicaVista, setDicaVista] = useState(() => { try { return localStorage.getItem(DICA_KEY) === '1' } catch { return true } })

  useEffect(() => ouvirAtalhos(), [])
  useEffect(() => {
    if (!atalhosAberto || dicaVista) return
    setDicaVista(true)
    try { localStorage.setItem(DICA_KEY, '1') } catch { /* sem storage */ }
  }, [atalhosAberto, dicaVista])

  useAtalho('geral.atalhos', () => setAtalhos(true))
  useAtalho('geral.buscar', () => setBusca(true))
  useAtalho('geral.criar', () => abrirCriar())
  useAtalho('geral.ir', (_, combo) => nav(ABAS[Number(combo.slice(-1)) - 1].to))

  return (
    <div className="h-full flex flex-col">
      <header className="elev borda-b h-header shrink-0 flex items-center gap-2 md:gap-4 px-3 md:px-4 relative z-40">
        <span className="font-texto font-semibold text-ui-lg shrink-0">ForgeNote</span>
        <label className="sr-only" htmlFor="ws">Workspace</label>
        <select id="ws" className="btn-fantasma meta shrink-0" style={{ appearance: 'auto', maxWidth: 160 }} value={wsId ?? ''} onChange={(e) => setWs(e.target.value)}>
          {workspaces.map((w) => <option key={w.id} value={w.id} className="bg-mesa-alta">{w.nome}</option>)}
        </select>
        {!supabaseConfigured && <span className="chip meta hidden xl:inline-flex whitespace-nowrap">modo local</span>}
        <span aria-hidden className="hidden md:block self-stretch my-3" style={{ width: 1, background: 'var(--borda)' }} />

        <nav aria-label="Navegação" className="hidden md:flex items-stretch h-full">
          {ABAS.map(({ to, nome }, i) => (
            <NavLink key={to} to={to} title={`${nome} (${ehMac ? '⌥' : 'Alt'}+${i + 1})`}
              className={({ isActive }) => `aba-nav whitespace-nowrap ${isActive ? 'ativa' : ''}`}>{nome}</NavLink>
          ))}
        </nav>

        <div className="flex-1" />
        {!dicaVista && (
          <button className="meta text-ui-sm hidden xl:inline-flex items-center gap-1 whitespace-nowrap" onClick={() => setAtalhos(true)}>
            Pressione <kbd className="tecla" style={{ minWidth: 20, height: 20 }}>?</kbd> para ver os atalhos
          </button>
        )}
        <button className="btn-primario whitespace-nowrap shrink-0" onClick={() => abrirCriar()} title={dica('geral.criar')} aria-label={dica('geral.criar')}>
          <IconMais width={16} height={16} /><span className="hidden sm:inline">Criar note</span>
        </button>
        <button className="btn whitespace-nowrap shrink-0" onClick={() => setBusca(true)} title={dica('geral.buscar', 'Buscar')} aria-label={dica('geral.buscar', 'Buscar')}>
          <IconBusca width={16} height={16} /> <span className="hidden sm:inline">Buscar</span> <span className="meta text-ui-sm hidden xl:inline">{textoAtalho('geral.buscar')}</span>
        </button>
        <button className="btn hidden md:inline-flex whitespace-nowrap shrink-0" onClick={() => setAtalhos(true)} title={dica('geral.atalhos', 'Atalhos')} aria-label={dica('geral.atalhos', 'Atalhos')}>
          <IconTeclado width={18} height={18} /> <span className="hidden lg:inline">Atalhos</span>
        </button>
        <Conta email={email} onSair={onSair} />
      </header>

      <main className="flex-1 min-h-0 overflow-auto">{children}</main>

      {/* mobile: as abas viram uma barra inferior */}
      <nav aria-label="Navegação" className="md:hidden elev borda-t shrink-0 grid grid-cols-4" style={{ height: 56 }}>
        {ABAS.map(({ to, nome, Icon }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-ui-sm ${isActive ? 'text-papel' : 'meta'}`}
            style={({ isActive }) => ({ boxShadow: isActive ? 'inset 0 2px 0 var(--verdete)' : undefined })}>
            <Icon width={20} height={20} /><span>{nome}</span>
          </NavLink>
        ))}
      </nav>

      {buscaAberta && <BuscaModal />}
      {criar && <CriarNoteModal req={criar} />}
      {atalhosAberto && <AtalhosModal />}
      <Toasts />
    </div>
  )
}

function Conta({ email, onSair }: { email: string | null; onSair: () => void }) {
  const pop = usePopover()
  const setAtalhos = useUI((s) => s.setAtalhos)
  const inicial = (email ?? '?').trim().charAt(0).toUpperCase()
  return (
    <div className="relative shrink-0" ref={pop.ref}>
      <button className="rounded-chip inline-flex items-center justify-center font-semibold" aria-label="Conta" aria-haspopup="menu" aria-expanded={pop.aberto}
        style={{ width: 32, height: 32, border: '1.5px solid var(--latao)', color: 'var(--papel)' }} onClick={() => pop.setAberto(!pop.aberto)}>{inicial}</button>
      {pop.aberto && (
        <div role="menu" className="menu mt-2" style={{ right: 0, minWidth: 240 }}>
          <p className="px-2 py-2 meta text-ui-sm" style={{ overflowWrap: 'anywhere' }}>{email ?? 'Sem e-mail'}</p>
          <div className="menu-divisoria" role="separator" />
          <button role="menuitem" className="menu-item md:hidden" onClick={() => { pop.setAberto(false); setAtalhos(true) }}><IconTeclado width={16} height={16} /> Atalhos</button>
          {!supabaseConfigured && (
            <button role="menuitem" className="menu-item" onClick={() => { if (confirm('Apagar os dados deste navegador e voltar aos dados de exemplo?')) { resetLocal(); location.reload() } }}>
              Restaurar dados de exemplo
            </button>
          )}
          <button role="menuitem" className="menu-item" onClick={onSair}>Sair</button>
        </div>
      )}
    </div>
  )
}
