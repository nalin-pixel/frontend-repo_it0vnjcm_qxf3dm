import { useEffect, useState } from 'react'
import ImmersiveScene from './ImmersiveScene'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export default function ScrollSections({ analyzer }) {
  const [media, setMedia] = useState([])

  const load = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/media`)
      if (res.ok) {
        const json = await res.json()
        setMedia(json.media)
      }
    } catch (e) {}
  }

  useEffect(() => {
    load()
    const onUploaded = (e) => {
      // merge new uploads at the front
      setMedia((prev) => [...e.detail, ...prev])
    }
    window.addEventListener('mediaUploaded', onUploaded)
    return () => window.removeEventListener('mediaUploaded', onUploaded)
  }, [])

  return (
    <div className="relative">
      <ImmersiveScene analyzer={analyzer} media={media} backendUrl={BACKEND_URL} />
      <div className="h-[320vh]" />
    </div>
  )
}
