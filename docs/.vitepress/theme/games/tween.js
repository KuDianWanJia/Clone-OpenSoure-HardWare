// 共享迷你缓动引擎（GSAP TweenMax 子集）：
// 支持 to/from/killTweensOf、delay、ease、yoyo、repeat、"+=" 相对值、onUpdate/onComplete。
// 起始值延迟到首次激活时捕获（与 GSAP 一致，链式动画依赖这个行为）。
// 每个 createTweenEngine() 返回独立实例，组件间互不影响。

export function createTweenEngine() {
  const Ease = {
    linear: (t) => t,
    p1In: (t) => t * t,
    p1Out: (t) => 1 - (1 - t) * (1 - t),
    p1InOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    p2In: (t) => t * t * t,
    p2Out: (t) => 1 - Math.pow(1 - t, 3),
    p2InOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    p4In: (t) => t * t * t * t * t,
    p4Out: (t) => 1 - Math.pow(1 - t, 5),
    p4InOut: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
    backOut: (t) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    },
    // 等价 GSAP elastic.out(1, 0.3)
    elasticOut: (t) => {
      const c4 = (2 * Math.PI) / 3
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
    }
  }

  const SKIP_KEYS = ['duration', 'ease', 'delay', 'onComplete', 'onUpdate', 'yoyo', 'repeat']
  const activeTweens = new Set()

  class Tween {
    constructor(targets, duration, vars, isFrom) {
      this.targets = Array.isArray(targets) ? targets : [targets]
      this.duration = Math.max(duration, 1e-4)
      this.elapsed = -(vars.delay || 0)
      this.ease = vars.ease || Ease.linear
      this.onComplete = vars.onComplete
      this.onUpdate = vars.onUpdate
      this.yoyo = !!vars.yoyo
      this.repeat = vars.repeat ?? 0
      this.isFrom = isFrom
      this.props = {}
      for (const k in vars) {
        if (!SKIP_KEYS.includes(k)) this.props[k] = vars[k]
      }
      this.started = false
      this.from = []
      this.to = []
      activeTweens.add(this)
    }

    capture() {
      this.from = []
      this.to = []
      for (const tgt of this.targets) {
        const f = {}
        const t = {}
        for (const k in this.props) {
          const v = this.props[k]
          if (typeof v === 'string' && (v.startsWith('+=') || v.startsWith('-='))) {
            const d = parseFloat(v.slice(2)) * (v[0] === '-' ? -1 : 1)
            f[k] = tgt[k]
            t[k] = tgt[k] + d
          } else if (this.isFrom) {
            f[k] = v
            t[k] = tgt[k]
          } else {
            f[k] = tgt[k]
            t[k] = v
          }
        }
        this.from.push(f)
        this.to.push(t)
      }
    }

    step(dt) {
      this.elapsed += dt
      if (this.elapsed < 0) return true
      if (!this.started) {
        this.capture()
        this.started = true
      }
      const p = Math.min(this.elapsed / this.duration, 1)
      const e = this.ease(p)
      this.targets.forEach((tgt, i) => {
        for (const k in this.to[i]) {
          tgt[k] = this.from[i][k] + (this.to[i][k] - this.from[i][k]) * e
        }
      })
      if (this.onUpdate) this.onUpdate()
      if (p >= 1) {
        if (this.repeat > 0) {
          this.repeat--
          this.elapsed = 0
          if (this.yoyo) {
            for (let i = 0; i < this.from.length; i++) {
              const tmp = this.from[i]
              this.from[i] = this.to[i]
              this.to[i] = tmp
            }
          }
          return true
        }
        if (this.onComplete) this.onComplete()
        return false
      }
      return true
    }
  }

  // 同时兼容两种签名：
  //   TweenMax.to(target, duration, vars)        —— TweenMax 经典三参数
  //   TweenMax.to(target, { duration, ...vars }) —— GSAP 风格（duration 写在 vars 里）
  const norm = (d, v) => (typeof d === 'object' && d !== null ? [d.duration ?? 1, d] : [d, v])

  const TweenMax = {
    to: (t, d, v) => new Tween(t, ...norm(d, v), false),
    from: (t, d, v) => new Tween(t, ...norm(d, v), true),
    killTweensOf: (t) => {
      for (const tw of activeTweens) {
        if (tw.targets.includes(t)) activeTweens.delete(tw)
      }
    }
  }

  function updateTweens(dt) {
    for (const tw of [...activeTweens]) {
      if (!tw.step(dt)) activeTweens.delete(tw)
    }
  }

  function clearTweens() {
    activeTweens.clear()
  }

  return { Ease, TweenMax, updateTweens, clearTweens }
}
