<template>
  <div class="meteor-rain" aria-hidden="true">
    <span
      v-for="m in meteors"
      :key="m.id"
      class="meteor"
      :style="m.style"
    />
  </div>
</template>

<script setup>
const meteors = Array.from({ length: 18 }).map((_, i) => ({
  id: i,
  style: {
    // 起始位置偏右（60%~100%），这样斜向左下才有空间
    left: 60 + Math.random() * 40 + '%',
    top: '-10%',
    animationDelay: Math.random() * 5 + 's',
    animationDuration: 2.5 + Math.random() * 2.5 + 's'
  }
}))
</script>

<style scoped>
.meteor-rain {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.meteor {
  position: absolute;
  width: 2px;
  height: 80px;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0),
    #41d1ff,
    #bd34fe
  );
  filter: drop-shadow(0 0 6px #41d1ff);
  opacity: 0.8;
  animation-name: meteor-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes meteor-fall {
  0% {
    transform: translate(0, -100px) rotate(225deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    /* 向左 80vw，向下 120vh → 右上到左下 */
    transform: translate(-80vw, 120vh) rotate(225deg);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .meteor {
    animation: none;
    display: none;
  }
}
</style>
