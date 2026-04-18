import { useRef, useEffect } from 'react'
import SignaturePadLib from 'signature_pad'

interface Props {
  onChange: (dataUrl: string | null) => void
  width?: number
  height?: number
}

export default function SignaturePad({ onChange, width = 500, height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: '#1e3a5f',
    })

    padRef.current = pad

    pad.addEventListener('endStroke', () => {
      onChange(pad.isEmpty() ? null : pad.toDataURL())
    })

    return () => pad.off()
  }, [onChange])

  const limpar = () => {
    padRef.current?.clear()
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full touch-none"
          style={{ maxHeight: height }}
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={limpar}
          className="text-sm text-slate-500 hover:text-red-500 transition-colors"
        >
          Limpar assinatura
        </button>
      </div>
    </div>
  )
}
