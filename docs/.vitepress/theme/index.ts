// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import { ClientOnly } from 'vitepress'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import MeteorRain from './MeteorRain.vue'
import Astronaut from './Astronaut.vue'
import SpaceBackground from './SpaceBackground.vue'
import NeuralStars from './NeuralStars.vue'
import SaturnPlanet from './SaturnPlanet.vue'
import Singularity from './Singularity.vue'
import Fireworks from './Fireworks.vue'
import NotFoundDino from './NotFoundDino.vue'
import NotFoundSnake from './NotFoundSnake.vue'
import GameList from './GameList.vue'
import DinoGame from './games/DinoGame.vue'
import SnakeGame from './games/SnakeGame.vue'
import TetrisGame from './games/TetrisGame.vue'
import RunnerGame from './games/RunnerGame.vue'
import RabbitGame from './games/RabbitGame.vue'
import CubeGame from './games/CubeGame.vue'
import TokyoScene from './TokyoScene.vue'
import HaruScene from './HaruScene.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
      // 把流星雨插到首页 Hero 区域最前面
      // 用 ClientOnly 包裹：SSR 与首次 hydration 都渲染 null，避免暗色 SSR HTML
      // 与亮色客户端渲染结构不一致导致 hydration mismatch（刷新后站内跳转白屏）。
      // 显隐仍由 style.css 中 html.dark .space-layer 控制。
      'home-hero-before': () => h(ClientOnly, null, {
        // 土星背景替换原 CSS 天体（原天体保留在 SpaceBackground 中，默认 display:none）
        // NeuralStars：透明底 Three.js 星光特效叠在星云之上
        default: () => [h(SpaceBackground), h(Singularity), h(NeuralStars), h(SaturnPlanet), h(MeteorRain), h(Astronaut)]
      }),
      /*
      // 文档页左侧导航栏
      'sidebar-nav-before': () => h(ClientOnly, null, {
        default: () => [h(Astronaut)]
      }),
      // 文档页正文 Markdown 渲染内容
      'layout-bottom': () => h(ClientOnly, null, {
        default: () => [h(Astronaut)]
      }),
      // 文档页右侧“目录/大纲”
      'aside-outline-before': () => h(ClientOnly, null, {
        default: () => [h(Astronaut)]
      }),
      // 顶部导航栏
      'nav-bar-title-before': () => h(ClientOnly, null, {
        default: () => [h(Astronaut)]
      }),
      */
      // 点击烟花：全页面固定层，pointer-events:none 不干扰交互
      'layout-bottom': () => h(ClientOnly, null, {
        default: () => h(Fireworks)
      }),
      // NotFound
      'not-found': () => h(ClientOnly, null, {
        default: () => [h(NotFoundDino)]
      }),
    })
  },
  enhanceApp({ app, router, siteData }) {
    // ...
    // 注册组件（其实 Layout 里直接用也行，但注册更规范）
    app.component('SpaceBackground', SpaceBackground)
    app.component('NeuralStars', NeuralStars)
    app.component('MeteorRain', MeteorRain)
    app.component('Astronaut', Astronaut)
    app.component('GameList', GameList)
    app.component('DinoGame', DinoGame)
    app.component('SnakeGame', SnakeGame)
    app.component('TetrisGame', TetrisGame)
    app.component('RunnerGame', RunnerGame)
    app.component('RabbitGame', RabbitGame)
    app.component('CubeGame', CubeGame)
    app.component('TokyoScene', TokyoScene)
    app.component('HaruScene', HaruScene)
    app.component('Singularity', Singularity)
    app.component('Fireworks', Fireworks)
  }
} satisfies Theme
