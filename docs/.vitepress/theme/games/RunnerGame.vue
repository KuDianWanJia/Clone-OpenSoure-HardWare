<script setup>
// 兔子快跑 —— 移植自 Yakudoo 的 CodePen「Mad Rabbit」(https://codepen.io/Yakudoo/pen/YGxYej)：
// 低多边形球形星球跑酷。点击 / 空格跳跃，吃胡萝卜拉开与黑怪兽的距离，撞到刺猬会被追上。
// 原作依赖旧版 three（Geometry/CubeGeometry）+ GSAP(TweenMax) + 外部 mp3，
// 这里适配 three@0.177（BoxGeometry + BufferGeometry 顶点编辑）、内置迷你缓动引擎、去掉音频，零新增依赖。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { withBase } from 'vitepress'
import * as THREE from 'three'

const container = ref(null)
const distText = ref('000')
const showGameOver = ref(false)

// ---------------- 游戏常量 ----------------
const FLOOR_RADIUS = 200
const INIT_SPEED = 5
const MAX_SPEED = 48
const LEVEL_UPDATE_FREQ = 3000
const MONSTER_ACCEL = 0.004
const COLLIDE_OBSTACLE = 10
const COLLIDE_BONUS = 20
const CAM_POS_GAME = 160
const CAM_POS_OVER = 260
const MALUS_COLOR = 0xb44b39

// ---------------- 可变状态（G 的属性供缓动引擎读写） ----------------
const G = { speed: 6, malusClearAlpha: 0 }
let scene, camera, renderer, clock
let floor, hero, monster, carrot, obstacle, bonusParticles
let delta = 0
let distance = 0
let level = 1
let levelInterval = null
let monsterPos = 0.65
let monsterPosTarget = 0.65
let floorRotation = 0
let gameStatus = 'play'
let rafId = 0
let disposed = false

// ---------------- 迷你缓动引擎（TweenMax 子集：to/from/killTweensOf、delay、ease、yoyo、repeat、+= 相对值） ----------------
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
  }
}
const SKIP_KEYS = ['ease', 'delay', 'onComplete', 'onUpdate', 'yoyo', 'repeat']
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

  // 延迟到首次激活时才捕获起始值（与 GSAP 一致，链式跳跃动画依赖这个行为）
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

const TweenMax = {
  to: (t, d, v) => new Tween(t, d, v, false),
  from: (t, d, v) => new Tween(t, d, v, true),
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

// ---------------- 材质（低多边形平直着色） ----------------
const blackMat = new THREE.MeshPhongMaterial({ color: 0x100707, flatShading: true })
const brownMat = new THREE.MeshPhongMaterial({ color: 0xb44b39, shininess: 0, flatShading: true })
const greenMat = new THREE.MeshPhongMaterial({ color: 0x7abf8e, shininess: 0, flatShading: true })
const pinkMat = new THREE.MeshPhongMaterial({ color: 0xdc5f45, shininess: 0, flatShading: true })
const lightBrownMat = new THREE.MeshPhongMaterial({ color: 0xe07a57, flatShading: true })
const whiteMat = new THREE.MeshPhongMaterial({ color: 0xa49789, flatShading: true })

// ---------------- BufferGeometry 顶点编辑辅助 ----------------
// 规则只依赖顶点位置，索引/非索引几何体都能保持水密
function editVerts(geom, fn) {
  const pos = geom.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    fn(v, i)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geom.computeVertexNormals()
}

// 收集去重后的顶点（供随机挂果实/树枝用）
function uniqueVerts(geom) {
  const pos = geom.attributes.position
  const seen = new Set()
  const out = []
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v.clone())
  }
  return out
}

// ---------------- 兔子主角 ----------------
class Hero {
  constructor() {
    this.status = 'running'
    this.runningCycle = 0
    this.mesh = new THREE.Group()
    this.body = new THREE.Group()
    this.mesh.add(this.body)

    const torsoGeom = new THREE.BoxGeometry(7, 7, 10, 1)
    this.torso = new THREE.Mesh(torsoGeom, brownMat)
    this.torso.position.y = 7
    this.torso.castShadow = true
    this.body.add(this.torso)

    const pantsGeom = new THREE.BoxGeometry(9, 9, 5, 1)
    this.pants = new THREE.Mesh(pantsGeom, whiteMat)
    this.pants.position.z = -3
    this.pants.castShadow = true
    this.torso.add(this.pants)

    const tailGeom = new THREE.BoxGeometry(3, 3, 3, 1)
    tailGeom.translate(0, 0, -2)
    this.tail = new THREE.Mesh(tailGeom, lightBrownMat)
    this.tail.position.z = -4
    this.tail.position.y = 5
    this.tail.castShadow = true
    this.torso.add(this.tail)

    this.torso.rotation.x = -Math.PI / 8

    const headGeom = new THREE.BoxGeometry(10, 10, 13, 1)
    headGeom.translate(0, 0, 7.5)
    this.head = new THREE.Mesh(headGeom, brownMat)
    this.head.position.z = 2
    this.head.position.y = 11
    this.head.castShadow = true
    this.body.add(this.head)

    const cheekGeom = new THREE.BoxGeometry(1, 4, 4, 1)
    this.cheekR = new THREE.Mesh(cheekGeom, pinkMat)
    this.cheekR.position.set(-5, -2.5, 7)
    this.cheekR.castShadow = true
    this.head.add(this.cheekR)

    this.cheekL = this.cheekR.clone()
    this.cheekL.position.x = -this.cheekR.position.x
    this.head.add(this.cheekL)

    const noseGeom = new THREE.BoxGeometry(6, 6, 3, 1)
    this.nose = new THREE.Mesh(noseGeom, lightBrownMat)
    this.nose.position.z = 13.5
    this.nose.position.y = 2.6
    this.nose.castShadow = true
    this.head.add(this.nose)

    const mouthGeom = new THREE.BoxGeometry(4, 2, 4, 1)
    mouthGeom.translate(0, 0, 3)
    mouthGeom.rotateX(Math.PI / 12)
    this.mouth = new THREE.Mesh(mouthGeom, brownMat)
    this.mouth.position.z = 8
    this.mouth.position.y = -4
    this.mouth.castShadow = true
    this.head.add(this.mouth)

    const pawFGeom = new THREE.BoxGeometry(3, 3, 3, 1)
    this.pawFR = new THREE.Mesh(pawFGeom, lightBrownMat)
    this.pawFR.position.set(-2, 1.5, 6)
    this.pawFR.castShadow = true
    this.body.add(this.pawFR)

    this.pawFL = this.pawFR.clone()
    this.pawFL.position.x = -this.pawFR.position.x
    this.body.add(this.pawFL)

    const pawBGeom = new THREE.BoxGeometry(3, 3, 6, 1)
    this.pawBL = new THREE.Mesh(pawBGeom, lightBrownMat)
    this.pawBL.position.set(5, 1.5, 0)
    this.pawBL.castShadow = true
    this.body.add(this.pawBL)

    this.pawBR = this.pawBL.clone()
    this.pawBR.position.x = -this.pawBL.position.x
    this.body.add(this.pawBR)

    // 耳朵：顶部顶点向外张开（等价于旧版 Geometry 按索引改顶点的效果）
    const earGeom = new THREE.BoxGeometry(7, 18, 2, 1)
    editVerts(earGeom, (v) => {
      if (v.y > 0) {
        v.x += 2 * Math.sign(v.x)
        v.z += 0.5 * Math.sign(v.z)
      }
    })
    earGeom.translate(0, 9, 0)

    this.earL = new THREE.Mesh(earGeom, brownMat)
    this.earL.position.set(2, 5, 2.5)
    this.earL.rotation.z = -Math.PI / 12
    this.earL.castShadow = true
    this.head.add(this.earL)

    this.earR = this.earL.clone()
    this.earR.position.x = -this.earL.position.x
    this.earR.rotation.z = -this.earL.rotation.z
    this.head.add(this.earR)

    const eyeGeom = new THREE.BoxGeometry(2, 4, 4)
    this.eyeL = new THREE.Mesh(eyeGeom, whiteMat)
    this.eyeL.position.set(5, 2.9, 5.5)
    this.eyeL.castShadow = true
    this.head.add(this.eyeL)

    const irisGeom = new THREE.BoxGeometry(0.6, 2, 2)
    this.iris = new THREE.Mesh(irisGeom, blackMat)
    this.iris.position.set(1.2, 1, 1)
    this.eyeL.add(this.iris)

    this.eyeR = this.eyeL.clone()
    this.eyeR.children[0].position.x = -this.iris.position.x
    this.eyeR.position.x = -this.eyeL.position.x
    this.head.add(this.eyeR)

    this.body.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }

