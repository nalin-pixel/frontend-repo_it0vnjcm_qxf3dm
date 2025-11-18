import { useState } from 'react'

export default function ControlsPanel({ onUploaded }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      files.forEach((f) => form.append('files', f))
      const res = await fetch(`${BACKEND_URL}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      const json = await res.json()
      onUploaded?.(json.uploaded)
      // Broadcast event so scenes can react immediately
      window.dispatchEvent(new CustomEvent('mediaUploaded', { detail: json.uploaded }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="fixed right-4 top-4 z-50 backdrop-blur bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3">
      <label className="text-xs text-blue-200/90">
        <span className="block mb-1">Ajouter des médias</span>
        <input type="file" accept="image/*,video/*" multiple onChange={handleChange} className="text-blue-100" />
      </label>
      {busy && <span className="text-xs text-blue-300">Upload…</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
