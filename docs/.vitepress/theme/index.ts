// https://vitepress.dev/guide/custom-theme
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import MeteorRain from './MeteorRain.vue'
import Astronaut from './Astronaut.vue'
import SpaceBackground from './SpaceBackground.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
      // 把流星雨插到首页 Hero 区域最前面
      'home-hero-before': () => [h(SpaceBackground), h(MeteorRain), h(Astronaut)]
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
