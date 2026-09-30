<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter, withBase } from 'vitepress'

const router = useRouter()
const homePath = withBase('/')

function goHome() {
  router.go(homePath)
}

const canvas = ref(null)
const score = ref(0)
const best = ref(Number(localStorage.getItem('vp-snake-best') || 0))
const state = ref('idle') // idle | playing | over | paused

let ctx, timer
let running = false
const SIZE = 20
const CELL = 20
let snake, dir, nextDir, food, speed, eatPulse

function getVar(n, f) {
  if (typeof window === 'undefined') return f
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f
}

function reset() {
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 }
  ]
  dir = { x: 1, y: 0 }
  nextDir = dir
  speed = 110
  score.value = 0
  eatPulse = 0
  running = false
  state.value = 'idle'
  placeFood()
  draw()
}

function placeFood() {
  while (true) {
    const f = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) }
    if (!snake.some(s => s.x === f.x && s.y === f.y)) { food = f; break }
  }
}

function start() {
  if (running) return
  running = true
  state.value = 'playing'
  loop()
}

function loop() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (state.value === 'playing') step()
    if (running) loop()
  }, speed)
}

function step() {
  dir = nextDir
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y }

  if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE) return gameOver()
  if (snake.some(s => s.x === head.x && s.y === head.y)) return gameOver()

  snake.unshift(head)

  if (head.x === food.x && head.y === food.y) {
    score.value++
    eatPulse = 6
    if (score.value > best.value) {
      best.value = score.value
      localStorage.setItem('vp-snake-best', String(best.value))
    }
    if (speed > 55) speed -= 3
    placeFood()
  } else {
    snake.pop()
  }
  draw()
}

function gameOver() {
  running = false
  state.value = 'over'
  draw()
}

function roundRect(x, y, w, h, r) {
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
  const bg = getVar('--vp-c-bg', '#ffffff')
  const grid = getVar('--vp-c-divider', '#e2e8f0')
  const sub = getVar('--vp-c-text-2', '#64748b')
  const headC = getVar('--vp-c-brand-1', '#16a34a')
  const bodyC = getVar('--vp-c-brand-2', '#22c55e')
  const foodC = getVar('--vp-c-danger-1', '#ef4444')

  ctx.clearRect(0, 0, SIZE * CELL, SIZE * CELL)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE * CELL, SIZE * CELL)

  // 网格底纹
  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  for (let i = 0; i <= SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, SIZE * CELL); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(SIZE * CELL, i * CELL); ctx.stroke()
  }

  // 食物（带脉冲）
  const p = eatPulse > 0 ? eatPulse : 0
  if (eatPulse > 0) eatPulse--
  const fs = CELL - 4 - p
  const off = (CELL - fs) / 2
  ctx.fillStyle = foodC
  roundRect(food.x * CELL + off, food.y * CELL + off, fs, fs, 5)

  // 蛇
  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? headC : bodyC
    const pad = i === 0 ? 1 : 2
    roundRect(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, i === 0 ? 6 : 4)
  })

  // 蛇头眼睛
  const h = snake[0]
  ctx.fillStyle = bg
  if (dir.x === 1) { ctx.fillRect(h.x*CELL+13, h.y*CELL+5, 3,3); ctx.fillRect(h.x*CELL+13, h.y*CELL+12,3,3) }
  else if (dir.x === -1) { ctx.fillRect(h.x*CELL+4, h.y*CELL+5,3,3); ctx.fillRect(h.x*CELL+4, h.y*CELL+12,3,3) }
  else if (dir.y === -1) { ctx.fillRect(h.x*CELL+5, h.y*CELL+4,3,3); ctx.fillRect(h.x*CELL+12, h.y*CELL+4,3,3) }
  else { ctx.fillRect(h.x*CELL+5, h.y*CELL+13,3,3); ctx.fillRect(h.x*CELL+12, h.y*CELL+13,3,3) }

  // 右上角计分
  ctx.fillStyle = sub
  ctx.font = '600 13px ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(String(score.value).padStart(3,'0'), SIZE*CELL - 10, 20)
}

