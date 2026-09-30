import { ref } from 'vue'
import { inBrowser } from 'vitepress'
import { useBrowserBest } from './useBrowserBest'

export function useDino(opts: {
  onScore?: (n: number) => void
  onBest?: (n: number) => void
  onState?: (s: 'idle' | 'playing' | 'paused' | 'over') => void
}) {
  const W = 640, H = 180, GROUND = 142
  let ctx: CanvasRenderingContext2D | null = null
  let raf = 0, last = 0

  const state = ref<'idle' | 'playing' | 'paused' | 'over'>('idle')
  const score = ref(0)
  const { best, load: loadBest, save: saveBest } = useBrowserBest('vp-dino-best')

  let dino = { x: 56, y: GROUND, w: 26, h: 28 }
  let vy = 0, onGround = true, duck = false, night = false
  let speed = 5.2, dist = 0
  let obs: any[] = []
  let clouds = [{ x: 380, y: 36 }, { x: 520, y: 24 }]

  function setState(s: any) {
    state.value = s
    opts.onState?.(s)
  }

  function reset() {
    dino = { x: 56, y: GROUND, w: 26, h: 28 }
    vy = 0; onGround = true; duck = false; night = false
    speed = 5.2; dist = 0; obs = []
    clouds = [{ x: 380, y: 36 }, { x: 520, y: 24 }]
    score.value = 0
    setState('idle')
    draw()
  }

  function start() {
    if (state.value === 'playing') return
    if (state.value === 'over') reset()
    setState('playing')
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }

  function jump() {
    start()
    if (onGround) { vy = -10.5; onGround = false }
  }

  function spawn() {
    if (Math.random() < 0.78) {
      const tall = Math.random() < 0.45
      const h = tall ? 38 : 26
      obs.push({ x: W + 20, y: GROUND + 28 - h, w: 16, h, kind: 'cactus' })
    } else {
      obs.push({ x: W + 20, y: GROUND - 34, w: 26, h: 18, kind: 'bird' })
    }
  }

  function hit(a: any, b: any) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  }

  function update(dt: number) {
    const k = Math.min(dt / 16.67, 2)
    dist += speed * k
    score.value = Math.floor(dist / 12)
    if (score.value > best.value) {
      best.value = score.value
      saveBest(best.value) // 客户端安全写入
    }
    opts.onScore?.(score.value)
    opts.onBest?.(best.value)

    night = score.value > 120 && Math.floor(score.value / 120) % 2 === 1
    speed = Math.min(5.2 + score.value / 90, 15)

    vy += 0.62 * k
    dino.y += vy * k
    if (dino.y >= GROUND) { dino.y = GROUND; vy = 0; onGround = true }

    if (Math.random() < 0.018 * k) spawn()
    for (const o of obs) o.x -= speed * k
    obs = obs.filter(o => o.x + o.w > -20)

    const box = {
      x: dino.x + 3,
      y: duck && onGround ? dino.y + 12 : dino.y,
      w: dino.w - 6,
      h: duck && onGround ? dino.h - 12 : dino.h
    }
    for (const o of obs) {
      if (hit(box, o)) {
        setState('over')
        cancelAnimationFrame(raf)
      }
    }

    for (const c of clouds) {
      c.x -= speed * 0.25 * k
      if (c.x < -50) { c.x = W + Math.random() * 120; c.y = 18 + Math.random() * 36 }
    }
  }

  function px(x: number, y: number, w: number, h: number, c: string) {
    if (!ctx) return
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, h)
  }

  function getVar(n: string, f: string) {
    if (!inBrowser) return f
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f
  }

  function draw() {
    if (!ctx) return
    const bg = night ? '#0b1220' : getVar('--vp-c-bg', '#fff')
    const line = night ? '#1e293b' : getVar('--vp-c-divider', '#e2e8f0')
    const sub = night ? '#64748b' : getVar('--vp-c-text-2', '#64748b')
    const body = night ? '#e2e8f0' : '#1f2937'

    ctx.clearRect(0, 0, W, H)
    px(0, 0, W, H, bg)

    ctx.fillStyle = night ? '#1e293b' : 'rgba(100,116,139,.18)'
    for (const c of clouds) {
      px(c.x, c.y, 30, 8, ctx.fillStyle)
      px(c.x + 10, c.y - 6, 18, 8, ctx.fillStyle)
    }

    px(0, GROUND + 28, W, 2, line)
    ctx.fillStyle = line
    for (let i = dist % 24; i < W; i += 24) px(i, GROUND + 32, 8, 2, line)

    const y = duck && onGround ? dino.y + 10 : dino.y
    px(dino.x, y, 22, 18, body)
    px(dino.x + 18, y - 8, 10, 14, body)
    px(dino.x + 26, y - 4, 4, 4, body)
    px(dino.x + 22, y - 6, 3, 3, night ? '#0f172a' : '#fff')
    px(dino.x - 4, y + 6, 6, 8, body)
    px(dino.x + 2, y + 16, 6, 8, body)
    px(dino.x + 12, y + 16, 6, 8, body)

    for (const o of obs) {
      const c = night ? '#94a3b8' : '#0f766e'
      if (o.kind === 'cactus') {
        px(o.x, o.y, o.w, o.h, c)
        px(o.x - 4, o.y + 6, 4, 10, c)
        px(o.x + o.w, o.y + 10, 4, 8, c)
      } else {
        px(o.x, o.y, o.w, 10, c)
        px(o.x + 4, o.y - 5, 10, 5, c)
        px(o.x + 14, o.y + 8, 8, 4, c)
      }
    }

    ctx.fillStyle = sub
    ctx.font = '600 14px ui-monospace, monospace'
    ctx.textAlign = 'right'
    ctx.fillText(String(score.value).padStart(5, '0'), W - 16, 24)
    if (night) ctx.fillText('🌙', W - 70, 24)
  }

  function loop(now: number) {
    const dt = now - last
    last = now
    if (state.value === 'playing') update(dt)
    draw()
    if (state.value === 'playing') raf = requestAnimationFrame(loop)
  }

  function onKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase()
    if ([' ', 'arrowup', 'arrowdown', 'w', 's'].includes(k)) e.preventDefault()
    if (k === 'r') { cancelAnimationFrame(raf); reset(); return }
    if (k === ' ') { if (onGround) jump(); return }
    if (state.value !== 'playing') start()
    if (k === 'arrowup' || k === 'w') { if (onGround) jump() }
    if (k === 'arrowdown' || k === 's') duck = true
  }
  function onKeyUp(e: KeyboardEvent) {
    if (['arrowdown', 's'].includes(e.key.toLowerCase())) duck = false
  }

  function mount(canvas: HTMLCanvasElement) {
    ctx = canvas.getContext('2d')
    loadBest() // 浏览器挂载后才读 localStorage
    reset()
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
  }
  function unmount() {
    cancelAnimationFrame(raf)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKeyUp)
  }

  return { state, score, best, start, jump, reset, mount, unmount }
}