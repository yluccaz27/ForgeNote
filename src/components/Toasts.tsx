import { useUI } from '../store/ui'
import { IconErro, IconFechar } from './Icons'

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const fechar = useUI((s) => s.fecharToast)
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite" style={{ maxWidth: 'min(420px, calc(100vw - 32px))', marginBottom: 'var(--toast-sobe, 0px)' }}>
      {toasts.map((t) => (
        <div key={t.id} className="elev rounded-painel borda px-4 py-3 flex items-start gap-3 shadow-levantado"
          style={t.erro ? { borderColor: 'var(--liquen)' } : undefined}>
          {/* erro não é exclusão: ícone e texto carregam o sentido, sem a cor perigo */}
          {t.erro && <IconErro className="shrink-0" style={{ marginTop: 1 }} />}
          <p className="flex-1">{t.texto}</p>
          {t.acao && (
            <button className="btn-fantasma font-semibold" style={{ color: 'var(--verdete)' }} onClick={() => { t.acao!.fn(); fechar(t.id) }}>{t.acao.rotulo}</button>
          )}
          <button className="btn-icone shrink-0" aria-label="Fechar aviso" onClick={() => fechar(t.id)}><IconFechar width={16} height={16} /></button>
        </div>
      ))}
    </div>
  )
}
