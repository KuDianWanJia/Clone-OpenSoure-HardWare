<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter, withBase } from 'vitepress'

const canvas = ref(null)
const score = ref(0)
const best = ref(Number(localStorage.getItem('vp-dino-best') || 0))
const state = ref('idle') // idle | playing | over
let ctx, raf, last
const W = 640, H = 180, GROUND = 142
const router = useRouter()
const homePath = withBase('/')

let dino, obs, clouds, speed, dist, vy, onGround, duck, night

function goHome() {
  router.go(homePath)
}

function reset() {
  dino = { x: 56, y: GROUND, w: 26, h: 28 }
  obs = []
  clouds = [{ x: 380, y: 36 }, { x: 520, y: 24 }]
  speed = 5.2
  dist = 0
  vy = 0
  onGround = true
  duck = false
  night = false
  score.value = 0
  state.value = 'idle'
}

function start() {
  if (state.value === 'playing') return
  if (state.value === 'over') reset()
  state.value = 'playing'
  last = performance.now()
  raf = requestAnimationFrame(loop)
}

function jump() {
  start()
  if (onGround) { vy = -10.5; onGround = false }
}

function spawn() {
  const r = Math.random()
  if (r < 0.78) {
    const tall = Math.random() < 0.45
    const h = tall ? 38 : 26
    obs.push({ x: W + 20, y: GROUND + 28 - h, w: 16, h, kind: 'cactus' })
    if (Math.random() < 0.4) // 双株
      obs.push({ x: W + 30, y: GROUND + 28 - (tall ? 26 : 20), w: 14, h: tall ? 26 : 20, kind: 'cactus' })
  } else {
    obs.push({ x: W + 20, y: GROUND - 34, w: 26, h: 18, kind: 'bird' })
  }
}

function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function update(dt) {
  const k = Math.min(dt / 16.67, 2)
  dist += speed * k
  score.value = Math.floor(dist / 12)
  if (score.value > best.value) {
    best.value = score.value
    localStorage.setItem('vp-dino-best', String(best.value))
  }
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
  for (const o of obs) if (hit(box, o)) {
    state.value = 'over'
    cancelAnimationFrame(raf)
  }

  for (const c of clouds) {
    c.x -= speed * 0.25 * k
    if (c.x < -50) { c.x = W + Math.random() * 120; c.y = 18 + Math.random() * 36 }
  }
}

function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h) }

function drawDino() {
  const x = dino.x, y = duck && onGround ? dino.y + 10 : dino.y
  const body = night ? '#e2e8f0' : '#1f2937'
  const eye = night ? '#0f172a' : '#fff'
  // 身体
  px(x, y, 22, 18, body)
  px(x + 18, y - 8, 10, 14, body)      // 头
  px(x + 26, y - 4, 4, 4, body)         // 嘴
  px(x + 22, y - 6, 3, 3, eye)          // 眼
  px(x - 4, y + 6, 6, 8, body)          // 尾
  px(x + 2, y + 16, 6, 8, body)         // 腿1
  px(x + 12, y + 16, 6, 8, body)        // 腿2
  if (duck && onGround) px(x, y + 2, 24, 8, body)
}

