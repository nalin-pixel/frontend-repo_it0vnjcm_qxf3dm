import Spline from '@splinetool/react-spline'

export default function Hero() {
  return (
    <section className="relative h-[120vh] sm:h-[140vh] overflow-hidden">
      <Spline scene="https://prod.spline.design/EF7JOSsHLk16Tlw9/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/50 to-black" />
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center px-6">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-sky-300 to-cyan-300 drop-shadow-lg">
          PulseAnime
        </h1>
        <p className="mt-4 text-blue-200/90 max-w-2xl mx-auto">
          Une expérience audio‑visuelle immersive qui réagit à votre musique, à votre scroll et à vos médias.
        </p>
      </div>
    </section>
  )
}