  run() {
    this.status = 'running'
    const s = Math.min(G.speed, MAX_SPEED)
    this.runningCycle += delta * s * 0.7
    this.runningCycle = this.runningCycle % (Math.PI * 2)
    const t = this.runningCycle
    const amp = 4
    const disp = 0.2

    // 身体起伏
    this.body.position.y = 6 + Math.sin(t - Math.PI / 2) * amp
    this.body.rotation.x = 0.2 + Math.sin(t - Math.PI / 2) * amp * 0.1

    this.torso.rotation.x = Math.sin(t - Math.PI / 2) * amp * 0.1
    this.torso.position.y = 7 + Math.sin(t - Math.PI / 2) * amp * 0.5

    // 嘴
    this.mouth.rotation.x = Math.PI / 16 + Math.cos(t) * amp * 0.05

    // 头
    this.head.position.z = 2 + Math.sin(t - Math.PI / 2) * amp * 0.5
    this.head.position.y = 8 + Math.cos(t - Math.PI / 2) * amp * 0.7
    this.head.rotation.x = -0.2 + Math.sin(t + Math.PI) * amp * 0.1

    // 耳朵
    this.earL.rotation.x = Math.cos(-Math.PI / 2 + t) * (amp * 0.2)
    this.earR.rotation.x = Math.cos(-Math.PI / 2 + 0.2 + t) * (amp * 0.3)

    // 眼睛眨动
    this.eyeR.scale.y = this.eyeL.scale.y = 0.7 + Math.abs(Math.cos(-Math.PI / 4 + t * 0.5)) * 0.6

    // 尾巴
    this.tail.rotation.x = Math.cos(Math.PI / 2 + t) * amp * 0.3

    // 四蹄迈步
    this.pawFR.position.y = 1.5 + Math.sin(t) * amp
    this.pawFR.rotation.x = Math.cos(t) * (Math.PI / 4)
    this.pawFR.position.z = 6 - Math.cos(t) * amp * 2

    this.pawFL.position.y = 1.5 + Math.sin(disp + t) * amp
    this.pawFL.rotation.x = Math.cos(t) * (Math.PI / 4)
    this.pawFL.position.z = 6 - Math.cos(disp + t) * amp * 2

    this.pawBR.position.y = 1.5 + Math.sin(Math.PI + t) * amp
    this.pawBR.rotation.x = Math.cos(t + Math.PI * 1.5) * (Math.PI / 3)
    this.pawBR.position.z = -Math.cos(Math.PI + t) * amp

    this.pawBL.position.y = 1.5 + Math.sin(Math.PI + t) * amp
    this.pawBL.rotation.x = Math.cos(t + Math.PI * 1.5) * (Math.PI / 3)
    this.pawBL.position.z = -Math.cos(Math.PI + t) * amp
  }

  jump() {
    if (this.status === 'jumping') return
    this.status = 'jumping'
    const totalSpeed = 10 / G.speed
    const jumpHeight = 45

    TweenMax.to(this.earL.rotation, totalSpeed, { x: '+=.3', ease: Ease.backOut })
    TweenMax.to(this.earR.rotation, totalSpeed, { x: '-=.3', ease: Ease.backOut })
    TweenMax.to(this.pawFL.rotation, totalSpeed, { x: '+=.7', ease: Ease.backOut })
    TweenMax.to(this.pawFR.rotation, totalSpeed, { x: '-=.7', ease: Ease.backOut })
    TweenMax.to(this.pawBL.rotation, totalSpeed, { x: '+=.7', ease: Ease.backOut })
    TweenMax.to(this.pawBR.rotation, totalSpeed, { x: '-=.7', ease: Ease.backOut })
    TweenMax.to(this.tail.rotation, totalSpeed, { x: '+=1', ease: Ease.backOut })
    TweenMax.to(this.mouth.rotation, totalSpeed, { x: 0.5, ease: Ease.backOut })
    TweenMax.to(this.mesh.position, totalSpeed / 2, { y: jumpHeight, ease: Ease.p2Out })
    TweenMax.to(this.mesh.position, totalSpeed / 2, {
      y: 0,
      ease: Ease.p4In,
      delay: totalSpeed / 2,
      onComplete: () => {
        this.status = 'running'
      }
    })
  }

