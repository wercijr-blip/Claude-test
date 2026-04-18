import { useState } from 'react'
import { CheckCircle, Upload, X } from 'lucide-react'

const TIPOS_EXAME = [
  { value: 'hiv', label: 'HIV' },
  { value: 'hepatite_b', label: 'Hepatite B' },
  { value: 'hepatite_c', label: 'Hepatite C' },
  { value: 'sifilis', label: 'Sífilis' },
  { value: 'creatinina', label: 'Creatinina' },
]

interface UploadedFile {
  tipoExame: string
  nomeArquivo: string
  status: 'uploading' | 'done' | 'error'
}

interface Props {
  pacienteId: number
}

export default function ExameUpload({ pacienteId }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [selectedTipo, setSelectedTipo] = useState('hiv')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const entry: UploadedFile = {
      tipoExame: selectedTipo,
      nomeArquivo: file.name,
      status: 'uploading',
    }

    setFiles((prev) => [...prev, entry])

    const formData = new FormData()
    formData.append('file', file)
    formData.append('pacienteId', String(pacienteId))
    formData.append('tipoExame', selectedTipo)

    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` },
        body: formData,
      })
      if (!resp.ok) throw new Error('Erro no upload')
      setFiles((prev) => prev.map((f) => f.nomeArquivo === file.name ? { ...f, status: 'done' } : f))
    } catch {
      setFiles((prev) => prev.map((f) => f.nomeArquivo === file.name ? { ...f, status: 'error' } : f))
    }

    e.target.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <select
          value={selectedTipo}
          onChange={(e) => setSelectedTipo(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIPOS_EXAME.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <label className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors">
          <Upload className="w-4 h-4" />
          Selecionar arquivo
          <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="sr-only" />
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 text-sm border border-slate-200 rounded-lg px-3 py-2">
              {f.status === 'uploading' && <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
              {f.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
              {f.status === 'error' && <X className="w-4 h-4 text-red-500" />}
              <span className="flex-1 text-slate-700 truncate">{f.nomeArquivo}</span>
              <span className="text-slate-400 text-xs">{TIPOS_EXAME.find((t) => t.value === f.tipoExame)?.label}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">Formatos aceitos: PDF, JPG, PNG, WEBP. Tamanho máximo: 10MB por arquivo.</p>
    </div>
  )
}
