import { ref } from 'vue'
import { inBrowser } from 'vitepress'

export function useBrowserBest(key: string) {
  const best = ref(0)

  function load() {
    if (!inBrowser) return
    try {
      best.value = Number(localStorage.getItem(key) || 0)
    } catch {
      best.value = 0
    }
  }

  function save(v: number) {
    if (!inBrowser) return
    try {
      localStorage.setItem(key, String(v))
    } catch {}
  }

  return { best, load, save }
}