  // 待机/被抓住时的随机小动作（自递归缓动链，通过 killTweensOf(head.rotation) 终止）
  nod() {
    const sp = 0.5 + Math.random()

    const tHeadRotY = -Math.PI / 6 + Math.random() * (Math.PI / 3)
    TweenMax.to(this.head.rotation, sp, {
      y: tHeadRotY,
      ease: Ease.p4InOut,
      onComplete: () => this.nod()
    })

    const tEarLRotX = Math.PI / 4 + Math.random() * (Math.PI / 6)
    const tEarRRotX = Math.PI / 4 + Math.random() * (Math.PI / 6)
    TweenMax.to(this.earL.rotation, sp, { x: tEarLRotX, ease: Ease.p4InOut })
    TweenMax.to(this.earR.rotation, sp, { x: tEarRRotX, ease: Ease.p4InOut })

    for (const paw of [this.pawBL, this.pawBR, this.pawFL, this.pawFR]) {
      const tRot = Math.random() * (Math.PI / 2)
      const tY = -4 + Math.random() * 8
      TweenMax.to(paw.rotation, sp / 2, { x: tRot, ease: Ease.p1InOut, yoyo: true, repeat: 2 })
      TweenMax.to(paw.position, sp / 2, { y: tY, ease: Ease.p1InOut, yoyo: true, repeat: 2 })
    }

    const tMouthRot = Math.random() * (Math.PI / 8)
    TweenMax.to(this.mouth.rotation, sp, { x: tMouthRot, ease: Ease.p1InOut })

    const tIrisY = -1 + Math.random() * 2
    const tIrisZ = -1 + Math.random() * 2
    TweenMax.to([this.iris.position, this.eyeR.children[0].position], sp, {
      y: tIrisY,
      z: tIrisZ,
      ease: Ease.p1InOut
    })

    if (Math.random() > 0.2) {
      TweenMax.to([this.eyeR.scale, this.eyeL.scale], sp / 8, {
        y: 0,
        ease: Ease.p1InOut,
        yoyo: true,
        repeat: 1
      })
    }
  }

  // 被怪兽叼在嘴里时的倒挂姿势
  hang() {
    const sp = 1
    const ease = Ease.p4Out

    TweenMax.killTweensOf(this.eyeL.scale)
    TweenMax.killTweensOf(this.eyeR.scale)

    this.body.rotation.x = 0
    this.torso.rotation.x = 0
    this.body.position.y = 0
    this.torso.position.y = 7

    TweenMax.to(this.mesh.rotation, sp, { y: 0, ease })
    TweenMax.to(this.mesh.position, sp, { y: -7, z: 6, ease })
    TweenMax.to(this.head.rotation, sp, {
      x: Math.PI / 6,
      ease,
      onComplete: () => this.nod()
    })

    TweenMax.to(this.earL.rotation, sp, { x: Math.PI / 3, ease })
    TweenMax.to(this.earR.rotation, sp, { x: Math.PI / 3, ease })

    TweenMax.to(this.pawFL.position, sp, { y: -1, z: 3, ease })
    TweenMax.to(this.pawFR.position, sp, { y: -1, z: 3, ease })
    TweenMax.to(this.pawBL.position, sp, { y: -2, z: -3, ease })
    TweenMax.to(this.pawBR.position, sp, { y: -2, z: -3, ease })

    TweenMax.to(this.eyeL.scale, sp, { y: 1, ease })
    TweenMax.to(this.eyeR.scale, sp, { y: 1, ease })
  }
}

// ---------------- 黑怪兽（追逐者） ----------------
class Monster {
  constructor() {
    this.runningCycle = 0
    this.mesh = new THREE.Group()
    this.body = new THREE.Group()

    const torsoGeom = new THREE.BoxGeometry(15, 15, 20, 1)
    this.torso = new THREE.Mesh(torsoGeom, blackMat)

    const headGeom = new THREE.BoxGeometry(20, 20, 40, 1)
    headGeom.translate(0, 0, 20)
    this.head = new THREE.Mesh(headGeom, blackMat)
    this.head.position.z = 12
    this.head.position.y = 2

    const mouthGeom = new THREE.BoxGeometry(10, 4, 20, 1)
    mouthGeom.translate(0, -2, 10)
    this.mouth = new THREE.Mesh(mouthGeom, blackMat)
    this.mouth.position.y = -8
    this.mouth.rotation.x = 0.4
    this.mouth.position.z = 4

    // 游戏结束时兔子被叼进嘴里
    this.heroHolder = new THREE.Group()
    this.heroHolder.position.z = 20
    this.mouth.add(this.heroHolder)

    // 牙齿：顶部顶点外张，像小尖牙
    const toothGeom = new THREE.BoxGeometry(2, 2, 1, 1)
    editVerts(toothGeom, (v) => {
      if (v.y > 0) v.x += Math.sign(v.x) * 1
    })

    for (let i = 0; i < 3; i++) {
      const toothf = new THREE.Mesh(toothGeom, whiteMat)
      toothf.position.x = -2.8 + i * 2.5
      toothf.position.y = 1
      toothf.position.z = 19

      const toothl = new THREE.Mesh(toothGeom, whiteMat)
      toothl.rotation.y = Math.PI / 2
      toothl.position.z = 12 + i * 2.5
      toothl.position.y = 1
      toothl.position.x = 4

      const toothr = toothl.clone()
      toothl.position.x = -4

      this.mouth.add(toothf)
      this.mouth.add(toothl)
      this.mouth.add(toothr)
    }

    const tongueGeometry = new THREE.BoxGeometry(6, 1, 14)
    tongueGeometry.translate(0, 0, 7)
    this.tongue = new THREE.Mesh(tongueGeometry, pinkMat)
    this.tongue.position.z = 2
    this.tongue.rotation.x = -0.2
    this.mouth.add(this.tongue)

    const noseGeom = new THREE.BoxGeometry(4, 4, 4, 1)
    this.nose = new THREE.Mesh(noseGeom, pinkMat)
    this.nose.position.z = 39.5
    this.nose.position.y = 9
    this.head.add(this.nose)

    this.head.add(this.mouth)

    const eyeGeom = new THREE.BoxGeometry(2, 3, 3)
    this.eyeL = new THREE.Mesh(eyeGeom, whiteMat)
    this.eyeL.position.set(10, 5, 5)
    this.eyeL.castShadow = true
    this.head.add(this.eyeL)

    const irisGeom = new THREE.BoxGeometry(0.6, 1, 1)
    this.iris = new THREE.Mesh(irisGeom, blackMat)
    this.iris.position.set(1.2, -1, 1)
    this.eyeL.add(this.iris)

    this.eyeR = this.eyeL.clone()
    this.eyeR.children[0].position.x = -this.iris.position.x
    this.eyeR.position.x = -this.eyeL.position.x
    this.head.add(this.eyeR)

    // 耳朵：顶部顶点外张 + 略微后倾
    const earGeom = new THREE.BoxGeometry(8, 6, 2, 1)
    editVerts(earGeom, (v) => {
      if (v.y > 0) {
        v.x += 4 * Math.sign(v.x)
        v.z -= 2
      }
    })
    earGeom.translate(0, 3, 0)

    this.earL = new THREE.Mesh(earGeom, blackMat)
    this.earL.position.set(6, 10, 1)
    this.earL.castShadow = true
    this.head.add(this.earL)

    this.earR = this.earL.clone()
    this.earR.position.x = -this.earL.position.x
    this.earR.rotation.z = -this.earL.rotation.z
    this.head.add(this.earR)

    const tailGeom = new THREE.CylinderGeometry(5, 2, 20, 4, 1)
    tailGeom.translate(0, 10, 0)
    tailGeom.rotateX(-Math.PI / 2)
    tailGeom.rotateZ(Math.PI / 4)
    this.tail = new THREE.Mesh(tailGeom, blackMat)
    this.tail.position.z = -10
    this.tail.position.y = 4
    this.torso.add(this.tail)

    const pawGeom = new THREE.CylinderGeometry(1.5, 0, 10)
    pawGeom.translate(0, -5, 0)
    this.pawFL = new THREE.Mesh(pawGeom, blackMat)
    this.pawFL.position.set(5.5, -7.5, 8.5)
    this.torso.add(this.pawFL)

    this.pawFR = this.pawFL.clone()
    this.pawFR.position.x = -this.pawFL.position.x
    this.torso.add(this.pawFR)

    this.pawBR = this.pawFR.clone()
    this.pawBR.position.z = -this.pawFL.position.z
    this.torso.add(this.pawBR)

    this.pawBL = this.pawBR.clone()
    this.pawBL.position.x = this.pawFL.position.x
    this.torso.add(this.pawBL)

    this.mesh.add(this.body)
    this.torso.add(this.head)
    this.body.add(this.torso)

    this.torso.castShadow = true
    this.head.castShadow = true
    this.pawFL.castShadow = true
    this.pawFR.castShadow = true
    this.pawBL.castShadow = true
    this.pawBR.castShadow = true

    this.body.rotation.y = Math.PI / 2
  }

