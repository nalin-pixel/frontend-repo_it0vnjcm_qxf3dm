import { useEffect, useState } from 'react'

const chapters = [
  { title: 'Préambule — le souffle', subtitle: "Le silence respire, la lumière naît." },
  { title: 'Tunnel — les particules s’éveillent', subtitle: "La pulsation dessine la voie." },
  { title: 'Vortex — spirale de résonances', subtitle: "L’image devient vibration." },
  { title: 'Paysages abstraits — horizons intérieurs', subtitle: "Le son sculpte l’espace." },
]

export default function ChaptersOverlay() {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const onChapter = (e) => {
      setActive(e.detail.index)
      setVisible(true)
      clearTimeout(window.__chapHide)
      window.__chapHide = setTimeout(() => setVisible(false), 1800)
    }
    window.addEventListener('chapter', onChapter)
    return () => window.removeEventListener('chapter', onChapter)
  }, [])

  const ch = chapters[active] || chapters[0]

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-40 flex justify-center">
      <div className={`transition-all duration-600 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-center shadow-lg">
          <div className="text-xs tracking-widest uppercase text-blue-200/70">{ch.title}</div>
          <div className="text-sm text-blue-100/90 mt-1">{ch.subtitle}</div>
        </div>
      </div>
    </div>
  )
}
