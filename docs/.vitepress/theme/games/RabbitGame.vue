<script setup>
// 兔子吃萝卜 —— 移植自 Yakudoo 的 CodePen「Rabbit & Carrot」(https://codepen.io/Yakudoo/pen/poqazQo)：
// 霓虹卡通兔在镜面地板上追胡萝卜。鼠标牵引兔子弹性移动，点击旋转跳跃，吃到胡萝卜爆粒子并重新刷新。
// 原作依赖 GLB 模型（assets.codepen.io 被 Cloudflare 拦截无法自托管），这里用 three 基元程序化重建同款兔子；
// GSAP 替换为共享迷你缓动引擎 ./tween.js，零新增依赖。地板拖尾/反射/描边着色器均来自原作。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { withBase } from 'vitepress'
import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { createTweenEngine } from './tween.js'

const container = ref(null)
const score = ref(0)

const { Ease, TweenMax, updateTweens, clearTweens } = createTweenEngine()

const BGR_COLOR = 0x332e2e
const FLOOR_SIZE = 30

let scene, camera, renderer, clock
let floor, rabbit, rabbitBody, earLeft, earRight, carrot
let line
let particles1 = []
let particles2 = []
let floorSimMat, bufferSim
let rafId = 0
let disposed = false
let time = 0

// 兔子运动状态
let heroAngularSpeed = 0
let heroOldRot = 0
let heroOldUVPos = new THREE.Vector2(0.5, 0.5)
let heroSpeed = new THREE.Vector2(0, 0)
let targetHeroUVPos = new THREE.Vector2(0.5, 0.5)
let targetHeroAbsMousePos = new THREE.Vector2(0, 0)
let isJumping = false
let isExploding = false
const jumpParams = { jumpProgress: 0 }
const raycaster = new THREE.Raycaster()
const mouseNDC = new THREE.Vector2()

// ---------------- 着色器（来自原作） ----------------
const reflectorVertexShader = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUvReflection;
  varying vec2 vUv;

  #include <common>
  #include <shadowmap_pars_vertex>
  #include <logdepthbuf_pars_vertex>

  void main() {
    #include <beginnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>

    vUvReflection = textureMatrix * vec4( position, 1.0 );
    vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

    #include <logdepthbuf_vertex>
    #include <worldpos_vertex>
    #include <shadowmap_vertex>
  }
`

const reflectorFragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform sampler2D tDiffuse;
  uniform sampler2D tScratches;
  varying vec4 vUvReflection;
  varying vec2 vUv;

  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  #include <logdepthbuf_pars_fragment>

  vec4 blur9(sampler2D image, vec4 uv, vec2 resolution, vec2 direction) {
    vec4 color = vec4(0.0);
    vec2 off1 = vec2(1.3846153846) * direction;
    vec2 off2 = vec2(3.2307692308) * direction;
    color += texture2DProj(image, uv) * 0.2270270270;
    color += texture2DProj(image, uv + vec4(off1 / resolution, off1 / resolution)) * 0.3162162162;
    color += texture2DProj(image, uv - vec4(off1 / resolution, off1 / resolution)) * 0.3162162162;
    color += texture2DProj(image, uv + vec4(off2 / resolution, off2 / resolution)) * 0.0702702703;
    color += texture2DProj(image, uv - vec4(off2 / resolution, off2 / resolution)) * 0.0702702703;
    return color;
  }

  float blendOverlay( float base, float blend ) {
    return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );
  }

  vec3 blendOverlay( vec3 base, vec3 blend ) {
    return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );
  }

  void main() {
    #include <logdepthbuf_fragment>

    vec4 displacement = vec4( sin(vUvReflection.y * 3.) * .05, sin(vUvReflection.x * 3.) * .05, 0.0, 0.0);
    vec2 resolution = vec2(30., 30.);
    vec4 base = blur9( tDiffuse, vUvReflection + displacement, resolution, vec2(1., 0.) ) * .25;
    base += blur9( tDiffuse, vUvReflection + displacement, resolution, vec2(-1., 0.) ) * .25;
    base += blur9( tDiffuse, vUvReflection + displacement, resolution, vec2(0, 1.) ) * .25;
    base += blur9( tDiffuse, vUvReflection + displacement, resolution, vec2(0, -1.) ) * .25;

    vec4 scratchesCol = texture2D( tScratches, vUv);

    vec3 col = mix(color, base.rgb, .5);
    col.rgb += scratchesCol.r * .02;
    col.gb -= scratchesCol.g * .01;
    col.gb -= (1.0 - getShadowMask() ) * .015;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const simulationVertexShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
  }
`

const simulationFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D inputTexture;
  uniform vec2 blade1PosOld;
  uniform vec2 blade1PosNew;
  uniform float strength;
  varying vec2 vUv;

  float lineSegment(vec2 p, vec2 a, vec2 b, float thickness) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    float idk = length(pa - ba*h);
    return smoothstep(thickness, .2 * thickness, idk);
  }

  void main(void) {
    vec4 prevTexture = texture2D(inputTexture, vUv);
    vec3 col = prevTexture.rgb * .999;
    if (strength>0.){
      float space = .001;
      float crease = .001;
      float thickness = .001 + strength * .001;
      float leftRed = lineSegment(vUv + space, blade1PosOld, blade1PosNew, thickness);
      float leftGreen = lineSegment(vUv + space + crease, blade1PosOld, blade1PosNew, thickness);
      float rightRed = lineSegment(vUv - space - crease, blade1PosOld, blade1PosNew, thickness);
      float rightGreen = lineSegment(vUv - space, blade1PosOld, blade1PosNew, thickness);
      col.r += ( leftRed + rightRed ) * strength * 3.0;
      col.g += ( leftGreen + rightGreen) * strength * 3.0;
      col.r = clamp(col.r, .0, 1.0);
      col.g = clamp(col.g, .0, 1.0);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`

const outlineVertexShader = /* glsl */ `
  uniform float size;

  void main() {
    vec3 transformed = position + normal * size;
    vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
  }
`

const outlineFragmentShader = /* glsl */ `
  uniform vec3 color;
  void main(void) {
    gl_FragColor = vec4( color, 1.0);
  }
`

// ---------------- 材质 ----------------
let primMat, secMat, bonusMat, outlineMat

function createMaterials() {
  primMat = new THREE.MeshToonMaterial({ color: 0x7beeff })
  secMat = new THREE.MeshToonMaterial({ color: BGR_COLOR })
  bonusMat = new THREE.MeshToonMaterial({ color: 0xff3434 })

  outlineMat = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0x000000) },
      size: { value: 0.02 }
    },
    vertexShader: outlineVertexShader,
    fragmentShader: outlineFragmentShader,
    side: THREE.BackSide
  })
}

// 给网格加黑色描边（克隆为 BackSide 子网格）
function addOutline(origin) {
  const outline = origin.clone()
  outline.children = []
  outline.position.set(0, 0, 0)
  outline.rotation.set(0, 0, 0)
  outline.scale.set(1, 1, 1)
  outline.material = outlineMat
  origin.add(outline)
  return outline
}

// ---------------- 程序化兔子（替代原作的 rabbit6.glb） ----------------
function createRabbitModel() {
  rabbit = new THREE.Group()
  rabbitBody = new THREE.Group()
  rabbit.add(rabbitBody)

  // 身体
  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 18), primMat)
  bodyMesh.scale.set(1, 0.85, 1.1)
  bodyMesh.position.y = 0.55
  rabbitBody.add(bodyMesh)
  addOutline(bodyMesh)

  // 耳朵（pivot 在耳根，方便 rotation.x 摆动）
  const earGeom = new THREE.CapsuleGeometry(0.09, 0.5, 4, 8)
  earGeom.translate(0, 0.32, 0)
  const makeEar = (x) => {
    const pivot = new THREE.Group()
    pivot.position.set(x, 0.92, 0.05)
    const m = new THREE.Mesh(earGeom, primMat)
    m.rotation.z = -x * 0.6 // 轻微外八
    pivot.add(m)
    addOutline(m)
    rabbitBody.add(pivot)
    return pivot
  }
  earLeft = makeEar(0.2)
  earRight = makeEar(-0.2)

  // 尾巴
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), primMat)
  tail.position.set(0, 0.55, -0.55)
  rabbitBody.add(tail)
  addOutline(tail)

  // 脚
  const footGeom = new THREE.SphereGeometry(0.16, 12, 10)
  const makeFoot = (x) => {
    const f = new THREE.Mesh(footGeom, secMat)
    f.scale.set(1, 0.6, 1.5)
    f.position.set(x, 0.1, 0.18)
    rabbitBody.add(f)
    return f
  }
  makeFoot(0.28)
  makeFoot(-0.28)

  // 眼睛
  const eyeGeom = new THREE.SphereGeometry(0.07, 10, 8)
  const makeEye = (x) => {
    const e = new THREE.Mesh(eyeGeom, secMat)
    e.position.set(x, 0.72, 0.44)
    rabbitBody.add(e)
    return e
  }
  makeEye(0.2)
  makeEye(-0.2)

  rabbit.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  scene.add(rabbit)
}

// ---------------- 程序化胡萝卜 ----------------
function createCarrotModel() {
  carrot = new THREE.Group()

  // 锥形萝卜体（红），略微倾斜
  const bodyMesh = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 8), bonusMat)
  bodyMesh.rotation.x = Math.PI // 尖端朝下
  carrot.add(bodyMesh)
  addOutline(bodyMesh)

  // 两片叶子（青，与原作配色一致）
  const leafGeom = new THREE.BoxGeometry(0.06, 0.3, 0.06)
  leafGeom.translate(0, 0.15, 0)
  const leaf1 = new THREE.Mesh(leafGeom, primMat)
  leaf1.position.y = 0.28
  leaf1.rotation.z = 0.4
  carrot.add(leaf1)
  const leaf2 = new THREE.Mesh(leafGeom, primMat)
  leaf2.position.y = 0.28
  leaf2.rotation.z = -0.4
  leaf2.rotation.x = 0.3
  carrot.add(leaf2)

  carrot.rotation.z = 0.2
  carrot.rotation.x = 0.2

  carrot.traverse((o) => {
    if (o.isMesh) o.castShadow = true
  })
  scene.add(carrot)
}

// ---------------- 镜面地板 + 拖尾模拟 ----------------
function createFloor() {
  floor = new Reflector(new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE), {
    color: new THREE.Color(BGR_COLOR),
    textureWidth: 1024,
    textureHeight: 1024
  })
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  modifyFloorShader()
  scene.add(floor)
}

function modifyFloorShader() {
  const renderTarget = floor.getRenderTarget()
  const textureMatrix = floor.material.uniforms.textureMatrix

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib['common'],
    THREE.UniformsLib['shadowmap'],
    THREE.UniformsLib['lights'],
    floor.material.uniforms,
    { tScratches: { value: bufferSim.output.texture } }
  ])

  floor.material.lights = true
  floor.material.uniforms = uniforms
  floor.material.uniforms.tDiffuse.value = renderTarget.texture
  floor.material.uniforms.textureMatrix.value = textureMatrix.value
  floor.material.vertexShader = reflectorVertexShader
  floor.material.fragmentShader = reflectorFragmentShader
}

// 乒乓 FBO：把兔子的移动轨迹烧成地板纹理
class BufferSim {
  constructor(renderer, width, height, shader) {
    this.renderer = renderer
    this.shader = shader
    this.orthoScene = new THREE.Scene()
    const fbo = new THREE.WebGLRenderTarget(width, height, {
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      stencilBuffer: false,
      depthBuffer: false
    })
    fbo.texture.generateMipmaps = false

    this.fbos = [fbo, fbo.clone()]
    this.current = 0
    this.output = this.fbos[0]
    this.orthoCamera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, 0.00001, 1000)
    this.orthoQuad = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.shader)
    this.orthoScene.add(this.orthoQuad)
  }

  render() {
    this.shader.uniforms.inputTexture.value = this.fbos[this.current].texture
    this.current = 1 - this.current
    this.output = this.fbos[this.current]
    this.renderer.setRenderTarget(this.output)
    this.renderer.render(this.orthoScene, this.orthoCamera)
    this.renderer.setRenderTarget(null)
  }
}

function createSim() {
  floorSimMat = new THREE.ShaderMaterial({
    uniforms: {
      inputTexture: { value: null },
      blade1PosOld: { value: new THREE.Vector2(0.5, 0.5) },
      blade1PosNew: { value: new THREE.Vector2(0.5, 0.5) },
      strength: { value: 0.0 }
    },
    vertexShader: simulationVertexShader,
    fragmentShader: simulationFragmentShader
  })
  bufferSim = new BufferSim(renderer, 1024, 1024, floorSimMat)
}

// 鼠标到兔子的虚线牵引绳
function createLine() {
  const material = new THREE.LineDashedMaterial({
    color: 0x7beeff,
    linewidth: 1,
    scale: 1,
    dashSize: 0.2,
    gapSize: 0.1
  })
  const points = [new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(3, 0.2, 3)]
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  line = new THREE.Line(geometry, material)
  scene.add(line)
}

function createLight() {
  scene.add(new THREE.AmbientLight(0xffffff))

  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(1, 5, 1)
  light.castShadow = true
  light.shadow.mapSize.width = 512
  light.shadow.mapSize.height = 512
  light.shadow.camera.near = 0.5
  light.shadow.camera.far = 12
  light.shadow.camera.left = -12
  light.shadow.camera.right = 12
  light.shadow.camera.bottom = -12
  light.shadow.camera.top = 12
  light.shadow.radius = 3
  light.shadow.blurSamples = 4
  scene.add(light)
}

function createParticles() {
  const particleGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2, 1, 1, 1)
  for (let i = 0; i < 20; i++) {
    const m = new THREE.Mesh(particleGeom, bonusMat)
    m.scale.set(0, 0, 0)
    particles1.push(m)
    scene.add(m)
  }
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(particleGeom, primMat)
    m.scale.set(0, 0, 0)
    particles2.push(m)
    scene.add(m)
  }
}

// ---------------- 游戏逻辑 ----------------
function getShortestAngle(v) {
  let a = v % (Math.PI * 2)
  if (a < -Math.PI) a += Math.PI * 2
  else if (a > Math.PI) a -= Math.PI * 2
  return a
}

function constrain(v, vMin, vMax) {
  return Math.min(vMax, Math.max(vMin, v))
}

function jump() {
  if (isJumping) return
  isJumping = true
  const turns = Math.floor(heroSpeed.length() * 5) + 1
  const jumpDuration = 0.5 + turns * 0.2
  const targetRot = heroAngularSpeed > 0 ? Math.PI * 2 * turns : -Math.PI * 2 * turns

  // 身体按移动方向旋转 N 圈
  TweenMax.to(rabbitBody.rotation, {
    duration: jumpDuration,
    ease: Ease.linear,
    y: targetRot,
    onComplete: () => {
      rabbitBody.rotation.y = 0
    }
  })

  // 耳朵先扬后落
  TweenMax.to([earLeft.rotation, earRight.rotation], {
    duration: jumpDuration * 0.8,
    ease: Ease.p4Out,
    x: Math.PI / 4
  })
  TweenMax.to([earLeft.rotation, earRight.rotation], {
    duration: jumpDuration * 0.2,
    delay: jumpDuration * 0.8,
    ease: Ease.p4In,
    x: 0
  })

  // 上升段
  TweenMax.to(jumpParams, {
    duration: jumpDuration * 0.5,
    ease: Ease.p2Out,
    jumpProgress: 0.5,
    onUpdate: () => {
      const sin = Math.sin(jumpParams.jumpProgress * Math.PI)
      rabbit.position.y = Math.pow(sin, 4) * turns
    }
  })
  // 下落段
  TweenMax.to(jumpParams, {
    duration: jumpDuration * 0.5,
    ease: Ease.p2In,
    delay: jumpDuration * 0.5,
    jumpProgress: 1,
    onUpdate: () => {
      const sin = Math.sin(jumpParams.jumpProgress * Math.PI)
      rabbit.position.y = Math.pow(sin, 1) * turns
    },
    onComplete: () => {
      rabbit.position.y = 0
      jumpParams.jumpProgress = 0
      isJumping = false
    }
  })
}

function testCollision() {
  if (isExploding) return
  const distVec = rabbit.position.clone()
  distVec.y = 0
  const carrotPos = carrot.position.clone()
  carrotPos.y = 0
  distVec.sub(carrotPos)
  if (distVec.length() <= 1) {
    carrot.visible = false
    score.value++
    explode(carrot.position)
  }
}

function explode(pos) {
  isExploding = true
  const all = [...particles1, ...particles2]
  all.forEach((m, idx) => {
    m.position.set(pos.x, pos.y, pos.z)
    m.scale.set(2, 2, 2)
    TweenMax.to(m.position, {
      x: pos.x + (-0.5 + Math.random()) * 1.5,
      y: pos.y + (0.5 + Math.random()) * 1.5,
      z: pos.z + (-0.5 + Math.random()) * 1.5,
      duration: 1,
      ease: Ease.p4Out
    })
    TweenMax.to(m.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 1,
      ease: Ease.p4Out,
      // 原作在每个粒子上都回调，这里只在最后一个粒子上刷新胡萝卜
      onComplete: idx === all.length - 1 ? () => {
        spawnCarrot()
        isExploding = false
      } : undefined
    })
  })
}

function spawnCarrot() {
  const px = (Math.random() - 0.5) * 0.3
  const py = (Math.random() - 0.5) * 0.3
  const h = 0.2 + Math.random() * 1
  carrot.position.x = px * FLOOR_SIZE
  carrot.position.z = py * FLOOR_SIZE
  carrot.position.y = -1
  carrot.scale.set(0, 0, 0)
  carrot.visible = true

  TweenMax.to(carrot.scale, { duration: 1.5, ease: Ease.elasticOut, x: 1, y: 1, z: 1 })
  TweenMax.to(carrot.position, { duration: 1.5, ease: Ease.elasticOut, y: h })
}

function updateGame() {
  const dt = Math.min(clock.getDelta(), 0.3)
  time += dt
  updateTweens(dt)

  if (!rabbit || !line) return

  // 弹性牵引：兔子被鼠标虚线拉着走
  const constrainUVPosX = constrain(targetHeroUVPos.x - 0.5, -0.3, 0.3)
  const constrainUVPosY = constrain(targetHeroUVPos.y - 0.5, -0.3, 0.3)
  targetHeroAbsMousePos.x = constrainUVPosX * FLOOR_SIZE
  targetHeroAbsMousePos.y = -constrainUVPosY * FLOOR_SIZE

  const dx = targetHeroAbsMousePos.x - rabbit.position.x
  const dy = targetHeroAbsMousePos.y - rabbit.position.z

  const angle = Math.atan2(dy, dx)
  const ax = dx * dt * 0.5
  const ay = dy * dt * 0.5

  heroSpeed.x += ax
  heroSpeed.y += ay
  heroSpeed.x *= Math.pow(dt, 0.005)
  heroSpeed.y *= Math.pow(dt, 0.005)

  rabbit.position.x += heroSpeed.x
  rabbit.position.z += heroSpeed.y

  const targetRot = -angle + Math.PI / 2
  const heroDistance = Math.sqrt(dx * dx + dy * dy)
  if (heroDistance > 0.3) {
    rabbit.rotation.y += getShortestAngle(targetRot - rabbit.rotation.y) * 3 * dt
  }
  heroAngularSpeed = getShortestAngle(rabbit.rotation.y - heroOldRot)
  heroOldRot = rabbit.rotation.y

  // 速度越快耳朵越往后飘
  if (!isJumping) {
    earLeft.rotation.x = earRight.rotation.x = -heroSpeed.length() * 2
  }

  // 牵引虚线
  const p = line.geometry.attributes.position.array
  p[0] = targetHeroAbsMousePos.x
  p[2] = targetHeroAbsMousePos.y
  p[3] = rabbit.position.x
  p[4] = rabbit.position.y
  p[5] = rabbit.position.z
  line.geometry.attributes.position.needsUpdate = true
  line.computeLineDistances()

  // 地板拖尾模拟
  const heroNewUVPos = new THREE.Vector2(
    0.5 + rabbit.position.x / FLOOR_SIZE,
    0.5 - rabbit.position.z / FLOOR_SIZE
  )
  floorSimMat.uniforms.blade1PosNew.value = heroNewUVPos
  floorSimMat.uniforms.blade1PosOld.value = heroOldUVPos
  floorSimMat.uniforms.strength.value = isJumping ? 0 : 1 / (1 + heroSpeed.length() * 10)
  bufferSim.render()
  renderer.setRenderTarget(null)

  floor.material.uniforms.tScratches.value = bufferSim.output.texture
  heroOldUVPos = heroNewUVPos.clone()

  carrot.rotation.y += dt

  testCollision()
}

// ---------------- 输入 ----------------
function updateMouse(clientX, clientY) {
  const rect = container.value.getBoundingClientRect()
  mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1
  mouseNDC.y = -(((clientY - rect.top) / rect.height) * 2 - 1)
  if (!floor) return
  raycaster.setFromCamera(mouseNDC, camera)
  const intersects = raycaster.intersectObjects([floor])
  if (intersects.length > 0) {
    targetHeroUVPos.x = intersects[0].uv.x
    targetHeroUVPos.y = intersects[0].uv.y
  }
}

function onMouseMove(e) {
  updateMouse(e.clientX, e.clientY)
}

function onTouchMove(e) {
  if (e.touches.length === 1) {
    e.preventDefault()
    updateMouse(e.touches[0].pageX, e.touches[0].pageY)
  }
}

function onAction() {
  if (disposed || !rabbit) return
  jump()
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

function loop() {
  if (disposed) return
  rafId = requestAnimationFrame(loop)
  updateGame()
  renderer.render(scene, camera)
}

// ---------------- 生命周期 ----------------
onMounted(() => {
  const el = container.value
  const w = el.clientWidth
  const h = el.clientHeight

  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(BGR_COLOR, 13, 20)

  camera = new THREE.PerspectiveCamera(60, w / h, 1, 100)
  camera.position.set(0, 4, 8)
  camera.lookAt(new THREE.Vector3())
  scene.add(camera)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setClearColor(new THREE.Color(BGR_COLOR))
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.toneMapping = THREE.LinearToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap
  el.appendChild(renderer.domElement)

  clock = new THREE.Clock()

  createSim()
  createMaterials()
  createRabbitModel()
  createCarrotModel()
  createFloor()
  createLine()
  createLight()
  createParticles()
  spawnCarrot()

  loop()

  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)

  // 仅开发环境暴露调试状态（生产构建会被 tree-shake 掉）
  if (import.meta.env.DEV) {
    window.__rabbit = {
      jumpParams,
      rabbit,
      carrot,
      get isJumping() { return isJumping },
      get score() { return score.value }
    }
  }
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  clearTweens()
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
  particles1 = []
  particles2 = []
  floor = rabbit = rabbitBody = earLeft = earRight = carrot = line = null
  floorSimMat = bufferSim = null
  scene = camera = renderer = clock = null
})
</script>

<template>
  <section class="rabbit-game">
    <div
      ref="container"
      class="stage"
      @mousemove="onMouseMove"
      @touchmove.passive="false"
      @touchmove="onTouchMove"
      @mousedown="onAction"
      @touchend.prevent="onAction"
    >
      <!-- 计分 -->
      <div class="score">🥕 × {{ score }}</div>

      <!-- 操作提示 -->
      <div class="instructions">移动鼠标牵引兔子 · 点击 / 空格 跳跃</div>

      <!-- 顶部角标 + 返回 -->
      <div class="overlay">
        <span class="badge">🥕 3D 镜面小游戏</span>
        <a :href="withBase('/games/')" class="btn ghost">← 返回小游戏中心</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rabbit-game {
  max-width: 1280px;
  margin: 24px auto 48px;
  padding: 0 24px;
}

.stage {
  position: relative;
  height: min(78vh, 760px);
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid #4a4242;
  background: #332e2e;
  box-shadow: 0 24px 60px -28px rgba(0, 0, 0, .6);
  cursor: crosshair;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.stage :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* ---- 计分 ---- */
.score {
  position: absolute;
  left: 50%;
  top: 18px;
  transform: translateX(-50%);
  font-size: 26px;
  font-weight: 800;
  color: #7beeff;
  pointer-events: none;
  text-shadow: 0 2px 12px rgba(123, 238, 255, .35);
  font-variant-numeric: tabular-nums;
}

/* ---- 操作提示 ---- */
.instructions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  text-align: center;
  font-size: 14px;
  letter-spacing: 1px;
  color: rgba(123, 238, 255, .75);
  font-weight: 600;
  pointer-events: none;
}

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
  color: #7beeff;
  background: rgba(20, 18, 18, .6);
  border: 1px solid rgba(123, 238, 255, .3);
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
  color: #e8e2e2;
  background: rgba(20, 18, 18, .6);
  border: 1px solid rgba(232, 226, 226, .3);
  backdrop-filter: blur(6px);
}
.btn.ghost:hover {
  border-color: #7beeff;
  color: #7beeff;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .stage { height: 64vh; }
  .score { font-size: 20px; top: 52px; }
  .instructions { font-size: 12px; bottom: 14px; }
  .badge { font-size: 11px; padding: 3px 9px; }
  .btn { padding: 6px 12px; font-size: 12px; }
}
</style>