function onKey(e) {
  const k = e.key.toLowerCase()
  if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k)) e.preventDefault()
  if (k === 'r') { clearTimeout(timer); reset(); return }
  if (k === ' ') {
    if (state.value === 'playing') { state.value = 'paused'; statusText() }
    else if (state.value === 'paused') { state.value = 'playing'; statusText(); loop() }
    return
  }
  if (state.value !== 'playing') start()
  if (k === 'arrowup' || k === 'w') { if (dir.y !== 1) nextDir = { x:0, y:-1 } }
  if (k === 'arrowdown' || k === 's') { if (dir.y !== -1) nextDir = { x:0, y:1 } }
  if (k === 'arrowleft' || k === 'a') { if (dir.x !== 1) nextDir = { x:-1, y:0 } }
  if (k === 'arrowright' || k === 'd') { if (dir.x !== -1) nextDir = { x:1, y:0 } }
}
function statusText(){ /* 状态由浮层控制，无需额外文本 */ }

function onPointer() { if (state.value !== 'playing') start() }

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  reset()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(timer)
})
</script>

<template>
  <section class="nf">
    <div class="nf-card">
      <div class="nf-head">
        <span class="nf-code">404</span>
        <div>
          <h1>这一页被蛇吞了 🐍</h1>
          <p>没找到页面，先来盘贪吃蛇冷静一下。</p>
        </div>
      </div>

      <div class="nf-stage">
        <canvas ref="canvas" :width="SIZE * CELL" :height="SIZE * CELL" @pointerdown="onPointer" />
        <div class="nf-overlay" v-if="state !== 'playing'">
          <button class="nf-btn" @click="onPointer">
            {{ state === 'over' ? '再来一局 (R)' : state === 'paused' ? '继续 (空格)' : '开始玩 (方向键)' }}
          </button>
        </div>
      </div>

      <div class="nf-foot">
        <div class="nf-stat"><span class="k">当前</span><span class="v">{{ String(score).padStart(3,'0') }}</span></div>
        <div class="nf-stat"><span class="k">最佳</span><span class="v">{{ String(best).padStart(3,'0') }}</span></div>
        <div class="nf-hint">
          <kbd>↑↓←→</kbd><kbd>WASD</kbd> 移动 · <kbd>Space</kbd> 暂停 · <kbd>R</kbd> 重开
          <button class="nf-home" @click="goHome">返回首页🚀</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nf { max-width: 520px; margin: 56px auto; padding: 0 20px; }
.nf-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  padding: 26px 26px 20px;
  box-shadow: 0 12px 40px rgba(0,0,0,.06);
}
:global(.dark) .nf-card { box-shadow: 0 12px 40px rgba(0,0,0,.35); }

.nf-head { display: flex; gap: 16px; align-items: center; margin-bottom: 18px; }
.nf-code {
  font: 800 40px/1 ui-monospace, monospace;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 10px 14px; border-radius: 14px;
}
.nf-head h1 { margin: 0 0 4px; font-size: 21px; font-weight: 700; color: var(--vp-c-text-1); }
.nf-head p { margin: 0; color: var(--vp-c-text-2); font-size: 14px; }

.nf-stage {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}
.nf-stage canvas { display: block; width: 100%; height: auto; }
.nf-overlay {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
  backdrop-filter: blur(2px);
}
.nf-btn {
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-1); color: #fff;
  font-weight: 600; padding: 10px 20px; border-radius: 999px;
  cursor: pointer; font-size: 14px; transition: transform .12s ease, opacity .12s ease;
}
.nf-btn:hover { transform: translateY(-1px); opacity: .95; }

.nf-foot { margin-top: 16px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.nf-stat { display: flex; flex-direction: column; line-height: 1.2; }
.nf-stat .k { font-size: 11px; color: var(--vp-c-text-3); text-transform: uppercase; letter-spacing: .08em; }
.nf-stat .v { font: 700 18px ui-monospace, monospace; color: var(--vp-c-text-1); }

.nf-hint { margin-left: auto; font-size: 12.5px; color: var(--vp-c-text-2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.nf-hint kbd {
  font: 600 11px ui-monospace, monospace;
  border: 1px solid var(--vp-c-divider); border-bottom-width: 2px;
  border-radius: 6px; padding: 2px 6px; background: var(--vp-c-bg);
}
.nf-home { color: var(--vp-c-brand-1); text-decoration: none; margin-left: 6px; font-weight: 600; }
.nf-home:hover { text-decoration: underline; }

@media (max-width: 560px) {
  .nf-head { flex-direction: column; align-items: flex-start; gap: 10px; }
  .nf-foot { gap: 12px; }
  .nf-hint { width: 100%; margin-left: 0; }
}
</style>