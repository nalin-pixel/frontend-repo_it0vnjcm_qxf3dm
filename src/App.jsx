import { useEffect, useRef, useState } from 'react'
import Spline from '@splinetool/react-spline'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function useAudioAnalyzer() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const waveformRef = useRef(null)
  const freqDataRef = useRef(null)
  const sourceRef = useRef(null)
  const ctxRef = useRef(null)
  const [devices, setDevices] = useState({ audioIn: [], midi: [] })

  useEffect(() => {
    const init = async () => {
      try {
        // Enumerate devices (including potential USB audio)
        const devs = await navigator.mediaDevices.enumerateDevices()
        setDevices({
          audioIn: devs.filter((d) => d.kind === 'audioinput'),
          midi: [] // will be populated if Web MIDI is available
        })

        if ('requestMIDIAccess' in navigator) {
          try {
            const midi = await navigator.requestMIDIAccess()
            const inputs = []
            midi.inputs.forEach((input) => inputs.push({ id: input.id, name: input.name }))
            setDevices((prev) => ({ ...prev, midi: inputs }))
          } catch (e) {
            // ignore midi errors
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false }, video: false })
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        const waveform = new Uint8Array(analyser.fftSize)

        source.connect(analyser)

        analyserRef.current = analyser
        dataArrayRef.current = dataArray
        waveformRef.current = waveform
        sourceRef.current = source
        ctxRef.current = audioCtx
        freqDataRef.current = new Uint8Array(bufferLength)
        setReady(true)
      } catch (e) {
        setError(e.message)
      }
    }
    init()

    return () => {
      try {
        ctxRef.current?.close()
      } catch {}
    }
  }, [])

  const sample = () => {
    if (!analyserRef.current) return { freqs: [], waveform: [], amplitude: 0 }
    const analyser = analyserRef.current
    const freq = freqDataRef.current
    const wave = waveformRef.current
    analyser.getByteFrequencyData(freq)
    analyser.getByteTimeDomainData(wave)
    // RMS amplitude estimate
    let sum = 0
    for (let i = 0; i < wave.length; i++) {
      const v = (wave[i] - 128) / 128
      sum += v * v
    }
    const amplitude = Math.sqrt(sum / wave.length)
    return { freqs: Array.from(freq), waveform: Array.from(wave), amplitude }
  }

  return { ready, error, devices, sample }
}

function Visualizer({ analyzer }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    let raf
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const render = () => {
      const { freqs, amplitude } = analyzer.sample()
      const w = canvas.width = canvas.clientWidth
      const h = canvas.height = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)

      // Background
      const grd = ctx.createLinearGradient(0, 0, w, h)
      grd.addColorStop(0, '#0f172a')
      grd.addColorStop(1, '#111827')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)

      // Bars
      const barWidth = Math.max(2, w / 128)
      const maxBars = Math.min(128, freqs.length)
      for (let i = 0; i < maxBars; i++) {
        const val = freqs[i] / 255
        const barHeight = val * (h * 0.6) + amplitude * 80
        const x = i * barWidth
        const hue = 260 + (i / maxBars) * 80
        ctx.fillStyle = `hsl(${hue}, 80%, ${40 + val * 40}%)`
        ctx.fillRect(x, h - barHeight - 20, barWidth - 2, barHeight)
      }

      // Center pulse
      const r = Math.min(w, h) * (0.1 + amplitude * 0.4)
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(168,85,247,0.8)'
      ctx.lineWidth = 4
      ctx.shadowBlur = 30
      ctx.shadowColor = '#8b5cf6'
      ctx.stroke()
      ctx.shadowBlur = 0

      raf = requestAnimationFrame(render)
    }

    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [analyzer])

  return <canvas ref={canvasRef} className="w-full h-full rounded-xl" />
}

function Uploader({ onUploaded }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="block">
        <span className="text-sm text-blue-200">Images/Vidéos</span>
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleChange}
          className="mt-1 block w-full text-sm text-blue-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-700 cursor-pointer"
        />
      </label>
      {busy && <p className="text-blue-300 text-sm">Upload en cours…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}

function MediaTray({ items }) {
  if (!items?.length) return (
    <div className="text-blue-300/70 text-sm">Aucun média pour l'instant. Uploadez des images/vidéos pour enrichir l'animation.</div>
  )
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((m, idx) => (
        <div key={idx} className="bg-white/5 rounded-lg overflow-hidden border border-white/10">
          {m.content_type?.startsWith('image') || m.type === 'image' ? (
            <img src={`${BACKEND_URL}${m.url}`} alt={m.filename} className="w-full h-28 object-cover" />
          ) : (
            <video src={`${BACKEND_URL}${m.url}`} className="w-full h-28 object-cover" muted loop autoPlay />
          )}
          <div className="px-2 py-1 text-[10px] text-blue-200 truncate">{m.filename}</div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const analyzer = useAudioAnalyzer()
  const [media, setMedia] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/media`)
        if (res.ok) {
          const json = await res.json()
          setMedia(json.media)
        }
      } catch (e) {}
    }
    load()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white">
      <header className="relative h-[60vh] sm:h-[70vh] flex items-center justify-center">
        <Spline scene="https://prod.spline.design/EF7JOSsHLk16Tlw9/scene.splinecode" style={{ width: '100%', height: '100%' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80 pointer-events-none" />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center px-6">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">PulseAnime</h1>
          <p className="mt-3 text-blue-200 max-w-xl">Visualisations audio en temps réel avec import d’images/vidéos. Pensé pour musiciens et créateurs.</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <section className="grid md:grid-cols-2 gap-6 items-stretch">
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 h-[360px]">
            {analyzer.ready ? (
              <Visualizer analyzer={analyzer} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-blue-200">
                {analyzer.error ? `Micro non autorisé: ${analyzer.error}` : 'Initialisation audio… Autorisez l’accès au micro.'}
              </div>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Importer des médias</h2>
            <Uploader onUploaded={(items) => setMedia((prev) => [...items, ...prev])} />
            <div className="h-px bg-white/10" />
            <div className="max-h-72 overflow-auto pr-1">
              <MediaTray items={media} />
            </div>
            <p className="text-xs text-blue-300/70">Compatible ordinateurs, tablettes, smartphones. Support des périphériques USB audio/MIDI (si supportés par le navigateur).</p>
          </div>
        </section>
      </main>

      <footer className="py-8 text-center text-blue-300/60 text-sm">© {new Date().getFullYear()} PulseAnime – Créé pour l’expression visuelle et sonore.</footer>
    </div>
  )
}

export default App
