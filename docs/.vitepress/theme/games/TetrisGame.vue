<script setup lang="ts">
import GameShell from './GameShell.vue'
</script>

<template>
  <GameShell
    title="俄罗斯方块"
    desc="正在施工中 🚧"
    state="over"
    btn="敬请期待"
  >
    <div class="soon">
      <div style="font-size:64px">🧱</div>
      <p>马上就好，先玩恐龙和贪吃蛇吧～</p>
    </div>
  </GameShell>
</template>

<style scoped>
.soon {
  padding: 80px 20px; text-align: center; color: var(--vp-c-text-2);
}
</style>