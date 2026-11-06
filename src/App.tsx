import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { localBackend, setCurrentUser, supabase, supabaseBackend, supabaseConfigured } from './lib/backend'
import { cache, ensure, invalidarTabela, setBackend } from './lib/data'
import { TABLES } from './lib/types'
import { useUI } from './store/ui'
import { Login } from './components/Login'
import { Shell } from './components/Shell'
import { NotesList } from './features/note/NotesList'
import { NotePage } from './features/note/NotePage'
import { GaveteiroGrid } from './features/gaveteiro/GaveteiroGrid'
import { GaveteiroView } from './features/gaveteiro/GaveteiroView'
import { QuadroList } from './features/quadro/QuadroList'
import { QuadroView } from './features/quadro/QuadroView'
import { TimelineList } from './features/timeline/TimelineList'
import { TimelineView } from './features/timeline/TimelineView'

type Estado = 'carregando' | 'login' | 'sem-workspace' | 'pronto'

async function carregarTudo() {
  await Promise.all(TABLES.map((t) => ensure(t)))
  const wss = cache('workspaces')
  const ui = useUI.getState()
  if (!wss.length) return false
  if (!ui.wsId || !wss.some((w) => w.id === ui.wsId)) ui.setWs(wss[0].id)
  return true
}

export function App() {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [email, setEmail] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function entrarComBackend() {
    try {
      setEstado('carregando')
      setEstado((await carregarTudo()) ? 'pronto' : 'sem-workspace')
    } catch (e) {
      setErro(`Não foi possível carregar os dados: ${(e as Error).message}`)
      setEstado('login')
    }
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      let local = false
      try { local = localStorage.getItem('forgenote:modo') === 'local' } catch { /* sem storage */ }
      if (local) { setBackend(localBackend()); setEmail('modo local'); entrarComBackend() }
      else setEstado('login')
      return
    }
    const sb = supabase!
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        setCurrentUser(data.session.user.id); setEmail(data.session.user.email ?? null)
        setBackend(supabaseBackend(sb)); entrarComBackend()
      } else setEstado('login')
    })
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'SIGNED_OUT') { setBackend(null); setCurrentUser(null); setEstado('login') }
      if (ev === 'SIGNED_IN' && session) { setCurrentUser(session.user.id); setEmail(session.user.email ?? null) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Realtime: quando o outro edita, recarrega a tabela afetada
  useEffect(() => {
    if (estado !== 'pronto' || !supabase) return
    const timers = new Map<string, number>()
    const ch = supabase.channel('forgenote')
      .on('postgres_changes', { event: '*', schema: 'public' }, (p) => {
        const t = p.table
        clearTimeout(timers.get(t))
        timers.set(t, window.setTimeout(() => invalidarTabela(t), 900))
      })
      .subscribe()
    return () => { supabase!.removeChannel(ch) }
  }, [estado])

  if (estado === 'carregando') {
    return <div className="h-full flex items-center justify-center meta" role="status">Abrindo a mesa…</div>
  }
  if (estado === 'login') {
    return (
      <Login erro={erro}
        onLocal={() => { try { localStorage.setItem('forgenote:modo', 'local') } catch { /* ok */ } setBackend(localBackend()); setEmail('modo local'); entrarComBackend() }}
        onEntrou={(id, mail) => { setCurrentUser(id); setEmail(mail); setBackend(supabaseBackend(supabase!)); entrarComBackend() }} />
    )
  }
  if (estado === 'sem-workspace') {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="elev rounded-painel borda p-6" style={{ maxWidth: 480 }}>
          <h1 className="text-ui-lg font-semibold mb-2">Sua conta ainda não está em nenhum workspace</h1>
          <p className="meta mb-4">Peça para quem administra o ForgeNote adicionar seu usuário em workspace_members no Supabase. O passo a passo está no README.</p>
          <button className="btn" onClick={() => supabase?.auth.signOut()}>Sair</button>
        </div>
      </div>
    )
  }

  return (
    <Shell email={email} onSair={() => {
      if (supabase) supabase.auth.signOut()
      else { try { localStorage.removeItem('forgenote:modo') } catch { /* ok */ } setBackend(null); setEstado('login') }
    }}>
      <Routes>
        <Route path="/" element={<Navigate to="/gaveteiro" replace />} />
        <Route path="/note" element={<NotesList />} />
        <Route path="/note/:id" element={<NotePage />} />
        <Route path="/gaveteiro" element={<GaveteiroGrid />} />
        <Route path="/gaveteiro/:id" element={<GaveteiroView />} />
        <Route path="/quadro" element={<QuadroList />} />
        <Route path="/quadro/:id" element={<QuadroView />} />
        <Route path="/timeline" element={<TimelineList />} />
        <Route path="/timeline/:id" element={<TimelineView />} />
        <Route path="*" element={<Navigate to="/gaveteiro" replace />} />
      </Routes>
    </Shell>
  )
}
