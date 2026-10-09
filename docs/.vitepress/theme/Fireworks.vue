<template>
  <canvas ref="canvasRef" class="fireworks-canvas"></canvas>
</template>

<script setup>
// 点击烟花特效，移植自 CodePen: https://codepen.io/juliangarnier/pen/gmOwJX
// 原 Pen 依赖 anime.js；此处用 rAF + easeOutExpo 自实现，无额外依赖
import { onMounted, onBeforeUnmount, ref } from 'vue'

const canvasRef = ref(null)
let ctx = null
let dpr = 1
let particles = []
let rings = []
let rafId = 0

// 亮色主题：鲜艳高对比色（原方案）
const colorsLight = ['#FF1461', '#18FF92', '#5A87FF', '#FBF38C']
// 暗色主题：星空色系（紫蓝星点 + 黑洞吸积暖橙）
const colorsDark = ['#7B68EE', '#00BFFF', '#FFD1A4', '#E8D5FF']
let colors = colorsLight
const ringColorLight = '#222'
const ringColorDark = '#C8BFFF'
let ringColor = ringColorLight
const numberOfParticules = 30

function updateTheme() {
  const dark = document.documentElement.classList.contains('dark')
  colors = dark ? colorsDark : colorsLight
  ringColor = dark ? ringColorDark : ringColorLight
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// easeOutExpo: 1 - 2^(-10t)，与 anime.js 'easeOutExpo' 等价
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function setCanvasSize() {
  const w = window.innerWidth
  const h = window.innerHeight
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvasRef.value.width = w * dpr
  canvasRef.value.height = h * dpr
  canvasRef.value.style.width = w + 'px'
  canvasRef.value.style.height = h + 'px'
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
}

function createParticule(x, y) {
  // 圆点扩散角度
  const angle = rand(0, 360) * Math.PI / 180
  // 圆点扩散范围
  const value = rand(30, 80)
  const radius = (Math.random() < 0.5 ? -1 : 1) * value
  // 初始圆点大小设置
  const startRadius = rand(8, 16)
  return {
    startX: x, startY: y,
    x, y,
    endX: x + radius * Math.cos(angle),
    endY: y + radius * Math.sin(angle),
    color: colors[rand(0, colors.length - 1)],
    startRadius,
    radius: startRadius,
    duration: rand(1200, 1800),
    startTime: 0
  }
}

function createRing(x, y) {
  return {
    x, y,
    // 环大小
    targetRadius: rand(20, 40),
    radius: 0.1,
    alpha: 0.5,
    startLineWidth: 6,
    lineWidth: 6,
    duration: rand(1200, 1800),
    alphaDuration: rand(600, 800),
    startTime: 0
  }
}

function tick(ts) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

  particles = particles.filter(p => {
    if (!p.startTime) p.startTime = ts
    const elapsed = ts - p.startTime
    const t = Math.min(elapsed / p.duration, 1)
    const eased = easeOutExpo(t)

    p.x = p.startX + (p.endX - p.startX) * eased
    p.y = p.startY + (p.endY - p.startY) * eased
    p.radius = p.startRadius * (1 - eased) + 0.1 * eased

    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(0.1, p.radius), 0, Math.PI * 2, true)
    ctx.fillStyle = p.color
    ctx.fill()

    return t < 1
  })

  rings = rings.filter(r => {
    if (!r.startTime) r.startTime = ts
    const elapsed = ts - r.startTime
    const t = Math.min(elapsed / r.duration, 1)
    const eased = easeOutExpo(t)

    r.radius = 0.1 + (r.targetRadius - 0.1) * eased
    const alphaT = Math.min(elapsed / r.alphaDuration, 1)
    r.alpha = 0.5 * (1 - alphaT)
    r.lineWidth = r.startLineWidth * (1 - eased)

    if (r.alpha > 0 && r.lineWidth > 0.1) {
      ctx.globalAlpha = r.alpha
      ctx.beginPath()
      ctx.arc(r.x, r.y, Math.max(0.1, r.radius), 0, Math.PI * 2, true)
      ctx.lineWidth = r.lineWidth
      ctx.strokeStyle = ringColor
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    return t < 1
  })

  if (particles.length > 0 || rings.length > 0) {
    rafId = requestAnimationFrame(tick)
  } else {
    rafId = 0
  }
}

function onTap(e) {
  const x = e.clientX ?? (e.touches && e.touches[0]?.clientX)
  const y = e.clientY ?? (e.touches && e.touches[0]?.clientY)
  if (x == null || y == null) return

  rings.push(createRing(x, y))
  for (let i = 0; i < numberOfParticules; i++) {
    particles.push(createParticule(x, y))
  }

  if (!rafId) {
    rafId = requestAnimationFrame(tick)
  }
}

let darkObs = null

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  setCanvasSize()
  updateTheme()
  window.addEventListener('resize', setCanvasSize)
  document.addEventListener('pointerdown', onTap, { passive: true })
  darkObs = new MutationObserver(updateTheme)
  darkObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', setCanvasSize)
  document.removeEventListener('pointerdown', onTap)
  darkObs?.disconnect()
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<style scoped>
.fireworks-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 9999;
}
</style>