  run() {
    const s = Math.min(G.speed, MAX_SPEED)
    this.runningCycle += delta * s * 0.7
    this.runningCycle = this.runningCycle % (Math.PI * 2)
    const t = this.runningCycle

    this.pawFR.rotation.x = Math.sin(t) * (Math.PI / 4)
    this.pawFR.position.y = -5.5 - Math.sin(t)
    this.pawFR.position.z = 7.5 + Math.cos(t)

    this.pawFL.rotation.x = Math.sin(t + 0.4) * (Math.PI / 4)
    this.pawFL.position.y = -5.5 - Math.sin(t + 0.4)
    this.pawFL.position.z = 7.5 + Math.cos(t + 0.4)

    this.pawBL.rotation.x = Math.sin(t + 2) * (Math.PI / 4)
    this.pawBL.position.y = -5.5 - Math.sin(t + 3.8)
    this.pawBL.position.z = -7.5 + Math.cos(t + 3.8)

    this.pawBR.rotation.x = Math.sin(t + 2.4) * (Math.PI / 4)
    this.pawBR.position.y = -5.5 - Math.sin(t + 3.4)
    this.pawBR.position.z = -7.5 + Math.cos(t + 3.4)

    this.torso.rotation.x = Math.sin(t) * (Math.PI / 8)
    this.torso.position.y = 3 - Math.sin(t + Math.PI / 2) * 3

    this.head.rotation.x = -0.1 + Math.sin(-t - 1) * 0.4
    this.mouth.rotation.x = 0.2 + Math.sin(t + Math.PI + 0.3) * 0.4

    this.tail.rotation.x = 0.2 + Math.sin(t - Math.PI / 2)

    this.eyeR.scale.y = 0.5 + Math.sin(t + Math.PI) * 0.5
  }

  nod() {
    const sp = 1 + Math.random() * 2

    const tHeadRotY = -Math.PI / 3 + Math.random() * 0.5
    const tHeadRotX = Math.PI / 3 - 0.2 + Math.random() * 0.4
    TweenMax.to(this.head.rotation, sp, {
      x: tHeadRotX,
      y: tHeadRotY,
      ease: Ease.p4InOut,
      onComplete: () => this.nod()
    })

    TweenMax.to(this.tail.rotation, sp / 8, {
      y: -Math.PI / 4,
      ease: Ease.p1InOut,
      yoyo: true,
      repeat: 8
    })

    TweenMax.to([this.eyeR.scale, this.eyeL.scale], sp / 20, {
      y: 0,
      ease: Ease.p1InOut,
      yoyo: true,
      repeat: 1
    })
  }

  // 抓到兔子后坐下
  sit() {
    const sp = 1.2
    const ease = Ease.p4Out
    TweenMax.to(this.torso.rotation, sp, { x: -1.3, ease })
    TweenMax.to(this.torso.position, sp, {
      y: -5,
      ease,
      onComplete: () => {
        this.nod()
        gameStatus = 'readyToReplay'
      }
    })

    TweenMax.to(this.head.rotation, sp, { x: Math.PI / 3, y: -Math.PI / 3, ease })
    TweenMax.to(this.tail.rotation, sp, { x: 2, y: Math.PI / 4, ease })
    TweenMax.to(this.pawBL.rotation, sp, { x: -0.1, ease })
    TweenMax.to(this.pawBR.rotation, sp, { x: -0.1, ease })
    TweenMax.to(this.pawFL.rotation, sp, { x: 1, ease })
    TweenMax.to(this.pawFR.rotation, sp, { x: 1, ease })
    TweenMax.to(this.mouth.rotation, sp, { x: 0.3, ease })
    TweenMax.to(this.eyeL.scale, sp, { y: 1, ease })
    TweenMax.to(this.eyeR.scale, sp, { y: 1, ease })
  }
}

