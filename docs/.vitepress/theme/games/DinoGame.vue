<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import GameShell from './GameShell.vue'
import { useDino } from './useDino'

const canvas = ref<HTMLCanvasElement>()
const ui = useDino({})

onMounted(() => ui.mount(canvas.value!))
onBeforeUnmount(() => ui.unmount())
</script>

<template>
  <GameShell
    title="Chrome 小恐龙"
    desc="断网了？先跑两圈再说。"
    :score="ui.score.value"
    :best="ui.best.value"
    :state="ui.state.value"
    :btn="ui.state.value === 'over' ? '再来一局 (R)' : '开始跑 (空格)'"
    @action="ui.start"
  >
    <canvas ref="canvas" width="640" height="180" @pointerdown="ui.jump" />
    <template #hint>
      <kbd>Space</kbd><kbd>↑</kbd> 跳 · <kbd>↓</kbd> 蹲 · <kbd>R</kbd> 重开
    </template>
  </GameShell>
</template>