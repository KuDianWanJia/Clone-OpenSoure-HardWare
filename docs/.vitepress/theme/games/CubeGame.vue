<script setup>
// 3D 魔方 —— 移植自 Boris Šehovac 的开源游戏 The Cube（MIT，https://github.com/bsehovac/the-cube）
// 引擎本体见 ./cube-engine.js（已适配 three@0.177，并支持挂载/卸载清理）。
// .ui 结构取自原版 index.html：因引擎按标签名查找 <icon>/<range> 等自定义标签并原地替换，
// 这里用 v-html 注入原始标记，绕过 Vue 模板编译；内容为静态字符串，挂载后不再参与 diff。
import { onMounted, onBeforeUnmount } from 'vue'
import { withBase } from 'vitepress'
import { bootCube, stopCube } from './cube-engine?v=cube9'
import './cube.css'

const uiHtml = `
  <div class="ui__background"></div>

  <div class="ui__game"></div>

  <div class="ui__texts">
    <h1 class="text text--title">
      <span>THE</span>
      <span>CUBE</span>
    </h1>
    <div class="text text--note">
      Double tap to start
    </div>
    <div class="text text--timer">
      0:00
    </div>
    <div class="text text--complete">
      <span>Complete!</span>
    </div>
    <div class="text text--best-time">
      <icon trophy></icon>
      <span>Best Time!</span>
    </div>
  </div>

  <div class="ui__prefs">
    <range name="size" title="Cube Size" list="2,3,4,5"></range>
    <range name="flip" title="Flip Type" list="Swift&nbsp;,Smooth,Bounce"></range>
    <range name="scramble" title="Scramble Length" list="20,25,30"></range>
    <range name="fov" title="Camera Angle" list="Ortographic,Perspective"></range>
    <range name="theme" title="Color Scheme" list="Cube,Erno,Dust,Camo,Rain"></range>
  </div>

  <div class="ui__theme">
    <range name="hue" title="Hue" color></range>
    <range name="saturation" title="Saturation" color></range>
    <range name="lightness" title="Lightness" color></range>
  </div>

  <div class="ui__stats">
    <div class="stats" name="cube-size">
      <i>Cube:</i><b>3x3x3</b>
    </div>
    <div class="stats" name="total-solves">
      <i>Total solves:</i><b>-</b>
    </div>
    <div class="stats" name="best-time">
      <i>Best time:</i><b>-</b>
    </div>
    <div class="stats" name="worst-time">
      <i>Worst time:</i><b>-</b>
    </div>
    <div class="stats" name="average-5">
      <i>Average of 5:</i><b>-</b>
    </div>
    <div class="stats" name="average-12">
      <i>Average of 12:</i><b>-</b>
    </div>
    <div class="stats" name="average-25">
      <i>Average of 25:</i><b>-</b>
    </div>
  </div>

  <div class="ui__buttons">
    <button class="btn btn--bl btn--stats">
      <icon trophy></icon>
    </button>
    <button class="btn btn--br btn--prefs">
      <icon settings></icon>
    </button>
    <button class="btn btn--bl btn--back">
      <icon back></icon>
    </button>
    <button class="btn btn--br btn--theme">
      <icon theme></icon>
    </button>
    <button class="btn btn--br btn--reset">
      <icon reset></icon>
    </button>
  </div>
`

onMounted(() => {
  bootCube()
})

onBeforeUnmount(() => {
  stopCube()
})
</script>

<template>
  <section class="cube-root">
    <div class="ui" v-html="uiHtml"></div>

    <!-- 站内导航角标（游戏自身的按钮都在四角下方，顶部留给它） -->
    <div class="cube-nav">
      <span class="cube-badge">🧩 3D 魔方 · The Cube</span>
      <a class="cube-back" :href="withBase('/games/')">← 返回小游戏中心</a>
    </div>
  </section>
</template>

<style scoped>
.cube-nav {
  position: absolute;
  top: 14px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  z-index: 10;
  pointer-events: none;
}
.cube-badge {
  font-size: 12.5px;
  font-weight: 600;
  padding: 4px 13px;
  border-radius: 999px;
  color: #6b7280;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(107, 114, 128, 0.3);
  backdrop-filter: blur(6px);
}
.cube-back {
  pointer-events: auto;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  color: #374151;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(55, 65, 81, 0.3);
  backdrop-filter: blur(6px);
  text-decoration: none;
  transition: transform 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}
.cube-back:hover {
  color: #111827;
  border-color: #374151;
  transform: translateY(-2px);
}
@media (max-width: 768px) {
  .cube-badge { display: none; }
  .cube-nav { justify-content: flex-end; }
}
</style>
