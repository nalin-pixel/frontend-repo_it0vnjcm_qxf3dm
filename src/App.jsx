import { useEffect, useRef, useState } from 'react'
import Hero from './components/Hero'
import ScrollSections from './components/ScrollSections'
import ControlsPanel from './components/ControlsPanel'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function useAudioAnalyzer() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const analyserRef = useRef(null)
  const waveformRef = useRef(null)
  const freqDataRef = useRef(null)
  const ctxRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false }, video: false })
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        const bufferLength = analyser.frequencyBinCount
        const waveform = new Uint8Array(analyser.fftSize)
        const freq = new Uint8Array(bufferLength)

        source.connect(analyser)

        analyserRef.current = analyser
        waveformRef.current = waveform
        freqDataRef.current = freq
        ctxRef.current = audioCtx
        setReady(true)
      } catch (e) {
        setError(e.message)
      }
    }
    init()

    return () => {
      try { ctxRef.current?.close() } catch {}
    }
  }, [])

  const sample = () => {
    if (!analyserRef.current) return { freqs: [], waveform: [], amplitude: 0 }
    const analyser = analyserRef.current
    const freq = freqDataRef.current
    const wave = waveformRef.current
    analyser.getByteFrequencyData(freq)
    analyser.getByteTimeDomainData(wave)
    let sum = 0
    for (let i = 0; i < wave.length; i++) {
      const v = (wave[i] - 128) / 128
      sum += v * v
    }
    const amplitude = Math.sqrt(sum / wave.length)
    return { freqs: Array.from(freq), waveform: Array.from(wave), amplitude }
  }

  return { ready, error, sample }
}

function App() {
  const analyzer = useAudioAnalyzer()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-black to-black text-white">
      <Hero />
      {analyzer.ready ? (
        <ScrollSections analyzer={analyzer} />
      ) : (
        <div className="h-[60vh] flex items-center justify-center text-blue-200">
          {analyzer.error ? `Micro non autorisé: ${analyzer.error}` : 'Initialisation audio… Autorisez l’accès au micro.'}
        </div>
      )}
      <ControlsPanel onUploaded={() => { /* ScrollSections auto-fetches media list */ }} />
      <section className="py-16 text-center text-blue-300/70 text-sm">© {new Date().getFullYear()} PulseAnime – Expérience WOW synchronisée audio+scroll.</section>
    </div>
  )
}

export default App