// ---------------- 胡萝卜（奖励） ----------------
class Carrot {
  constructor() {
    this.angle = 0
    this.mesh = new THREE.Group()

    // 底部边缘波浪形凹陷（等价旧版顶点改写的不规则感）
    const bodyGeom = new THREE.CylinderGeometry(5, 3, 10, 4, 1)
    editVerts(bodyGeom, (v) => {
      if (v.y < -4) v.y += Math.sin(Math.atan2(v.z, v.x) * 2 + 1) * 2.5
    })
    this.body = new THREE.Mesh(bodyGeom, pinkMat)

    // 叶子：顶部顶点外张
    const leafGeom = new THREE.BoxGeometry(5, 10, 1, 1)
    leafGeom.translate(0, 5, 0)
    editVerts(leafGeom, (v) => {
      if (v.y > 5) v.x += Math.sign(v.x) * 1
    })

    this.leaf1 = new THREE.Mesh(leafGeom, greenMat)
    this.leaf1.position.y = 7
    this.leaf1.rotation.z = 0.3
    this.leaf1.rotation.x = 0.2

    this.leaf2 = this.leaf1.clone()
    this.leaf2.scale.set(1, 1.3, 1)
    this.leaf2.position.y = 7
    this.leaf2.rotation.z = -0.3
    this.leaf2.rotation.x = -0.2

    this.mesh.add(this.body)
    this.mesh.add(this.leaf1)
    this.mesh.add(this.leaf2)

    this.body.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }
}

// ---------------- 刺猬（障碍） ----------------
class Hedgehog {
  constructor() {
    this.angle = 0
    this.status = 'ready'
    this.mesh = new THREE.Group()

    const bodyGeom = new THREE.BoxGeometry(6, 6, 6, 1)
    this.body = new THREE.Mesh(bodyGeom, blackMat)

    const headGeom = new THREE.BoxGeometry(5, 5, 7, 1)
    this.head = new THREE.Mesh(headGeom, lightBrownMat)
    this.head.position.z = 6
    this.head.position.y = -0.5

    const noseGeom = new THREE.BoxGeometry(1.5, 1.5, 1.5, 1)
    this.nose = new THREE.Mesh(noseGeom, blackMat)
    this.nose.position.z = 4
    this.nose.position.y = 2

    const eyeGeom = new THREE.BoxGeometry(1, 3, 3)
    this.eyeL = new THREE.Mesh(eyeGeom, whiteMat)
    this.eyeL.position.set(2.2, 0.8, -0.5)
    this.eyeL.castShadow = true
    this.head.add(this.eyeL)

    const irisGeom = new THREE.BoxGeometry(0.5, 1, 1)
    this.iris = new THREE.Mesh(irisGeom, blackMat)
    this.iris.position.set(0.5, 0.8, 0.8)
    this.eyeL.add(this.iris)

    this.eyeR = this.eyeL.clone()
    this.eyeR.children[0].position.x = -this.iris.position.x
    this.eyeR.position.x = -this.eyeL.position.x

    // 9 组尖刺，四个方向随机歪斜
    const spikeGeom = new THREE.BoxGeometry(0.5, 2, 0.5, 1)
    spikeGeom.translate(0, 1, 0)
    for (let i = 0; i < 9; i++) {
      const row = i % 3
      const col = Math.floor(i / 3)

      const sb = new THREE.Mesh(spikeGeom, blackMat)
      sb.rotation.x = -Math.PI / 2 + (Math.PI / 12) * row - 0.5 + Math.random()
      sb.position.set(-2 + col * 2, -2 + row * 2, -3)
      this.body.add(sb)

      const st = new THREE.Mesh(spikeGeom, blackMat)
      st.position.set(-2 + row * 2, 3, -2 + col * 2)
      st.rotation.z = Math.PI / 6 - (Math.PI / 6) * row - 0.5 + Math.random()
      this.body.add(st)

      const sr = new THREE.Mesh(spikeGeom, blackMat)
      sr.position.set(3, -2 + row * 2, -2 + col * 2)
      sr.rotation.z = -Math.PI / 2 + (Math.PI / 12) * row - 0.5 + Math.random()
      this.body.add(sr)

      const sl = new THREE.Mesh(spikeGeom, blackMat)
      sl.position.set(-3, -2 + row * 2, -2 + col * 2)
      sl.rotation.z = Math.PI / 2 - (Math.PI / 12) * row - 0.5 + Math.random()
      this.body.add(sl)
    }

    this.head.add(this.eyeR)

    const earGeom = new THREE.BoxGeometry(2, 2, 0.5, 1)
    this.earL = new THREE.Mesh(earGeom, lightBrownMat)
    this.earL.position.set(2.5, 2.5, -2.5)
    this.earL.rotation.z = -Math.PI / 12
    this.earL.castShadow = true
    this.head.add(this.earL)

    this.earR = this.earL.clone()
    this.earR.position.x = -this.earL.position.x
    this.earR.rotation.z = -this.earL.rotation.z
    this.head.add(this.earR)

    const mouthGeom = new THREE.BoxGeometry(1, 1, 0.5, 1)
    this.mouth = new THREE.Mesh(mouthGeom, blackMat)
    this.mouth.position.z = 3.5
    this.mouth.position.y = -1.5
    this.head.add(this.mouth)

    this.mesh.add(this.body)
    this.body.add(this.head)
    this.head.add(this.nose)

    this.mesh.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
  }

  nod() {
    const sp = 0.1 + Math.random() * 0.5
    const angle = -Math.PI / 4 + Math.random() * (Math.PI / 2)
    TweenMax.to(this.head.rotation, sp, {
      y: angle,
      onComplete: () => this.nod()
    })
  }
}

// ---------------- 吃胡萝卜时的爆裂粒子 ----------------
class BonusParticles {
  constructor() {
    this.mesh = new THREE.Group()
    const bigParticleGeom = new THREE.BoxGeometry(10, 10, 10, 1)
    const smallParticleGeom = new THREE.BoxGeometry(5, 5, 5, 1)
    this.parts = []
    for (let i = 0; i < 10; i++) {
      const partPink = new THREE.Mesh(bigParticleGeom, pinkMat)
      const partGreen = new THREE.Mesh(smallParticleGeom, greenMat)
      partGreen.scale.set(0.5, 0.5, 0.5)
      this.parts.push(partPink)
      this.parts.push(partGreen)
      this.mesh.add(partPink)
      this.mesh.add(partGreen)
    }
  }

