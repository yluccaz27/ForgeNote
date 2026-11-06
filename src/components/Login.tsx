import { useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/backend'

export function Login({ onEntrou, onLocal, erro: erroInicial }: {
  onEntrou: (userId: string, email: string | null) => void
  onLocal: () => void
  erro: string | null
}) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(erroInicial)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setEnviando(true); setErro(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setEnviando(false)
    if (error) {
      setErro(error.message === 'Invalid login credentials'
        ? 'E-mail ou senha não conferem. Confira os dois e tente de novo.'
        : `Não foi possível entrar: ${error.message}`)
      return
    }
    onEntrou(data.user.id, data.user.email ?? null)
  }

  return (
    <main className="h-full flex items-center justify-center p-4">
      <div className="w-full" style={{ maxWidth: 360 }}>
        <svg width="40" height="40" viewBox="0 0 32 32" aria-hidden className="mb-6">
          <rect x="7" y="6" width="18" height="20" rx="1" fill="var(--osso)" />
          <path d="M2 23 C 11 16, 20 27, 30 13" stroke="var(--lacre)" strokeWidth="2.2" fill="none" />
        </svg>
        <h1 className="font-texto text-titulo-note mb-2">ForgeNote</h1>
        <p className="meta mb-8">A mesa onde o mundo fica guardado.</p>

        {supabaseConfigured ? (
          <form onSubmit={entrar} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span>E-mail</span>
              <input className="campo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>Senha</span>
              <input className="campo" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </label>
            {erro && <p role="alert" className="text-ui" style={{ color: 'var(--osso)' }}><span className="text-lacre">●</span> {erro}</p>}
            <button className="btn-primario justify-center" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
            <p className="meta text-ui-sm">O cadastro é fechado. Peça um convite para quem administra o workspace.</p>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p>O Supabase ainda não foi configurado neste build. Você pode testar tudo no modo local: os dados ficam só neste navegador.</p>
            {erro && <p role="alert"><span className="text-lacre">●</span> {erro}</p>}
            <button className="btn-primario justify-center" onClick={onLocal}>Entrar no modo local</button>
            <p className="meta text-ui-sm">Para usar com login de verdade, defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. O README explica.</p>
          </div>
        )}
      </div>
    </main>
  )
}
