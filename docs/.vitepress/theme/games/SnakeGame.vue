<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import GameShell from './GameShell.vue'
import { useSnake } from './useSnake'

const canvas = ref<HTMLCanvasElement>()
const ui = useSnake({})

onMounted(() => ui.mount(canvas.value!))
onBeforeUnmount(() => ui.unmount())
</script>

<template>
  <GameShell
    title="贪吃蛇"
    desc="经典街机，吃食物别咬自己。"
    :score="ui.score.value"
    :best="ui.best.value"
    :state="ui.state.value"
    :btn="ui.state.value === 'over' ? '再来一局 (R)' : ui.state.value === 'paused' ? '继续 (空格)' : '开始玩 (方向键)'"
    @action="ui.start"
  >
    <canvas ref="canvas" width="400" height="400" />
    <template #hint>
      <kbd>↑↓←→</kbd><kbd>WASD</kbd> 移动 · <kbd>Space</kbd> 暂停 · <kbd>R</kbd> 重开
    </template>
  </GameShell>
</template>