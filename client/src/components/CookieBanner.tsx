import { useEffect, useState } from 'react'

export function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) {
      setShow(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      aria-modal="false"
      className="fixed bottom-0 inset-x-0 bg-slate-900 text-white p-4 z-50 shadow-lg"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-sm flex-1">
          Usamos cookies para análise de uso anônima. Consulte nossa{' '}
          <a href="/privacidade" className="underline hover:no-underline">
            Política de Privacidade
          </a>
          .
        </p>
        <button
          onClick={accept}
          className="shrink-0 bg-white text-slate-900 px-4 py-1.5 rounded text-sm font-medium hover:bg-slate-100 transition-colors"
        >
          Entendi e aceito
        </button>
      </div>
    </div>
  )
}