function drawObs(o) {
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

function draw() {
  const bg = night ? '#0b1220' : getVar('--vp-c-bg', '#ffffff')
  const line = night ? '#1e293b' : getVar('--vp-c-divider', '#e2e8f0')
  const sub = night ? '#64748b' : getVar('--vp-c-text-2', '#64748b')
  ctx.clearRect(0, 0, W, H)
  px(0, 0, W, H, bg)

  // 云
  ctx.fillStyle = night ? '#1e293b' : 'rgba(100,116,139,.18)'
  for (const c of clouds) { px(c.x, c.y, 30, 8, ctx.fillStyle); px(c.x + 10, c.y - 6, 18, 8, ctx.fillStyle) }

  // 地面线
  px(0, GROUND + 28, W, 2, line)
  // 地面点纹
  ctx.fillStyle = line
  for (let i = (dist % 24); i < W; i += 24) px(i, GROUND + 32, 8, 2, line)

  drawDino()
  for (const o of obs) drawObs(o)

  // 分数右上
  ctx.fillStyle = sub
  ctx.font = '600 14px ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(String(score.value).padStart(5, '0'), W - 16, 24)
  if (night) { ctx.fillStyle = sub; ctx.fillText('🌙', W - 70, 24) }
}

function loop(now) {
  const dt = now - last; last = now
  if (state.value === 'playing') update(dt)
  draw()
  if (state.value === 'playing') raf = requestAnimationFrame(loop)
}

function getVar(n, f) {
  if (typeof window === 'undefined') return f
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || f
}

function onKey(e) {
  const k = e.key.toLowerCase()
  if ([' ', 'arrowup', 'arrowdown', 'w', 's'].includes(k)) e.preventDefault()
  if (k === 'r') { cancelAnimationFrame(raf); reset(); draw(); return }
  if (k === ' ' || k === 'arrowup' || k === 'w') jump()
  if (k === 'arrowdown' || k === 's') duck = true
}
function onKeyUp(e) {
  if (['arrowdown', 's'].includes(e.key.toLowerCase())) duck = false
}
function onPointer() { jump() }

onMounted(() => {
  ctx = canvas.value.getContext('2d')
  reset(); draw()
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <section class="nf">
    <div class="nf-card">
      <div class="nf-head">
        <span class="nf-code">404</span>
        <div>
          <h1>这一页跑丢了 🦖</h1>
          <p>断网了，先跑两圈 Chrome 小恐龙再试试吧。</p>
        </div>
      </div>

      <div class="nf-stage">
        <canvas ref="canvas" :width="W" :height="H" @pointerdown="onPointer" />
        <div class="nf-overlay" v-if="state !== 'playing'">
          <button class="nf-btn" @click="jump">
            {{ state === 'over' ? '再来一局 (R)' : '开始跑 (空格)' }}
          </button>
        </div>
      </div>

      <div class="nf-foot">
        <div class="nf-stat">
          <span class="k">当前</span><span class="v">{{ String(score).padStart(5,'0') }}</span>
        </div>
        <div class="nf-stat">
          <span class="k">最佳</span><span class="v">{{ String(best).padStart(5,'0') }}</span>
        </div>
        <div class="nf-hint">
          <kbd>Space</kbd><kbd>↑</kbd> 跳 · <kbd>↓</kbd> 蹲 · <kbd>R</kbd> 重开
          <button class="nf-home" @click="goHome">返回首页🚀</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.nf {
  max-width: 720px;
  margin: 56px auto;
  padding: 0 20px;
}
.nf-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  padding: 28px 28px 22px;
  box-shadow: 0 12px 40px rgba(0,0,0,.06);
}
:global(.dark) .nf-card { box-shadow: 0 12px 40px rgba(0,0,0,.35); }

.nf-head { display: flex; gap: 18px; align-items: center; margin-bottom: 20px; }
.nf-code {
  font: 800 44px/1 ui-monospace, monospace;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  padding: 10px 14px;
  border-radius: 14px;
}
.nf-head h1 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.nf-head p { margin: 0; color: var(--vp-c-text-2); font-size: 14px; }

.nf-stage {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}
.nf-stage canvas {
  display: block;
  width: 100%;
  height: auto;
  image-rendering: auto;
}
.nf-overlay {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  background: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
  backdrop-filter: blur(2px);
}
.nf-btn {
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
  padding: 10px 20px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  transition: transform .12s ease, opacity .12s ease;
}
.nf-btn:hover { transform: translateY(-1px); opacity: .95; }

.nf-foot {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}
.nf-stat { display: flex; flex-direction: column; line-height: 1.2; }
.nf-stat .k { font-size: 11px; color: var(--vp-c-text-3); text-transform: uppercase; letter-spacing: .08em; }
.nf-stat .v { font: 700 18px ui-monospace, monospace; color: var(--vp-c-text-1); }

.nf-hint { margin-left: auto; font-size: 12.5px; color: var(--vp-c-text-2); display: flex; align-items: center; gap: 6px; }
.nf-hint kbd {
  font: 600 11px ui-monospace, monospace;
  border: 1px solid var(--vp-c-divider);
  border-bottom-width: 2px;
  border-radius: 6px;
  padding: 2px 6px;
  background: var(--vp-c-bg);
}
.nf-home { color: var(--vp-c-brand-1); text-decoration: none; margin-left: 8px; font-weight: 600; }
.nf-home:hover { text-decoration: underline; }

@media (max-width: 560px) {
  .nf-head { flex-direction: column; align-items: flex-start; gap: 10px; }
  .nf-foot { gap: 14px; }
  .nf-hint { width: 100%; margin-left: 0; flex-wrap: wrap; }
}
</style>