  explose() {
    const explosionSpeed = 0.5
    for (const p of this.parts) {
      const tx = -50 + Math.random() * 100
      const ty = -50 + Math.random() * 100
      const tz = -50 + Math.random() * 100
      p.position.set(0, 0, 0)
      p.scale.set(1, 1, 1)
      p.visible = true
      const s = explosionSpeed + Math.random() * 0.5
      TweenMax.to(p.position, s, { x: tx, y: ty, z: tz, ease: Ease.p4Out })
      TweenMax.to(p.scale, s, {
        x: 0.01,
        y: 0.01,
        z: 0.01,
        ease: Ease.p4Out,
        onComplete: () => {
          p.visible = false
        }
      })
    }
  }
}

// ---------------- 星球上的树（黑色扭曲树干 + 随机果实/树枝） ----------------
const TREE_MATS = [blackMat, brownMat, pinkMat, whiteMat, greenMat, lightBrownMat, pinkMat]

class Tree {
  constructor() {
    this.mesh = new THREE.Object3D()
    const truncHeight = 50 + Math.random() * 150
    const topRadius = 1 + Math.random() * 5
    const bottomRadius = 5 + Math.random() * 5
    const geom = new THREE.CylinderGeometry(topRadius, bottomRadius, truncHeight, 3, 3)
    geom.translate(0, truncHeight / 2, 0)

    // 顶点随机抖动（低多边形手绘感；同位置顶点共享同一份抖动保持水密）
    const jitterCache = new Map()
    editVerts(geom, (v) => {
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
      if (!jitterCache.has(key)) {
        const n = Math.random()
        jitterCache.set(key, {
          x: -n + Math.random() * n * 2,
          y: -n + Math.random() * n * 2,
          z: -n + Math.random() * n * 2
        })
      }
      const j = jitterCache.get(key)
      v.x += j.x
      v.y += j.y
      v.z += j.z
    })

    const trunc = new THREE.Mesh(geom, blackMat)

    for (const v of uniqueVerts(geom)) {
      // 果实
      if (Math.random() > 0.7) {
        const size = Math.random() * 3
        const fruitGeometry = new THREE.BoxGeometry(size, size, size, 1)
        const matFruit = TREE_MATS[Math.floor(Math.random() * TREE_MATS.length)]
        const fruit = new THREE.Mesh(fruitGeometry, matFruit)
        fruit.position.set(v.x, v.y + 3, v.z)
        fruit.rotation.x = Math.random() * Math.PI
        fruit.rotation.y = Math.random() * Math.PI
        trunc.add(fruit)
      }
      // 树枝
      if (Math.random() > 0.5 && v.y > 10 && v.y < truncHeight - 10) {
        const h = 3 + Math.random() * 5
        const thickness = 0.2 + Math.random()
        const branchGeometry = new THREE.CylinderGeometry(thickness / 2, thickness, h, 3, 1)
        branchGeometry.translate(0, h / 2, 0)
        const branch = new THREE.Mesh(branchGeometry, blackMat)
        branch.position.set(v.x, v.y, v.z)
        const vec = new THREE.Vector3(v.x, 2, v.z)
        branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize())
        trunc.add(branch)
      }
    }

    trunc.castShadow = true
    this.mesh.add(trunc)
  }
}

// ---------------- 场景搭建 ----------------
function createLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.9))

  const shadowLight = new THREE.DirectionalLight(0xffffff, 1)
  shadowLight.position.set(-30, 40, 20)
  shadowLight.castShadow = true
  shadowLight.shadow.camera.left = -400
  shadowLight.shadow.camera.right = 400
  shadowLight.shadow.camera.top = 400
  shadowLight.shadow.camera.bottom = -400
  shadowLight.shadow.camera.near = 1
  shadowLight.shadow.camera.far = 2000
  shadowLight.shadow.mapSize.width = 2048
  shadowLight.shadow.mapSize.height = 2048
  scene.add(shadowLight)
}

function createFloor() {
  const floorShadow = new THREE.Mesh(
    new THREE.SphereGeometry(FLOOR_RADIUS, 50, 50),
    new THREE.MeshPhongMaterial({
      color: 0x7abf8e,
      specular: 0x000000,
      shininess: 1,
      transparent: true,
      opacity: 0.5
    })
  )
  floorShadow.receiveShadow = true

  const floorGrass = new THREE.Mesh(
    new THREE.SphereGeometry(FLOOR_RADIUS - 0.5, 50, 50),
    new THREE.MeshBasicMaterial({ color: 0x7abf8e })
  )

  floor = new THREE.Group()
  floor.position.y = -FLOOR_RADIUS
  floor.add(floorShadow)
  floor.add(floorGrass)
  scene.add(floor)
}

function createFirs() {
  const nTrees = 100
  for (let i = 0; i < nTrees; i++) {
    const phi = (i * Math.PI * 2) / nTrees
    let theta = Math.PI / 2
    // 大部分树长在星球背面，少量探到跑道上
    theta += Math.random() > 0.05 ? 0.25 + Math.random() * 0.3 : -0.35 - Math.random() * 0.1

    const tree = new Tree()
    tree.mesh.position.x = Math.sin(theta) * Math.cos(phi) * FLOOR_RADIUS
    tree.mesh.position.y = Math.sin(theta) * Math.sin(phi) * (FLOOR_RADIUS - 10)
    tree.mesh.position.z = Math.cos(theta) * FLOOR_RADIUS

    const vec = tree.mesh.position.clone()
    tree.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vec.clone().normalize())
    floor.add(tree.mesh)
  }
}

// ---------------- 游戏逻辑 ----------------
function updateMonsterPosition() {
  monster.run()
  monsterPosTarget -= delta * MONSTER_ACCEL
  monsterPos += (monsterPosTarget - monsterPos) * delta
  if (monsterPos < 0.56) {
    gameOver()
    return
  }
  const angle = Math.PI * monsterPos
  monster.mesh.position.y = -FLOOR_RADIUS + Math.sin(angle) * (FLOOR_RADIUS + 12)
  monster.mesh.position.x = Math.cos(angle) * (FLOOR_RADIUS + 15)
  monster.mesh.rotation.z = -Math.PI / 2 + angle
}

