import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Utility: create VideoTexture or Image Texture from URL
async function createTextureFromMedia(item, baseUrl) {
  const url = `${baseUrl}${item.url}`
  if ((item.content_type || item.type || '').startsWith('video')) {
    const video = document.createElement('video')
    video.src = url
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    await video.play().catch(() => {})
    const tex = new THREE.VideoTexture(video)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.format = THREE.RGBAFormat
    return { texture: tex, element: video, kind: 'video' }
  } else {
    const loader = new THREE.TextureLoader()
    const texture = await new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })
    texture.encoding = THREE.sRGBEncoding
    return { texture, element: null, kind: 'image' }
  }
}

export default function ImmersiveScene({ analyzer, media = [], backendUrl }) {
  const mountRef = useRef(null)
  const threeRef = useRef({})
  const mediaGroupRef = useRef(new THREE.Group())

  useEffect(() => {
    const container = mountRef.current
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x070816, 0.06)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 200)
    camera.position.set(0, 0, 6)

    // Lights
    const hemi = new THREE.HemisphereLight(0x7c3aed, 0x0ea5e9, 0.6)
    scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 1.2)
    dir.position.set(5, 5, 5)
    scene.add(dir)

    // Particles tunnel
    const tunnelCount = 2000
    const tunnelGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(tunnelCount * 3)
    const colors = new Float32Array(tunnelCount * 3)
    for (let i = 0; i < tunnelCount; i++) {
      const t = Math.random() * 80
      const r = 1.5 + Math.random() * 1.5
      const angle = Math.random() * Math.PI * 2
      positions[i * 3 + 0] = Math.cos(angle) * r
      positions[i * 3 + 1] = Math.sin(angle) * r
      positions[i * 3 + 2] = -t
      const c = new THREE.Color().setHSL(0.66 + (i / tunnelCount) * 0.2, 0.8, 0.5)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    tunnelGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    tunnelGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const tunnelMat = new THREE.PointsMaterial({ size: 0.03, vertexColors: true, depthWrite: false, transparent: true, opacity: 0.9 })
    const tunnel = new THREE.Points(tunnelGeo, tunnelMat)
    scene.add(tunnel)

    // Vortex of planes (media mapped)
    const mediaGroup = mediaGroupRef.current
    scene.add(mediaGroup)

    // Reactive neon grid floor
    const grid = new THREE.GridHelper(40, 40, 0x22d3ee, 0x7c3aed)
    grid.position.y = -2.5
    scene.add(grid)

    // Load media as textures and place them
    let disposed = false
    const texPromises = (media || []).slice(0, 12).map(async (item, idx) => {
      try {
        const res = await createTextureFromMedia(item, backendUrl)
        if (disposed) return
        const aspect = res.kind === 'video' ? (res.element.videoWidth || 16) / Math.max(res.element.videoHeight || 9, 1) : (res.texture.image?.width || 16) / Math.max(res.texture.image?.height || 9, 1)
        const h = 1.2
        const w = Math.max(1.2, h * aspect)
        const geo = new THREE.PlaneGeometry(w, h, 1, 1)
        const mat = new THREE.MeshStandardMaterial({ map: res.texture, emissive: new THREE.Color(0x3b82f6), emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide })
        const mesh = new THREE.Mesh(geo, mat)
        const radius = 3 + (idx % 6) * 0.35
        const angle = (idx / 12) * Math.PI * 2
        mesh.position.set(Math.cos(angle) * radius, -0.2 + (idx % 5) * 0.15, -2 - idx * 0.8)
        mesh.rotation.y = angle + Math.PI
        mediaGroup.add(mesh)
      } catch (e) {
        // ignore failed media
      }
    })

    // Reactive uniforms/state
    const state = { tunnelSpeed: 0.5, tunnelRadius: 2.1, vortexSpin: 0.2, parallax: 0.6 }

    // Scroll-driven timeline
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
    tl.to(state, { tunnelSpeed: 2.0, duration: 1.2 })
      .to(state, { tunnelRadius: 3.2, duration: 1.2 }, '<')
      .to(camera.position, { z: 1.8, duration: 1.2 }, '<')
      .to(state, { vortexSpin: 1.1, duration: 1.2 })
      .to(camera.position, { z: -6, duration: 2.0 })
      .to(state, { tunnelSpeed: 0.8, duration: 1.0 })

    ScrollTrigger.create({
      animation: tl,
      trigger: container,
      start: 'top top',
      end: '+=3000',
      scrub: 1,
      pin: true,
    })

    // Mouse parallax
    const mouse = new THREE.Vector2()
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
    }
    window.addEventListener('mousemove', onMouseMove)

    // Animation loop
    let raf
    const clock = new THREE.Clock()

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const dt = clock.getDelta()
      const t = clock.elapsedTime

      // Audio drive
      const sample = analyzer?.sample ? analyzer.sample() : { amplitude: 0, freqs: [] }
      const amp = sample.amplitude || 0

      // Parallax
      camera.position.x += (mouse.x * state.parallax - camera.position.x) * 0.05
      camera.position.y += (mouse.y * state.parallax - camera.position.y) * 0.05
      camera.lookAt(0, 0, -2)

      // Tunnel movement
      const pos = tunnel.geometry.attributes.position
      for (let i = 0; i < pos.count; i++) {
        let z = pos.getZ(i)
        z += (state.tunnelSpeed + amp * 6) * dt
        if (z > 2) z = -80
        const x = pos.getX(i)
        const y = pos.getY(i)
        const r = state.tunnelRadius + Math.sin(t * 0.6 + i) * 0.15 + amp * 0.6
        const ang = Math.atan2(y, x) + dt * (0.3 + amp)
        pos.setX(i, Math.cos(ang) * r)
        pos.setY(i, Math.sin(ang) * r)
        pos.setZ(i, z)
      }
      pos.needsUpdate = true

      // Vortex rotation
      mediaGroup.rotation.z += (0.05 + amp * 0.5) * dt * state.vortexSpin
      mediaGroup.children.forEach((m, idx) => {
        m.position.z += Math.sin(t * 0.6 + idx) * 0.001
        m.rotation.y += 0.15 * dt
        m.material.emissiveIntensity = 0.25 + amp * 0.75
      })

      renderer.render(scene, camera)
    }

    animate()

    const onResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight)
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    threeRef.current = { renderer, scene, camera, tl }

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      ScrollTrigger.getAll().forEach((st) => st.kill())
      cancelAnimationFrame(raf)
      renderer.dispose()
      container.removeChild(renderer.domElement)
      // Dispose geometries/materials
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.()
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.())
          else obj.material.dispose?.()
        }
      })
    }
  }, [])

  // Reload media textures when media changes
  useEffect(() => {
    const mediaGroup = mediaGroupRef.current
    // remove previous meshes
    for (let i = mediaGroup.children.length - 1; i >= 0; i--) {
      const c = mediaGroup.children[i]
      mediaGroup.remove(c)
      if (c.material?.map?.dispose) c.material.map.dispose()
      c.material?.dispose?.()
      c.geometry?.dispose?.()
    }

    let canceled = false
    const run = async () => {
      const items = (media || []).slice(0, 12)
      for (let idx = 0; idx < items.length; idx++) {
        if (canceled) return
        try {
          const item = items[idx]
          const res = await createTextureFromMedia(item, backendUrl)
          if (canceled) return
          const aspect = res.kind === 'video' ? (res.element.videoWidth || 16) / Math.max(res.element.videoHeight || 9, 1) : (res.texture.image?.width || 16) / Math.max(res.texture.image?.height || 9, 1)
          const h = 1.2
          const w = Math.max(1.2, h * aspect)
          const geo = new THREE.PlaneGeometry(w, h, 1, 1)
          const mat = new THREE.MeshStandardMaterial({ map: res.texture, emissive: new THREE.Color(0x3b82f6), emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide, transparent: true })
          const mesh = new THREE.Mesh(geo, mat)
          const radius = 3 + (idx % 6) * 0.35
          const angle = (idx / items.length) * Math.PI * 2
          mesh.position.set(Math.cos(angle) * radius, -0.2 + (idx % 5) * 0.15, -2 - idx * 0.8)
          mesh.rotation.y = angle + Math.PI
          mediaGroup.add(mesh)
        } catch (e) {}
      }
    }
    run()
    return () => { canceled = true }
  }, [media, backendUrl])

  return (
    <div ref={mountRef} className="w-full h-[100vh] sticky top-0 will-change-transform" />
  )
}
