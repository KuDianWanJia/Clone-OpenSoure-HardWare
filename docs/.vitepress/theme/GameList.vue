<script setup>
import { useRouter, withBase } from 'vitepress'

const router = useRouter()
const base = withBase('/')

const games = [
  {
    slug: 'dino',
    name: 'Chrome 小恐龙',
    desc: '断网跑酷：空格跳、↓ 蹲，分数越高越快',
    icon: '🦖',
    color: 'var(--vp-c-brand-1)',
    tag: '可玩'
  },
  {
    slug: 'snake',
    name: '贪吃蛇',
    desc: '方向键 / WASD 移动，吃食物变长',
    icon: '🐍',
    color: '#16a34a',
    tag: '可玩'
  },
  {
    slug: 'runner',
    name: '兔子快跑',
    desc: '3D 星球跑酷：跳跃吃胡萝卜、躲刺猬，别被黑怪兽追上',
    icon: '🐰',
    color: '#dc5f45',
    tag: '3D · 可玩'
  },
  {
    slug: 'rabbit',
    name: '兔子吃萝卜',
    desc: '3D 镜面地板：鼠标牵引兔子追胡萝卜，点击旋转跳跃',
    icon: '🥕',
    color: '#06b6d4',
    tag: '3D · 可玩'
  },
  {
    slug: 'cube',
    name: '3D 魔方',
    desc: '经典 The Cube：拖动转层复原六面，计时挑战 + 五种配色',
    icon: '🧩',
    color: '#f59e0b',
    tag: '3D · 可玩'
  },
  {
    slug: 'tetris',
    name: '俄罗斯方块',
    desc: '开发中，先收藏一下',
    icon: '🧱',
    color: '#64748b',
    tag: 'Soon',
    disabled: true
  }
]

function open(g) {
  if (g.disabled) return
  router.go(`${base}games/${g.slug}`)
}
</script>

<template>
  <section class="page">
    <header class="hd">
      <span class="badge">🎮 摸鱼专区</span>
      <h1>小游戏中心</h1>
      <p>工作累了？来一局再说。</p>
    </header>

    <div class="grid">
      <article
        v-for="g in games"
        :key="g.slug"
        class="card"
        :class="{ disabled: g.disabled }"
        :style="{ '--c': g.color }"
        @click="open(g)"
      >
        <div class="cover">
          <span class="emoji">{{ g.icon }}</span>
          <span class="tag" :class="{ off: g.disabled }">{{ g.tag }}</span>
        </div>
        <div class="meta">
          <h3>{{ g.name }}</h3>
          <p>{{ g.desc }}</p>
          <span class="arrow">{{ g.disabled ? '敬请期待' : '开始 →' }}</span>
        </div>
      </article>
    </div>

    <footer class="ft">
      <a :href="base" class="back">← 返回首页</a>
    </footer>
  </section>
</template>

<style scoped>
.page { max-width: 900px; margin: 40px auto; padding: 0 24px; }
.hd { text-align: center; margin-bottom: 36px; }
.badge {
  display: inline-block; font-size: 12px; padding: 4px 12px;
  border-radius: 999px; background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1); font-weight: 600;
}
.hd h1 { font-size: 30px; margin: 12px 0 8px; }
.hd p { color: var(--vp-c-text-2); margin: 0; }

.grid {
  display: grid; gap: 18px;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}
.card {
  --c: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px; overflow: hidden;
  background: var(--vp-c-bg-soft);
  cursor: pointer; transition: .16s ease;
}
.card:hover {
  transform: translateY(-4px);
  border-color: var(--c);
  box-shadow: 0 18px 40px -12px color-mix(in srgb, var(--c) 45%, transparent);
}
.card.disabled { opacity: .6; cursor: not-allowed; }
.card.disabled:hover { transform: none; box-shadow: none; border-color: var(--vp-c-divider); }

.cover {
  position: relative; height: 120px; display: grid; place-items: center;
  background: linear-gradient(135deg, color-mix(in srgb, var(--c) 18%, transparent), transparent);
}
.emoji { font-size: 54px; }
.tag {
  position: absolute; top: 12px; right: 12px;
  font-size: 11px; font-weight: 600; padding: 3px 10px;
  border-radius: 999px; background: var(--c); color: #fff;
}
.tag.off { background: var(--vp-c-text-3); }

.meta { padding: 18px; }
.meta h3 { margin: 0 0 6px; }
.meta p { margin: 0 0 14px; font-size: 13.5px; color: var(--vp-c-text-2); }
.arrow { font-size: 13px; font-weight: 600; color: var(--c); }

.ft { text-align: center; margin-top: 32px; }
.back { color: var(--vp-c-text-2); text-decoration: none; font-size: 13.5px; }
.back:hover { color: var(--vp-c-brand-1); }
</style>