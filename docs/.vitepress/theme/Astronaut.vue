<template>
  <div class="astronaut-wrap space-layer" aria-hidden="true">
    <img
      class="astronaut"
      :class="{ 'is-ready': isReady }"
      src="/icons/Astronauts.png"
      :style="astronautStyle"
      alt=""
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useData } from 'vitepress'

const { isDark } = useData()

// 初始别写 0,0，先给个屏幕内位置，避免 SSR 第一帧在左上角
const startX = typeof window !== 'undefined' ? window.innerWidth * 0.2 : 200
const startY = typeof window !== 'undefined' ? window.innerHeight * 0.25 : 200

const astronautStyle = ref({
  transform: `translate(${startX}px, ${startY}px) rotate(0deg)`,
})

const isReady = ref(false)

let x = startX
let y = startY
let vx = 0.5
let vy = 0.3
let angle = 0
let destroyed = false
let waypoints = []
let currentWaypointIndex = 0

function generateWaypoint() {
  const maxX = window.innerWidth * 0.7
  const maxY = window.innerHeight * 0.7
  const margin = 80
  return {
    x: margin + Math.random() * (maxX - margin * 2),
    y: margin + Math.random() * (maxY - margin * 2),
  }
}

function initWaypoints() {
  waypoints = []
  for (let i = 0; i < 6; i++) {
    waypoints.push(generateWaypoint())
  }
  currentWaypointIndex = 0
  // 起点直接锁到第一个航点，第一帧就在正确位置
  x = waypoints[0].x
  y = waypoints[0].y
  const next = waypoints[1] || waypoints[0]
  angle = Math.atan2(next.y - y, next.x - x) * (180 / Math.PI) + 90
  astronautStyle.value = {
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
  }
}

let animFrame = null

function animate() {
  if (destroyed) return
  // 亮色模式下组件被 CSS 隐藏，停止动画循环，避免空转
  if (!isDark.value) {
    animFrame = null
    return
  }
  const wp = waypoints[currentWaypointIndex]

  const dx = wp.x - x
  const dy = wp.y - y
  const dist = Math.sqrt(dx * dx + dy * dy)

  if (dist < 15) {
    currentWaypointIndex++
    if (currentWaypointIndex >= waypoints.length) {
      const last = waypoints[waypoints.length - 1]
      waypoints = [last]
      for (let i = 0; i < 5; i++) {
        waypoints.push(generateWaypoint())
      }
      currentWaypointIndex = 1
    }
  }

  const dirLen = Math.max(dist, 0.001)
  const tdx = dx / dirLen
  const tdy = dy / dirLen

  const cruiseSpeed = 0.9

  vx += (tdx * cruiseSpeed - vx) * 0.012
  vy += (tdy * cruiseSpeed - vy) * 0.012

  x += vx
  y += vy

  // 边界软约束
  const margin = 60
  const maxX = window.innerWidth * 0.7
  const maxY = window.innerHeight * 0.7
  if (x < margin) vx += 0.02
  if (x > maxX - margin) vx -= 0.02
  if (y < margin) vy += 0.02
  if (y > maxY - margin) vy -= 0.02

  // 平滑朝向
  const targetAngle = Math.atan2(vy, vx) * (180 / Math.PI) + 90

  let diff = targetAngle - angle
  while (diff > 180) diff -= 360
  while (diff < -180) diff += 360

  const maxTurn = 1.2
  if (diff > maxTurn) diff = maxTurn
  if (diff < -maxTurn) diff = -maxTurn

  angle += diff
  if (angle > 360) angle -= 360
  if (angle < -360) angle += 360

  astronautStyle.value = {
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
  }

  animFrame = requestAnimationFrame(animate)
}

onMounted(async () => {
  destroyed = false
  await nextTick()
  initWaypoints()        // 先把位置算好设到航点1
  isReady.value = true   // 再显示图片
  animate()
})

// 亮色 → 暗色切换时恢复动画循环
watch(isDark, (dark) => {
  if (dark && !destroyed && animFrame === null && isReady.value) {
    animate()
  }
})

onUnmounted(() => {
  destroyed = true
  cancelAnimationFrame(animFrame)
  animFrame = null
})
</script>

<style scoped>
.astronaut-wrap {
  position: absolute;   /* 改了：原来是 fixed */
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  contain: layout paint;  /* 新增：限制渲染层，不干扰其他页面 */
}

.astronaut {
  position: absolute;
  top: 0;
  left: 0;
  width: 64px;
  height: 64px;
  opacity: 0.85;
  filter: drop-shadow(0 0 12px rgba(65, 209, 255, 0.5));
  will-change: transform;
  transform-origin: center center;
  /* 关键：没 ready 前不显示，彻底防左上角闪 */
  visibility: hidden;
}

.astronaut.is-ready {
  visibility: visible;
}

@media (max-width: 768px) {
  .astronaut-wrap {
    display: none;
  }
}
</style>