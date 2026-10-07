<template>
  <div class="space-bg space-layer" aria-hidden="true">
    <!-- 星云层 -->
    <div class="nebula nebula-1"></div>
    <div class="nebula nebula-2"></div>
    <div class="nebula nebula-3"></div>

    <!-- 天体 — 默认不加载，保留代码备用 -->
    <div class="planet planet-1" style="display:none;"></div>
    <div class="planet planet-2" style="display:none;"></div>
    <div class="planet planet-3" style="display:none;"></div>

    <!-- 远处星点 -->
    <div class="stars">
      <span v-for="s in starDots" :key="s.id" class="star" :style="s.style" />
    </div>
  </div>
</template>

<script setup>
const starDots = Array.from({ length: 60 }).map((_, i) => ({
  id: i,
  style: {
    left: Math.random() * 100 + '%',
    top: Math.random() * 100 + '%',
    width: Math.random() * 3 + 1 + 'px',
    height: Math.random() * 3 + 1 + 'px',
    animationDelay: Math.random() * 4 + 's',
    animationDuration: 2 + Math.random() * 3 + 's'
  }
}))
</script>

<style scoped>
/* ===== 容器 ===== */
.space-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  background: #0a0a1a;
  contain: layout paint;  /* 新增：限制渲染层，不干扰其他页面 */
}

/* ===== 星云 ===== */
.nebula {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}

.nebula-1 {
  width: 600px;
  height: 600px;
  top: -10%;
  left: -10%;
  background: radial-gradient(circle, rgba(189, 52, 254, 0.4), transparent 70%);
  animation: nebula-drift 25s ease-in-out infinite;
}

.nebula-2 {
  width: 500px;
  height: 500px;
  top: 40%;
  right: -10%;
  background: radial-gradient(circle, rgba(65, 209, 255, 0.3), transparent 70%);
  animation: nebula-drift 30s ease-in-out infinite reverse;
}

.nebula-3 {
  width: 400px;
  height: 400px;
  bottom: -10%;
  left: 30%;
  background: radial-gradient(circle, rgba(71, 202, 255, 0.2), transparent 70%);
  animation: nebula-drift 20s ease-in-out infinite;
}

@keyframes nebula-drift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

/* ===== 天体（行星） ===== */
.planet {
  position: absolute;
  border-radius: 50%;
}

/* 大行星 - 紫色 */
.planet-1 {
  width: 120px;
  height: 120px;
  top: 15%;
  left: 8%;
  background: radial-gradient(circle at 30% 30%, #8d1ac2, #6a0dad, #1a0033);
  box-shadow:
    0 0 40px rgba(189, 52, 254, 0.4),
    inset -10px -10px 30px rgba(0, 0, 0, 0.5);
  animation: planet-rotate 20s linear infinite;
}

/* 小行星 - 蓝色 */
.planet-2 {
  width: 60px;
  height: 60px;
  top: 60%;
  right: 15%;
  background: radial-gradient(circle at 30% 30%, #09a4b9, #1e6fa8, #0a2a40);
  box-shadow:
    0 0 25px rgba(65, 209, 255, 0.3),
    inset -8px -8px 20px rgba(0, 0, 0, 0.5);
  animation: planet-rotate 15s linear infinite reverse;
}

/* 小卫星 - 青色 */
.planet-3 {
  width: 30px;
  height: 30px;
  top: 45%;
  right: 50%;
  background: radial-gradient(circle at 30% 30%, #07968f, #1aa37a, #0a3d2e);
  box-shadow:
    0 0 15px rgba(56, 249, 215, 0.3),
    inset -5px -5px 10px rgba(0, 0, 0, 0.5);
  animation: planet-rotate 10s linear infinite;
}

/* ===== 行星外圈高速旋转光环 ===== */
.planet::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 140%;
  height: 50%;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.25);
  border-right-color: rgba(255, 255, 255, 0.1);
  transform: translate(-50%, -50%);
  animation: ring-spin 2s linear infinite;
  pointer-events: none;
}

.planet-1::before {
  border-top-color: rgba(189, 52, 254, 0.4);
}

/* 第二层环：更淡、更快 */
.planet::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 160%;
  height: 50%;
  border-radius: 50%;
  border: 1px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.15);
  border-left-color: rgba(255, 255, 255, 0.08);
  transform: translate(-50%, -50%);
  animation: ring-spin 3s linear infinite reverse;
  pointer-events: none;
}

@keyframes ring-spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes planet-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== 远处星点 ===== */
.stars {
  position: absolute;
  inset: 0;
}

.star {
  position: absolute;
  background: #fff;
  border-radius: 50%;
  opacity: 0.6;
  animation: star-twinkle ease-in-out infinite;
}

@keyframes star-twinkle {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.3); }
}

/* ===== 小屏简化 ===== */
@media (max-width: 768px) {
  .nebula {
    display: none;
  }
  .planet-2, .planet-3 {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .nebula,
  .planet,
  .star {
    animation: none;
  }
}

</style>
