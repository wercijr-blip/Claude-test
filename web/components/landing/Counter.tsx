'use client'

import { useEffect, useRef, useState } from 'react'

const pacientes = 2000

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function Counter() {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true) },
      { threshold: 0.5 },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    const duration = 2200
    const startTime = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      setCount(Math.round(easeOut(progress) * pacientes))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [started])

  const formatted = count.toLocaleString('pt-BR')

  return (
    <section ref={ref} className="bg-fp-lavender-50 border-y border-fp-lavender-100 py-16 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          <div className="text-center">
            <p className="font-display text-6xl sm:text-7xl text-fp-accent font-semibold leading-none">
              +{formatted}
            </p>
            <p className="text-fp-dark text-lg font-medium mt-2">pacientes já protegidos</p>
          </div>

          <div className="hidden sm:block w-px h-16 bg-fp-lavender-100" />

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-center sm:text-left">
            {[
              { value: '99%', label: 'eficácia comprovada da PrEP' },
              { value: '<24h', label: 'para emitir sua receita' },
              { value: '100%', label: 'online, sem deslocamento' },
            ].map((s) => (
              <div key={s.value}>
                <p className="font-display text-3xl text-fp-accent font-semibold">{s.value}</p>
                <p className="text-fp-dark-soft text-xs mt-0.5 leading-tight max-w-[120px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
