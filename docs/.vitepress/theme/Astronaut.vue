<template>
  <div class="astronaut-wrap" aria-hidden="true">
    <img
      class="astronaut"
      src="/icons/Astronauts.png"
      :style="astronautStyle"
      alt=""
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const astronautStyle = ref({
  transform: 'translate(0px, 0px) rotate(0deg)',
})

let x = 200
let y = 200
let vx = 0.5
let vy = 0.3
let angle = 0

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
}

let animFrame = null

function animate() {
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

onMounted(() => {
  initWaypoints()
  x = waypoints[0].x
  y = waypoints[0].y
  animate()
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
})
</script>

<style scoped>
.astronaut-wrap {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
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
}

@media (max-width: 768px) {
  .astronaut-wrap {
    display: none;
  }
}
</style>