// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import { ClientOnly } from 'vitepress'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import MeteorRain from './MeteorRain.vue'
import Astronaut from './Astronaut.vue'
import SpaceBackground from './SpaceBackground.vue'
import NotFoundDino from './NotFoundDino.vue'
import NotFoundSnake from './NotFoundSnake.vue'
import GameList from './GameList.vue'
import DinoGame from './games/DinoGame.vue'
import SnakeGame from './games/SnakeGame.vue'
import TetrisGame from './games/TetrisGame.vue'
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
        default: () => [h(MeteorRain), h(SpaceBackground), h(Astronaut)]
      }),
      // 文档页左侧导航栏
      'sidebar-nav-before': () => h(ClientOnly, null, {
        default: () => [h(Astronaut)]
      }),
      // 文档页正文 Markdown 渲染内容
      'doc-before': () => h(ClientOnly, null, {
        default: () => [h(Astronaut)]
      }),
      // 文档页右侧“目录/大纲”
      'aside-outline-before': () => h(ClientOnly, null, {
        default: () => [h(Astronaut)]
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
    app.component('MeteorRain', MeteorRain)
    app.component('Astronaut', Astronaut)
    app.component('GameList', GameList)
    app.component('DinoGame', DinoGame)
    app.component('SnakeGame', SnakeGame)
    app.component('TetrisGame', TetrisGame)
  }
} satisfies Theme