function updateCarrotPosition() {
  carrot.mesh.rotation.y += delta * 6
  carrot.mesh.rotation.z = Math.PI / 2 - (floorRotation + carrot.angle)
  carrot.mesh.position.y = -FLOOR_RADIUS + Math.sin(floorRotation + carrot.angle) * (FLOOR_RADIUS + 50)
  carrot.mesh.position.x = Math.cos(floorRotation + carrot.angle) * (FLOOR_RADIUS + 50)
}

function updateObstaclePosition() {
  if (obstacle.status === 'flying') return
  // 刺猬滚过头顶后，重新埋到前方跑道上
  if (floorRotation + obstacle.angle > 2.5) {
    obstacle.angle = -floorRotation + Math.random() * 0.3
    obstacle.body.rotation.y = Math.random() * Math.PI * 2
  }
  obstacle.mesh.rotation.z = floorRotation + obstacle.angle - Math.PI / 2
  obstacle.mesh.position.y = -FLOOR_RADIUS + Math.sin(floorRotation + obstacle.angle) * (FLOOR_RADIUS + 3)
  obstacle.mesh.position.x = Math.cos(floorRotation + obstacle.angle) * (FLOOR_RADIUS + 3)
}

function updateFloorRotation() {
  floorRotation += delta * 0.03 * G.speed
  floorRotation = floorRotation % (Math.PI * 2)
  floor.rotation.z = floorRotation
}

function updateDistance() {
  distance += delta * G.speed
  distText.value = String(Math.floor(distance / 2)).padStart(3, '0')
}

function updateLevel() {
  if (G.speed >= MAX_SPEED) return
  level++
  G.speed += 2
}

const tmpVec = new THREE.Vector3()
function checkCollision() {
  const db = tmpVec.copy(hero.mesh.position).sub(carrot.mesh.position).length()
  if (db < COLLIDE_BONUS) getBonus()
  const dm = tmpVec.copy(hero.mesh.position).sub(obstacle.mesh.position).length()
  if (dm < COLLIDE_OBSTACLE && obstacle.status !== 'flying') getMalus()
}

function getBonus() {
  bonusParticles.mesh.position.copy(carrot.mesh.position)
  bonusParticles.mesh.visible = true
  bonusParticles.explose()
  carrot.angle += Math.PI / 2
  monsterPosTarget += 0.025
}

function getMalus() {
  obstacle.status = 'flying'
  const tx = Math.random() > 0.5 ? -20 - Math.random() * 10 : 20 + Math.random() * 5
  TweenMax.to(obstacle.mesh.position, 4, {
    x: tx,
    y: Math.random() * 50,
    z: 350,
    ease: Ease.p4Out
  })
  TweenMax.to(obstacle.mesh.rotation, 4, {
    x: Math.PI * 3,
    z: Math.PI * 3,
    y: Math.PI * 6,
    ease: Ease.p4Out,
    onComplete: () => {
      obstacle.status = 'ready'
      obstacle.body.rotation.y = Math.random() * Math.PI * 2
      obstacle.angle = (-floorRotation - Math.random() * 0.4) % (Math.PI * 2)
      obstacle.mesh.rotation.set(0, 0, 0)
      obstacle.mesh.position.z = 0
    }
  })
  monsterPosTarget -= 0.04
  // 红屏惩罚闪烁
  G.malusClearAlpha = 0.5
  TweenMax.to(G, 0.5, {
    malusClearAlpha: 0,
    ease: Ease.p1Out,
    onUpdate: () => renderer.setClearColor(MALUS_COLOR, G.malusClearAlpha)
  })
}

function gameOver() {
  showGameOver.value = true
  gameStatus = 'gameOver'
  monster.sit()
  hero.hang()
  monster.heroHolder.add(hero.mesh)
  TweenMax.to(G, 1, { speed: 0 })
  TweenMax.to(camera.position, 3, { z: CAM_POS_OVER, y: 60, x: -30 })
  carrot.mesh.visible = false
  obstacle.mesh.visible = false
  clearInterval(levelInterval)
}

function replay() {
  gameStatus = 'preparingToReplay'
  showGameOver.value = false

  TweenMax.killTweensOf(monster.pawFL.position)
  TweenMax.killTweensOf(monster.pawFR.position)
  TweenMax.killTweensOf(monster.pawBL.position)
  TweenMax.killTweensOf(monster.pawBR.position)
  TweenMax.killTweensOf(monster.pawFL.rotation)
  TweenMax.killTweensOf(monster.pawFR.rotation)
  TweenMax.killTweensOf(monster.pawBL.rotation)
  TweenMax.killTweensOf(monster.pawBR.rotation)
  TweenMax.killTweensOf(monster.tail.rotation)
  TweenMax.killTweensOf(monster.head.rotation)
  TweenMax.killTweensOf(monster.eyeL.scale)
  TweenMax.killTweensOf(monster.eyeR.scale)

  monster.tail.rotation.y = 0

  TweenMax.to(camera.position, 3, { z: CAM_POS_GAME, x: 0, y: 30, ease: Ease.p4InOut })
  TweenMax.to(monster.torso.rotation, 2, { x: 0, ease: Ease.p4InOut })
  TweenMax.to(monster.torso.position, 2, { y: 0, ease: Ease.p4InOut })
  TweenMax.to(monster.pawFL.rotation, 2, { x: 0, ease: Ease.p4InOut })
  TweenMax.to(monster.pawFR.rotation, 2, { x: 0, ease: Ease.p4InOut })
  TweenMax.to(monster.head.rotation, 2, { y: 0, x: -0.3, ease: Ease.p4InOut })

  TweenMax.to(hero.mesh.position, 2, { x: 20, ease: Ease.p4InOut })
  TweenMax.to(hero.head.rotation, 2, { x: 0, y: 0, ease: Ease.p4InOut })
  TweenMax.to(monster.mouth.rotation, 2, { x: 0.2, ease: Ease.p4InOut })
  TweenMax.to(monster.mouth.rotation, 1, {
    x: 0.4,
    ease: Ease.p4In,
    delay: 1,
    onComplete: () => resetGame()
  })
}

function resetGame() {
  scene.add(hero.mesh)
  hero.mesh.rotation.y = Math.PI / 2
  hero.mesh.position.set(0, 0, 0)

  monsterPos = 0.56
  monsterPosTarget = 0.65
  G.speed = INIT_SPEED
  level = 0
  distance = 0
  carrot.mesh.visible = true
  obstacle.mesh.visible = true
  gameStatus = 'play'
  hero.status = 'running'
  // 防止多次重开后 nod 缓动链叠加
  TweenMax.killTweensOf(hero.head.rotation)
  hero.nod()
  updateLevel()
  clearInterval(levelInterval)
  levelInterval = setInterval(updateLevel, LEVEL_UPDATE_FREQ)
}

