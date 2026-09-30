<script setup lang="ts">
import { useRouter, withBase } from 'vitepress'

const router = useRouter()
const base = withBase('/')

defineProps<{
  title: string
  desc?: string
  score?: number
  best?: number
  state?: 'idle' | 'playing' | 'paused' | 'over'
  btn?: string
}>()

defineEmits<{ (e: 'action'): void }>()
</script>

<template>
  <section class="gs">
    <div class="hd">
      <div>
        <h1>{{ title }}</h1>
        <p v-if="desc">{{ desc }}</p>
      </div>
      <a :href="base + 'games/'" class="back">← 游戏列表</a>
    </div>

    <div class="card">
      <div class="stage">
        <slot />
        <div class="overlay" v-if="state && state !== 'playing'">
          <button class="btn" @click="$emit('action')">{{ btn }}</button>
        </div>
      </div>

      <div class="foot" v-if="state">
        <div class="stat">
          <span class="k">当前</span>
          <span class="v">{{ String(score ?? 0).padStart(4, '0') }}</span>
        </div>
        <div class="stat">
          <span class="k">最佳</span>
          <span class="v">{{ String(best ?? 0).padStart(4, '0') }}</span>
        </div>
        <div class="hint"><slot name="hint" /></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gs { max-width: 720px; margin: 40px auto; padding: 0 20px; }
.hd { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; }
.hd h1 { margin: 0 0 4px; font-size: 24px; }
.hd p { margin: 0; color: var(--vp-c-text-2); font-size: 14px; }
.back { color: var(--vp-c-text-2); text-decoration: none; font-size: 13px; white-space: nowrap; }
.back:hover { color: var(--vp-c-brand-1); }

.card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px; padding: 22px;
  box-shadow: 0 12px 40px rgba(0,0,0,.06);
}
:global(.dark) .card { box-shadow: 0 12px 40px rgba(0,0,0,.35); }

.stage {
  position: relative; border-radius: 14px; overflow: hidden;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg);
}
.stage canvas { display: block; width: 100%; height: auto; }

.overlay {
  position: absolute; inset: 0; display: grid; place-items: center;
  background: color-mix(in srgb, var(--vp-c-bg) 55%, transparent);
  backdrop-filter: blur(2px);
}
.btn {
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-1); color: #fff;
  font-weight: 600; padding: 10px 22px; border-radius: 999px;
  cursor: pointer; font-size: 14px;
}
.btn:hover { opacity: .92; transform: translateY(-1px); }

.foot { margin-top: 16px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
.stat { display: flex; flex-direction: column; line-height: 1.2; }
.stat .k { font-size: 11px; color: var(--vp-c-text-3); text-transform: uppercase; letter-spacing: .08em; }
.stat .v { font: 700 18px ui-monospace, monospace; }
.hint { margin-left: auto; font-size: 12.5px; color: var(--vp-c-text-2); display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.hint kbd {
  font: 600 11px ui-monospace, monospace;
  border: 1px solid var(--vp-c-divider); border-bottom-width: 2px;
  border-radius: 6px; padding: 2px 6px; background: var(--vp-c-bg);
}
</style>