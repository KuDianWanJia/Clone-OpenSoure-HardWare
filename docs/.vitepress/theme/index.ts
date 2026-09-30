// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import { useData } from 'vitepress'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import MeteorRain from './MeteorRain.vue'
import Astronaut from './Astronaut.vue'
import SpaceBackground from './SpaceBackground.vue'
import NotFoundDino from './NotFoundDino.vue'
import NotFoundSnake from './NotFoundSnake.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    const { isDark } = useData()

    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
      // 把流星雨插到首页 Hero 区域最前面
      'home-hero-before': () => isDark.value
        ? [h(MeteorRain), h(SpaceBackground), h(Astronaut)]
        : null,
      // 文档页左侧导航栏
      'sidebar-nav-before': () => isDark.value
        ? [h(Astronaut)]
        : null,
      // 文档页正文 Markdown 渲染内容
      'doc-before': () => isDark.value
        ? [h(Astronaut)]
        : null,
      // 文档页右侧“目录/大纲”
      'aside-outline-before': () => isDark.value
        ? [h(Astronaut)]
        : null,
      // NotFound
      'not-found': () => isDark.value
        ? [h(NotFoundDino)]
        : [h(NotFoundSnake)],
    })
  },
  enhanceApp({ app, router, siteData }) {
    // ...
    // 注册组件（其实 Layout 里直接用也行，但注册更规范）
    app.component('SpaceBackground', SpaceBackground)
    app.component('MeteorRain', MeteorRain)
    app.component('Astronaut', Astronaut)
  }
} satisfies Theme