// ---------------- 主循环 ----------------
function loop() {
  if (disposed) return
  rafId = requestAnimationFrame(loop)
  delta = Math.min(clock.getDelta(), 0.1)
  updateTweens(delta)
  updateFloorRotation()

  if (gameStatus === 'play') {
    if (hero.status === 'running') hero.run()
    updateDistance()
    updateMonsterPosition()
    updateCarrotPosition()
    updateObstaclePosition()
    checkCollision()
  }

  renderer.render(scene, camera)
}

// ---------------- 输入 ----------------
function onAction() {
  if (disposed) return
  if (gameStatus === 'play') hero.jump()
  else if (gameStatus === 'readyToReplay') replay()
}

function onKeydown(e) {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault()
    onAction()
  }
}

function onResize() {
  if (!container.value || !renderer) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

// ---------------- 生命周期 ----------------
onMounted(() => {
  const el = container.value
  const w = el.clientWidth
  const h = el.clientHeight

  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xd6eae6, 160, 350)

  camera = new THREE.PerspectiveCamera(50, w / h, 1, 2000)
  camera.position.set(0, 30, CAM_POS_GAME)
  camera.lookAt(new THREE.Vector3(0, 30, 0))

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(MALUS_COLOR, G.malusClearAlpha)
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  el.appendChild(renderer.domElement)

  clock = new THREE.Clock()

  createLights()
  createFloor()

  hero = new Hero()
  hero.mesh.rotation.y = Math.PI / 2
  scene.add(hero.mesh)

  monster = new Monster()
  monster.mesh.position.z = 20
  scene.add(monster.mesh)

  createFirs()

  carrot = new Carrot()
  scene.add(carrot.mesh)

  bonusParticles = new BonusParticles()
  bonusParticles.mesh.visible = false
  scene.add(bonusParticles.mesh)

  obstacle = new Hedgehog()
  obstacle.body.rotation.y = -Math.PI / 2
  obstacle.mesh.scale.set(1.1, 1.1, 1.1)
  obstacle.mesh.position.y = FLOOR_RADIUS + 4
  obstacle.nod()
  scene.add(obstacle.mesh)

  resetGame()
  loop()

  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  clearInterval(levelInterval)
  activeTweens.clear()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m.dispose())
      }
    })
    scene.clear()
  }
  hero = monster = carrot = obstacle = bonusParticles = floor = null
  scene = camera = renderer = clock = null
})
</script>

<template>
  <section class="runner-game">
    <div ref="container" class="stage" @mousedown="onAction" @touchend.prevent="onAction">
      <!-- 距离计分 -->
      <div v-show="!showGameOver" class="dist">
        <div class="label">distance</div>
        <div class="dist-value">{{ distText }}</div>
      </div>

      <!-- 游戏结束 -->
      <div class="gameover" :class="{ show: showGameOver }">Game Over</div>

      <!-- 操作提示 -->
      <div class="instructions">
        <template v-if="!showGameOver">
          点击 / 空格 跳跃<span class="light"> — 吃胡萝卜 · 躲刺猬 · 别被黑怪兽追上</span>
        </template>
        <template v-else>点击任意处重新开始</template>
      </div>

      <!-- 顶部角标 + 返回 -->
      <div class="overlay">
        <span class="badge">🐰 3D 跑酷小游戏</span>
        <a :href="withBase('/games/')" class="btn ghost">← 返回小游戏中心</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.runner-game {
  max-width: 1280px;
  margin: 24px auto 48px;
  padding: 0 24px;
}

.stage {
  position: relative;
  height: min(78vh, 760px);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #b9d2cf;
  /* 与原作一致的薄荷白天色（画布透明，雾色 0xd6eae6） */
  background: linear-gradient(180deg, #cfe4e6 0%, #dbe6e6 55%, #d9ead9 100%);
  box-shadow: 0 24px 60px -28px rgba(0, 0, 0, .45);
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}

.stage :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* ---- 计分 ---- */
.dist {
  position: absolute;
  left: 50%;
  top: 44px;
  transform: translateX(-50%);
  text-align: center;
  pointer-events: none;
}
.label {
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #ffa873;
  font-weight: 700;
  margin-bottom: 4px;
}
.dist-value {
  font-size: 42px;
  font-weight: 800;
  color: #dc5f45;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

/* ---- 游戏结束 ---- */
.gameover {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100%;
  transform: translate(-50%, -100%);
  text-align: center;
  font-size: clamp(48px, 9vw, 110px);
  font-weight: 800;
  text-transform: uppercase;
  color: #ffc5a2;
  opacity: 0;
  pointer-events: none;
  text-shadow: 0 4px 24px rgba(180, 75, 57, .35);
  transition: all .5s ease-in-out;
}
.gameover.show {
  opacity: 1;
  transform: translate(-50%, -50%);
}

/* ---- 操作提示 ---- */
.instructions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  text-align: center;
  font-size: 15px;
  letter-spacing: 1px;
  color: #dc5f45;
  font-weight: 600;
  pointer-events: none;
}
.instructions .light { color: #5f9042; }

/* ---- 顶部角标 + 返回 ---- */
.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 20px;
  pointer-events: none;
}
.badge {
  font-size: 12.5px;
  font-weight: 600;
  padding: 4px 13px;
  border-radius: 999px;
  color: #dc5f45;
  background: rgba(255, 255, 255, .65);
  border: 1px solid rgba(220, 95, 69, .35);
  backdrop-filter: blur(6px);
}
.btn {
  pointer-events: auto;
  display: inline-block;
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  transition: transform .16s ease, border-color .16s ease, color .16s ease;
}
.btn.ghost {
  color: #544027;
  background: rgba(255, 255, 255, .65);
  border: 1px solid rgba(84, 64, 39, .3);
  backdrop-filter: blur(6px);
}
.btn.ghost:hover {
  border-color: #dc5f45;
  color: #dc5f45;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .stage { height: 64vh; }
  .dist { top: 54px; }
  .dist-value { font-size: 32px; }
  .instructions { font-size: 12px; bottom: 14px; padding: 0 12px; }
  .instructions .light { display: none; }
  .badge { font-size: 11px; padding: 3px 9px; }
  .btn { padding: 6px 12px; font-size: 12px; }
}
</style>
