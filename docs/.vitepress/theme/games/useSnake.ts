import { ref } from 'vue'
import { inBrowser } from 'vitepress'
import { useBrowserBest } from './useBrowserBest'

export function useSnake(opts: {
  onScore?: (n: number) => void
  onBest?: (n: number) => void
  onState?: (s: 'idle' | 'playing' | 'paused' | 'over') => void
}) {
  const SIZE = 20, CELL = 20
  let ctx: CanvasRenderingContext2D | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const state = ref<'idle' | 'playing' | 'paused' | 'over'>('idle')
  const score = ref(0)
  // ✅ 1. key 改成 snake 的，不是 dino
  const { best, load: loadBest, save: saveBest } = useBrowserBest('vp-snake-best')

  let snake: { x: number; y: number }[] = []
  let dir = { x: 1, y: 0 }
  let nextDir = { x: 1, y: 0 }
  let food = { x: 0, y: 0 }
  let speed = 110

  function setState(s: 'idle' | 'playing' | 'paused' | 'over') {
    state.value = s
    opts.onState?.(s)
  }

  function getVar(n: string, f: string) {
    if (!inBrowser) return f
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f
  }

  function placeFood() {
    while (true) {
      const f = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) }
      if (!snake.some(s => s.x === f.x && s.y === f.y)) { food = f; break }
    }
  }

  function reset() {
    snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }]
    dir = { x: 1, y: 0 }
    nextDir = { x: 1, y: 0 }
    speed = 110
    score.value = 0
    setState('idle')
    placeFood()
    draw()
  }

  function start() {
    if (state.value === 'playing') return
    if (state.value === 'over') reset()
    setState('playing')
    loop()
  }

  function togglePause() {
    if (state.value === 'playing') setState('paused')
    else if (state.value === 'paused') { setState('playing'); loop() }
  }

  function step() {
    dir = nextDir
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }
    if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE) return gameOver()
    if (snake.some(s => s.x === head.x && s.y === head.y)) return gameOver()

    snake.unshift(head)
    if (head.x === food.x && head.y === food.y) {
      score.value++
      // ✅ 2. 用 saveBest，别裸写 localStorage
      if (score.value > best.value) {
        best.value = score.value
        saveBest(best.value)
      }
      if (speed > 55) speed -= 3
      placeFood()
    } else {
      snake.pop()
    }
    opts.onScore?.(score.value)
    opts.onBest?.(best.value)
    draw()
  }

  function gameOver() {
    setState('over')
    if (timer) clearTimeout(timer)
  }

  function loop() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (state.value === 'playing') step()
      if (state.value === 'playing') loop()
    }, speed)
  }

  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
    ctx.fill()
  }

  function draw() {
    if (!ctx) return
    const bg = getVar('--vp-c-bg', '#fff')
    const grid = getVar('--vp-c-divider', '#e2e8f0')
    const headC = getVar('--vp-c-brand-1', '#16a34a')
    const bodyC = getVar('--vp-c-brand-2', '#22c55e')
    const foodC = getVar('--vp-c-danger-1', '#ef4444')

    ctx.clearRect(0, 0, SIZE * CELL, SIZE * CELL)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, SIZE * CELL, SIZE * CELL)

    ctx.strokeStyle = grid
    ctx.lineWidth = 1
    for (let i = 0; i <= SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE * CELL); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE * CELL, i * CELL); ctx.stroke()
    }

    ctx.fillStyle = foodC
    roundRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4, 5)

    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? headC : bodyC
      const p = i === 0 ? 1 : 2
      roundRect(s.x * CELL + p, s.y * CELL + p, CELL - p * 2, CELL - p * 2, i === 0 ? 6 : 4)
    })

    // 蛇头眼睛（补回来，之前你这版没画，可加可不加）
    const h = snake[0]
    ctx.fillStyle = bg
    if (dir.x === 1) { ctx.fillRect(h.x*CELL+13, h.y*CELL+5, 3,3); ctx.fillRect(h.x*CELL+13, h.y*CELL+12,3,3) }
    else if (dir.x === -1) { ctx.fillRect(h.x*CELL+4, h.y*CELL+5,3,3); ctx.fillRect(h.x*CELL+4, h.y*CELL+12,3,3) }
    else if (dir.y === -1) { ctx.fillRect(h.x*CELL+5, h.y*CELL+4,3,3); ctx.fillRect(h.x*CELL+12, h.y*CELL+4,3,3) }
    else { ctx.fillRect(h.x*CELL+5, h.y*CELL+13,3,3); ctx.fillRect(h.x*CELL+12, h.y*CELL+13,3,3) }
  }

  function onKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase()
    if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)) e.preventDefault()
    if (k === 'r') { if (timer) clearTimeout(timer); reset(); return }
    if (k === ' ') { togglePause(); return }
    if (state.value !== 'playing') start()
    if (k === 'arrowup' || k === 'w') { if (dir.y !== 1) nextDir = { x: 0, y: -1 } }
    if (k === 'arrowdown' || k === 's') { if (dir.y !== -1) nextDir = { x: 0, y: 1 } }
    if (k === 'arrowleft' || k === 'a') { if (dir.x !== 1) nextDir = { x: -1, y: 0 } }
    if (k === 'arrowright' || k === 'd') { if (dir.x !== -1) nextDir = { x: 1, y: 0 } }
  }

  // ✅ 3. mount 里必须 loadBest()，否则首屏 best 永远是 0
  function mount(canvas: HTMLCanvasElement) {
    ctx = canvas.getContext('2d')
    loadBest()
    reset()
    window.addEventListener('keydown', onKey)
  }
  function unmount() {
    if (timer) clearTimeout(timer)
    window.removeEventListener('keydown', onKey)
  }

  return { state, score, best, start, reset, mount, unmount }
}