import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/*
 * Data-driven 3D warehouse. Everything is generated from the layout API:
 * racks (position, rotation, bays, levels), bins and their stock. No artwork per customer.
 * Geometry constants must match backend LayoutMath.
 */
export const BAY_W = 2.7, DEPTH = 1.2, LH = 1.5, SLOT = 3.2

const ZONE_INFO = {
  LIQUID: { title: 'Liquid materials', icon: 'ti-droplet', bg: '#e8f0fd', fg: '#1e5bb8' },
  EQUIPMENT: { title: 'Equipment', icon: 'ti-settings', bg: '#e8f0fd', fg: '#1e4fa0' },
  SOLID: { title: 'Solid storage', icon: 'ti-stack-2', bg: '#fff5e5', fg: '#d97706' }
}

function makeTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
const cartonDraw = base => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(w * .44, 0, w * .12, h)
  g.strokeStyle = 'rgba(70,45,20,.55)'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4)
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(w * .12, h * .6, w * .24, h * .16)
}
const crateDraw = (g, w, h) => {
  g.fillStyle = '#2f8a55'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.28)'
  for (let i = 0; i < 4; i++) g.fillRect(w * .12, h * (.14 + i * .2), w * .76, h * .08)
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4)
}
const rodEndDraw = (g) => {
  g.fillStyle = '#3d434a'; g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#c9cfd6'; g.beginPath(); g.arc(32, 32, 27, 0, 7); g.fill()
  g.fillStyle = '#9aa2ab'; g.beginPath(); g.arc(32, 32, 18, 0, 7); g.fill()
}
const rodSideDraw = (g, w) => {
  g.fillStyle = '#a9b1ba'; g.fillRect(0, 0, w, 64)
  g.fillStyle = 'rgba(40,45,52,.45)'; g.fillRect(0, 0, w, 6)
  g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 22, w, 8)
}

export class WarehouseView {
  constructor(container, labelLayer, { onSelect } = {}) {
    this.container = container
    this.labelLayer = labelLayer
    this.onSelect = onSelect
    this.mode = '3d'
    this.cache = {}
    this.labels = []
    this.pickables = []
    this.highlights = []
    this.rackGroups = new Map()
    this.binIndex = new Map()
    this.fly = null
    this.fork = null
    this.layout = null

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true })
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.outputColorSpace = THREE.SRGBColorSpace
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 0.9
    container.appendChild(r.domElement)

    const s = this.scene = new THREE.Scene()
    s.background = new THREE.Color(0xd5dce5)
    s.fog = new THREE.Fog(0xd5dce5, 110, 220)
    const pmrem = new THREE.PMREMGenerator(r)
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    s.environmentIntensity = 0.4

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 500)
    this.controls = new OrbitControls(this.camera, r.domElement)
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI / 2.2, minDistance: 5, maxDistance: 140 })

    s.add(new THREE.HemisphereLight(0xffffff, 0x8a909a, 1.1))
    const sun = new THREE.DirectionalLight(0xfff6ea, 3.0)
    sun.position.set(-18, 42, 22)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 150 })
    sun.shadow.bias = -0.0006
    s.add(sun)
    const fill = new THREE.DirectionalLight(0xdbe8ff, 1.0)
    fill.position.set(25, 20, -10)
    s.add(fill)

    this.initMaterials()

    this.world = new THREE.Group()
    s.add(this.world)
    const unit = new THREE.BoxGeometry(1, 1, 1)
    this.unitBox = unit
    this.unitEdges = new THREE.EdgesGeometry(unit)
    this.sel = new THREE.Group()
    this.sel.add(new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.14, depthWrite: false })))
    this.sel.add(new THREE.LineSegments(this.unitEdges, new THREE.LineBasicMaterial({ color: 0x06b6d4 })))
    this.sel.visible = false
    s.add(this.sel)

    this.ray = new THREE.Raycaster()
    this.ndc = new THREE.Vector2()
    this.v3 = new THREE.Vector3()
    this.bindPointer()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
    this.last = performance.now()
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  initMaterials() {
    const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...o })
    const floorTex = makeTex(512, 512, (g, w, h) => {
      g.fillStyle = '#9ea5ae'; g.fillRect(0, 0, w, h)
      for (let i = 0; i < 14000; i++) { const v = 145 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v + 5},.28)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) }
      g.strokeStyle = 'rgba(95,100,110,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h)
    })
    this.floorTex = floorTex
    this.m = {
      floor: M(0xffffff, { map: floorTex, roughness: 0.85 }),
      wall: M(0xdde2e8, { roughness: 0.9 }), dado: M(0x9fb0c4, { roughness: 0.8 }), roofBeam: M(0xc5ccd5),
      window: new THREE.MeshBasicMaterial({ color: 0xf4f9ff }),
      upright: M(0x1d4fb3, { metalness: 0.35, roughness: 0.45 }), beam: M(0xf0731a, { metalness: 0.25, roughness: 0.45 }),
      deck: M(0x8f99a5, { metalness: 0.6, roughness: 0.4 }), pallet: M(0xb5895a, { roughness: 0.9 }),
      copper: M(0xc06a36, { metalness: 0.75, roughness: 0.32 }), casting: M(0x5a6068, { metalness: 0.55, roughness: 0.55 }),
      drumBlue: M(0x1d5bc4, { metalness: 0.3, roughness: 0.38 }), drumDark: M(0x2f3640, { metalness: 0.35, roughness: 0.4 }),
      yellow: M(0xf3c234, { roughness: 0.5 }), motor: M(0x2457b0, { metalness: 0.4, roughness: 0.4 }),
      dark: M(0x2b2f36, { roughness: 0.6 }), steel: M(0xa8b0b9, { metalness: 0.85, roughness: 0.3 }), black: M(0x111111, { roughness: 0.8 }),
      line: M(0xf2c230, { roughness: 0.6 })
    }
  }

  tmat(key, draw, rx, ry, size = 128) {
    const k = `${key}:${rx}x${ry}`
    if (!this.cache[k]) {
      const t = makeTex(size, size, draw)
      t.repeat.set(rx, ry)
      this.cache[k] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })
    }
    return this.cache[k]
  }
  geo(k, f) { return this.cache['g' + k] || (this.cache['g' + k] = f()) }
  BG(w, h, d) { return this.geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)) }
  CG(rt, rb, h, s = 20) { return this.geo(`c${rt}_${rb}_${h}_${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)) }

  mk(g, m, x, y, z, parent, ud) {
    const o = new THREE.Mesh(g, m)
    o.position.set(x, y, z)
    o.castShadow = true
    o.receiveShadow = true
    ;(parent || this.world).add(o)
    if (ud) { o.userData = ud; this.pickables.push(o) }
    return o
  }

  addLabel(html, pos, cls, onclick) {
    const el = document.createElement('div')
    el.className = 'lbl ' + (cls || '')
    el.innerHTML = html
    if (onclick) { el.style.pointerEvents = 'auto'; el.onclick = onclick }
    this.labelLayer.appendChild(el)
    const L = { el, pos: pos.clone() }
    this.labels.push(L)
    return L
  }
  removeLabel(L) { if (!L) return; L.el.remove(); this.labels = this.labels.filter(x => x !== L) }

  // ---------- building the scene ----------

  setLayout(layout, { keepCamera } = {}) {
    const first = !this.layout || this.layout.warehouse.id !== layout.warehouse.id
    this.layout = layout
    this.scene.remove(this.world)
    this.world.traverse(o => { if (o.isMesh && o.userData.ownGeo) o.geometry.dispose() })
    this.world = new THREE.Group()
    this.scene.add(this.world)
    this.pickables = []
    this.labels.forEach(L => L.el.remove())
    this.labels = []
    this.rackGroups.clear()
    this.binIndex.clear()
    this.highlights.forEach(h => this.scene.remove(h.g))
    this.highlights = []
    this.callout = null
    this.fork = null

    const w = layout.warehouse
    this.buildShell(w)
    layout.racks.forEach(r => this.buildRack(r))
    this.buildZones()
    this.buildForklift()

    const W = w.widthM, D = w.depthM
    // Portrait screens (phones) need the camera further back to fit the floor.
    const k = this.camera.aspect < 1 ? 1.9 : this.camera.aspect < 1.4 ? 1.3 : 1
    this.home = { t: new THREE.Vector3(-W * 0.04, 0, -D * 0.1), p: new THREE.Vector3(-W * 0.04, W * 0.36 * k, -D * 0.1 + D * 0.72 * k) }
    if (first || !keepCamera) {
      this.camera.position.copy(this.mode === '2d' ? this.topPos(this.home.t) : this.home.p)
      this.controls.target.copy(this.home.t)
    }
    if (this.selRack) this.select(this.selRack, this.selBin, { fly: false })
  }

  buildShell(w) {
    const W = w.widthM, D = w.depthM, m = this.m
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m.floor)
    fl.userData.ownGeo = true
    fl.rotation.x = -Math.PI / 2
    fl.receiveShadow = true
    this.floorTex.repeat.set(W / 6.4, D / 6.4)
    this.world.add(fl)
    const own = g => { g.userData = { ownGeo: true }; return g }
    own(this.mk(new THREE.BoxGeometry(W, 10, 0.4), m.wall, 0, 5, -D / 2 - 0.2))
    own(this.mk(new THREE.BoxGeometry(W, 1.4, 0.42), m.dado, 0, 0.7, -D / 2 - 0.15))
    own(this.mk(new THREE.BoxGeometry(0.4, 10, D), m.wall, -W / 2 - 0.2, 5, 0))
    own(this.mk(new THREE.BoxGeometry(0.42, 1.4, D), m.dado, -W / 2 - 0.15, 0.7, 0))
    for (let x = -W / 2 + 4; x <= W / 2 - 3; x += 8) {
      this.mk(this.BG(5.2, 1.6, 0.1), m.window, x, 7.8, -D / 2 + 0.05)
      this.mk(this.BG(0.5, 10, 0.6), m.roofBeam, x + 4, 5, -D / 2 + 0.2)
    }
    for (let z = -D / 2 + 5; z <= D / 2 - 4; z += 8) this.mk(this.BG(0.1, 1.6, 5.2), m.window, -W / 2 + 0.05, 7.8, z)
    // inward dock door on the back wall, at the dock x position
    const shut = this.tmat('shutter', (g, ww, hh) => { g.fillStyle = '#a7b1bd'; g.fillRect(0, 0, ww, hh); g.fillStyle = 'rgba(60,70,82,.45)'; g.fillRect(0, 0, ww, 5) }, 1, 14, 64)
    const dx = Math.max(-W / 2 + 4, Math.min(W / 2 - 4, w.dockX))
    this.mk(this.BG(5, 5, 0.15), shut, dx, 2.5, -D / 2 + 0.05)
    this.mk(this.BG(5.6, 0.35, 0.3), m.yellow, dx, 5.15, -D / 2 + 0.1)
    ;[-2.75, 2.75].forEach(o => this.mk(this.BG(0.3, 5.3, 0.3), m.yellow, dx + o, 2.65, -D / 2 + 0.1))
    this.rectLine(dx - 5.5, -D / 2 + 0.5, dx + 5.5, Math.min(w.dockZ + 10, D / 2 - 1))
    this.addLabel('<i class="ti ti-truck-loading" style="background:#fff5e5;color:#d97706"></i><div>Receiving dock<small>Inward · putaway starts here</small></div>',
      new THREE.Vector3(dx, 5.9, -D / 2 + 0.5), 'zone-lbl')
  }

  lineSeg(x0, z0, x1, z1, w = 0.14) {
    const len = Math.hypot(x1 - x0, z1 - z0), horiz = Math.abs(z1 - z0) < 0.001
    const o = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : w, 0.02, horiz ? w : len), this.m.line)
    o.userData.ownGeo = true
    o.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2)
    o.receiveShadow = true
    this.world.add(o)
  }
  rectLine(x0, z0, x1, z1, dashed) {
    const seg = (a, b, c, d) => {
      if (!dashed) return this.lineSeg(a, b, c, d)
      const n = Math.max(2, Math.floor(Math.hypot(c - a, d - b) / 1.2))
      for (let i = 0; i < n; i += 2) this.lineSeg(a + (c - a) * i / n, b + (d - b) * i / n, a + (c - a) * (i + 1) / n, b + (d - b) * (i + 1) / n)
    }
    seg(x0, z0, x1, z0); seg(x1, z0, x1, z1); seg(x1, z1, x0, z1); seg(x0, z1, x0, z0)
  }
  railing(x0, z0, x1, z1) {
    const m = this.m.yellow
    const run = (a, b, c, d, gap) => {
      const len = Math.hypot(c - a, d - b), n = Math.max(1, Math.round(len / 1.6)), horiz = Math.abs(d - b) < 0.01
      const parts = gap ? [[0, Math.floor(n * 0.35)], [Math.ceil(n * 0.65), n]] : [[0, n]]
      parts.forEach(([f, t]) => {
        if (t <= f) return
        for (let i = f; i <= t; i++) this.mk(this.BG(0.08, 1.1, 0.08), m, a + (c - a) * i / n, 0.55, b + (d - b) * i / n)
        const xa = a + (c - a) * f / n, za = b + (d - b) * f / n, xb = a + (c - a) * t / n, zb = b + (d - b) * t / n, l = Math.hypot(xb - xa, zb - za)
        ;[0.55, 1.05].forEach(y => { const o = this.mk(new THREE.BoxGeometry(horiz ? l : 0.06, 0.06, horiz ? 0.06 : l), m, (xa + xb) / 2, y, (za + zb) / 2); o.userData.ownGeo = true })
      })
    }
    run(x0, z0, x1, z0); run(x1, z0, x1, z1, true); run(x1, z1, x0, z1); run(x0, z1, x0, z0)
  }

  buildRack(r) {
    const g = new THREE.Group()
    g.position.set(r.posX, 0, r.posZ)
    if (r.rackType === 'RACK' && r.rotation === 90) g.rotation.y = Math.PI / 2
    this.world.add(g)
    this.rackGroups.set(r.id, { group: g, rack: r })
    const ud = { rackId: r.id }
    const m = this.m
    if (r.rackType === 'FLOOR') {
      // floor zone: painted slot grid
      for (let c = 0; c <= r.bays; c++) this.lineSegLocal(g, c * SLOT, 0, c * SLOT, r.levels * SLOT)
      for (let l = 0; l <= r.levels; l++) this.lineSegLocal(g, 0, l * SLOT, r.bays * SLOT, l * SLOT)
      const pad = this.mk(new THREE.BoxGeometry(r.bays * SLOT, 0.01, r.levels * SLOT), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
        r.bays * SLOT / 2, 0.005, r.levels * SLOT / 2, g, ud)
      pad.userData.ownGeo = true
      pad.castShadow = false
    } else {
      const L = r.bays * BAY_W, H = r.levels * LH + 0.25
      for (let i = 0; i <= r.bays; i++) {
        const z = i * BAY_W
        ;[-DEPTH / 2, DEPTH / 2].forEach(x => { this.mk(this.BG(0.09, H, 0.09), m.upright, x, H / 2, z, g, ud); this.mk(this.BG(0.3, 0.03, 0.3), m.dark, x, 0.015, z, g) })
        for (let y = 0.5; y < H; y += 1.4) this.mk(this.BG(DEPTH, 0.05, 0.05), m.upright, 0, y, z, g, ud)
      }
      for (let l = 1; l <= r.levels; l++) {
        const y = l * LH
        ;[-DEPTH / 2, DEPTH / 2].forEach(x => this.mk(this.BG(0.07, 0.13, L), m.beam, x, y, L / 2, g, ud))
        if (l < r.levels) this.mk(this.BG(DEPTH, 0.03, L), m.deck, 0, y + 0.08, L / 2, g, ud)
      }
    }
    r.bins.forEach(b => {
      this.binIndex.set(b.code, { bin: b, rack: r })
      this.buildLoad(r, b, g)
    })
    g.updateMatrixWorld(true)
    const tagLocal = r.rackType === 'FLOOR' ? new THREE.Vector3(r.bays * SLOT / 2, 2.2, 0) : new THREE.Vector3(0, r.levels * LH + 0.8, r.bays * BAY_W - 0.2)
    const entry = this.rackGroups.get(r.id)
    entry.tag = this.addLabel(r.code, g.localToWorld(tagLocal), 'tag', () => this.onSelect?.(r.id, null))
  }

  lineSegLocal(g, x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), horiz = Math.abs(z1 - z0) < 0.001
    const o = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.1, 0.02, horiz ? 0.1 : len), this.m.line)
    o.userData.ownGeo = true
    o.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2)
    g.add(o)
  }

  binLocalBox(r, b) {
    if (r.rackType === 'FLOOR') return { c: new THREE.Vector3((b.bayNo - 0.5) * SLOT, 0.85, (b.levelNo - 0.5) * SLOT), s: new THREE.Vector3(SLOT - 0.3, 1.7, SLOT - 0.3) }
    const base = b.levelNo === 1 ? 0 : (b.levelNo - 1) * LH + 0.1
    return { c: new THREE.Vector3(0, base + 0.68, (b.bayNo - 0.5) * BAY_W), s: new THREE.Vector3(DEPTH + 0.16, 1.32, BAY_W - 0.12) }
  }
  binWorldBox(code) {
    const e = this.binIndex.get(code)
    if (!e) return null
    const { group } = this.rackGroups.get(e.rack.id)
    const { c, s } = this.binLocalBox(e.rack, e.bin)
    group.updateMatrixWorld(true)
    const wc = group.localToWorld(c.clone())
    const rotated = e.rack.rackType === 'RACK' && e.rack.rotation === 90
    return { c: wc, s: rotated ? new THREE.Vector3(s.z, s.y, s.x) : s }
  }

  buildLoad(r, b, g) {
    if (!(b.qtyKg > 0)) return
    const ud = { rackId: r.id, binCode: b.code }
    const m = this.m
    const put = (geom, mat, x, y, z, rot) => { const o = this.mk(geom, mat, x, y, z, g, ud); if (rot) o.rotation.set(rot[0], rot[1], rot[2]); return o }
    const frac = Math.min(1, b.qtyKg / b.capacityKg)
    const visual = b.visual || 'GENERIC'
    if (r.rackType === 'FLOOR') {
      const { c } = this.binLocalBox(r, b)
      const n = Math.max(1, Math.min(6, Math.round(b.qtyKg / (b.unitWeightKg || 150))))
      const pump = visual === 'PUMP'
      for (let i = 0; i < n; i++) {
        const x = c.x + ((i % 3) - 1) * 0.95, z = c.z + (Math.floor(i / 3) - 0.5) * 1.2
        put(this.BG(0.85, 0.12, 0.85), m.pallet, x, 0.06, z)
        if (pump) {
          put(this.CG(0.26, 0.3, 0.55), m.motor, x, 0.42, z); put(this.CG(0.2, 0.2, 0.45), m.motor, x, 0.92, z)
          put(this.CG(0.07, 0.07, 0.35, 8), m.steel, x + 0.3, 0.4, z, [0, 0, Math.PI / 2])
        } else if (visual === 'MOTOR') {
          put(this.BG(0.55, 0.1, 0.42), m.dark, x, 0.17, z); put(this.CG(0.27, 0.27, 0.62), m.motor, x, 0.48, z, [0, 0, Math.PI / 2])
          put(this.CG(0.22, 0.22, 0.08, 16), m.dark, x - 0.35, 0.48, z, [0, 0, Math.PI / 2]); put(this.CG(0.04, 0.04, 0.2, 8), m.steel, x + 0.4, 0.48, z, [0, 0, Math.PI / 2])
          put(this.BG(0.16, 0.12, 0.16), m.motor, x, 0.8, z)
        } else {
          put(this.BG(0.8, 0.6, 0.8), this.tmat('carton', cartonDraw('#c99f67'), 2, 1), x, 0.42, z)
        }
      }
      return
    }
    const base = b.levelNo === 1 ? 0 : (b.levelNo - 1) * LH + 0.095
    const zc = (b.bayNo - 0.5) * BAY_W
    ;[-0.66, 0.66].forEach((dz, i) => {
      const fp = i === 0 ? Math.min(1, frac * 2) : Math.max(0, frac * 2 - 1)
      if (fp < 0.06) return
      const z = zc + dz, y0 = base + 0.14
      put(this.BG(1.1, 0.14, 1.15), m.pallet, 0, base + 0.07, z)
      switch (visual) {
        case 'STEEL': {
          const h = +(0.22 + 0.5 * fp).toFixed(2), rows = Math.max(1, Math.round(h / 0.17))
          const e = this.tmat('rodEnd', rodEndDraw, 6, rows, 64), s = this.tmat('rodSide', rodSideDraw, 1, rows, 64)
          put(this.BG(1.1, h, 1.0), [e, e, this.tmat('rodSide', rodSideDraw, 1, 6, 64), s, s, s], 0, y0 + h / 2, z)
          break
        }
        case 'COPPER': {
          const n = fp > 0.66 ? 3 : fp > 0.33 ? 2 : 1
          for (let k = 0; k < n; k++) put(this.geo('coil', () => new THREE.TorusGeometry(0.32, 0.13, 12, 28)), m.copper, 0, y0 + 0.13 + k * 0.27, z, [Math.PI / 2, 0, 0])
          break
        }
        case 'CASTING': {
          const n = fp > 0.5 ? 4 : 2
          for (let k = 0; k < n; k++) {
            const ox = (k % 2 - 0.5) * 0.5, oz = (Math.floor(k / 2) - 0.5) * 0.5 * (n > 2 ? 1 : 0)
            put(this.CG(0.2, 0.24, 0.42, 16), m.casting, ox, y0 + 0.21, z + oz)
            put(this.CG(0.08, 0.08, 0.22, 10), m.casting, ox, y0 + 0.3, z + oz + 0.22, [Math.PI / 2, 0, 0])
          }
          break
        }
        case 'DRUM': {
          const n = Math.max(1, Math.round(fp * 4))
          ;[[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].slice(0, n)
            .forEach(([a, c]) => put(this.CG(0.26, 0.26, 0.88, 18), b.id % 3 === 0 ? m.drumDark : m.drumBlue, a, y0 + 0.44, z + c))
          break
        }
        case 'CRATE': {
          const layers = fp > 0.5 ? 2 : 1, h = 0.42 * layers
          put(this.BG(1.05, h, 1.1), this.tmat('crate', crateDraw, 2, layers), 0, y0 + h / 2, z)
          break
        }
        default: {
          const layers = fp > 0.5 ? 2 : 1, h = 0.42 * layers
          put(this.BG(1.05, h, 1.1), this.tmat('carton', cartonDraw(visual === 'CARTON' ? '#c99f67' : '#b9875a'), 2, layers), 0, y0 + h / 2, z)
        }
      }
    })
  }

  buildZones() {
    const zones = new Map()
    this.rackGroups.forEach(({ group, rack }) => {
      if (rack.storageType === 'SOLID') return
      const key = rack.zoneCode || rack.storageType
      const box = new THREE.Box3().setFromObject(group)
      if (box.isEmpty()) return
      const z = zones.get(key) || { box: new THREE.Box3(), type: rack.storageType, code: key }
      z.box.union(box)
      zones.set(key, z)
    })
    zones.forEach(z => {
      const b = z.box, x0 = b.min.x - 1.4, x1 = b.max.x + 1.4, z0 = b.min.z - 1.4, z1 = b.max.z + 1.4
      if (z.type === 'LIQUID') this.railing(x0, z0, x1, z1)
      this.rectLine(x0 - 0.3, z0 - 0.3, x1 + 0.3, z1 + 0.3, z.type === 'EQUIPMENT')
      const info = ZONE_INFO[z.type]
      this.addLabel(`<i class="ti ${info.icon}" style="background:${info.bg};color:${info.fg}"></i><div>${info.title}<small>Zone ${z.code}</small></div>`,
        new THREE.Vector3((x0 + x1) / 2, Math.max(b.max.y, 1.5) + 1.6, z0), 'zone-lbl')
    })
  }

  buildForklift() {
    let minX = Infinity, maxX = -Infinity, maxZ = -Infinity
    this.rackGroups.forEach(({ group, rack }) => {
      if (rack.storageType !== 'SOLID' || rack.rackType !== 'RACK') return
      const b = new THREE.Box3().setFromObject(group)
      minX = Math.min(minX, b.min.x); maxX = Math.max(maxX, b.max.x); maxZ = Math.max(maxZ, b.max.z)
    })
    if (!isFinite(minX)) return
    const g = new THREE.Group(), m = this.m, p = (geom, mat, x, y, z) => this.mk(geom, mat, x, y, z, g)
    p(this.BG(1.1, 0.7, 1.7), m.yellow, 0, 0.6, 0); p(this.BG(1.1, 0.65, 0.45), m.dark, 0, 0.62, -0.95)
    ;[[0.48, -0.55], [-0.48, -0.55], [0.48, 0.45], [-0.48, 0.45]].forEach(([x, z]) => p(this.BG(0.06, 1.3, 0.06), m.dark, x, 1.6, z))
    p(this.BG(1.12, 0.06, 1.2), m.dark, 0, 2.26, -0.05); p(this.BG(0.5, 0.35, 0.45), m.dark, 0, 1.15, -0.3)
    ;[-0.32, 0.32].forEach(x => p(this.BG(0.09, 2.7, 0.12), m.dark, x, 1.4, 0.95)); p(this.BG(0.8, 0.08, 0.1), m.dark, 0, 0.6, 1.02)
    ;[-0.26, 0.26].forEach(x => p(this.BG(0.1, 0.05, 1.1), m.steel, x, 0.32, 1.6))
    ;[[0.58, 0.55], [-0.58, 0.55], [0.58, -0.6], [-0.58, -0.6]].forEach(([x, z]) => { const w = p(this.CG(0.27, 0.27, 0.2, 16), m.black, x, 0.27, z); w.rotation.z = Math.PI / 2 })
    p(this.BG(1.1, 0.14, 1.15), m.pallet, 0, 0.42, 1.6); p(this.BG(1.0, 0.8, 1.05), this.tmat('carton', cartonDraw('#c99f67'), 2, 2), 0, 0.89, 1.6)
    this.world.add(g)
    this.fork = { g, t: 0, x0: minX + 2, x1: maxX - 2, z: maxZ + 2.4 }
  }

  // ---------- selection, highlights, camera ----------

  select(rackId, binCode, { fly = true } = {}) {
    this.selRack = rackId
    this.selBin = binCode
    const e = this.rackGroups.get(rackId)
    this.rackGroups.forEach(x => x.tag?.el.classList.toggle('sel', x.rack.id === rackId))
    this.removeLabel(this.callout)
    this.callout = null
    if (!e) { this.sel.visible = false; return }
    const box = new THREE.Box3().setFromObject(e.group)
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3())
    this.sel.position.copy(c)
    this.sel.scale.set(s.x + 0.3, Math.max(s.y, 1.6) + 0.2, s.z + 0.3)
    this.sel.visible = true
    const used = e.rack.bins.reduce((a, b) => a + b.qtyKg, 0), cap = e.rack.bins.reduce((a, b) => a + b.capacityKg, 0)
    const pct = cap ? Math.round(used / cap * 100) : 0
    this.callout = this.addLabel(`Rack ${e.rack.code}<small>${pct}% filled${e.rack.preferredMaterialName ? ' · ' + e.rack.preferredMaterialName : ''}</small>`,
      new THREE.Vector3(c.x, box.max.y + 1.4, c.z), 'callout')
    if (fly) {
      if (binCode && this.binIndex.has(binCode)) this.focusBin(binCode)
      else this.focus(new THREE.Vector3(c.x, 1.5, c.z), e.rack.rackType === 'FLOOR' ? 16 : 19)
    }
  }
  clearSelection() {
    this.selRack = null
    this.selBin = null
    this.sel.visible = false
    this.removeLabel(this.callout)
    this.callout = null
    this.rackGroups.forEach(x => x.tag?.el.classList.remove('sel'))
  }

  /** items: [{ code, color: '#22c55e', text }] */
  setHighlights(items = []) {
    this.highlights.forEach(h => { this.scene.remove(h.g); this.removeLabel(h.pin) })
    this.highlights = []
    items.forEach(it => {
      const box = this.binWorldBox(it.code)
      if (!box) return
      const color = new THREE.Color(it.color || '#06b6d4')
      const g = new THREE.Group()
      const mesh = new THREE.Mesh(this.unitBox, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false }))
      g.add(mesh)
      g.add(new THREE.LineSegments(this.unitEdges, new THREE.LineBasicMaterial({ color })))
      g.position.copy(box.c)
      g.scale.copy(box.s)
      this.scene.add(g)
      const pin = this.addLabel(`<span>${it.text || it.code}</span><i class="ti ti-map-pin-filled"></i>`, box.c.clone().add(new THREE.Vector3(0, box.s.y / 2 + 0.1, 0)), 'pin')
      pin.el.style.setProperty('--pc', it.color || '#06b6d4')
      this.highlights.push({ g, mesh, pin })
    })
  }

  focusBin(code) {
    const box = this.binWorldBox(code)
    if (box) this.focus(box.c, 13)
  }
  topPos(t, dist = 70) { return new THREE.Vector3(t.x, dist, t.z + 0.01) }
  focus(t, dist) {
    const p = this.mode === '2d' ? this.topPos(t, dist * 2.2) : new THREE.Vector3(t.x + dist * 0.55, t.y + dist * 0.6, t.z + dist * 0.75)
    this.flyTo(t, p)
  }
  flyTo(t, p, ms = 900) {
    this.fly = { t0: performance.now(), ms, fT: this.controls.target.clone(), fP: this.camera.position.clone(), tT: t.clone(), tP: p.clone() }
  }
  setMode(mode) {
    this.mode = mode
    this.controls.enableRotate = mode === '3d'
    this.controls.mouseButtons.LEFT = mode === '2d' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    this.controls.touches.ONE = mode === '2d' ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE
    if (!this.home) return
    const t = this.home.t
    this.flyTo(t, mode === '2d' ? this.topPos(t, Math.max(this.layout.warehouse.widthM, this.layout.warehouse.depthM) * 1.05) : this.home.p)
  }
  zoom(k) {
    const d = this.camera.position.clone().sub(this.controls.target).multiplyScalar(k)
    this.flyTo(this.controls.target, this.controls.target.clone().add(d), 350)
  }
  resetView() { this.setMode(this.mode) }

  // ---------- input and loop ----------

  bindPointer() {
    const el = this.renderer.domElement
    let down = null, queued = false, last = null
    const hit = e => {
      const r = el.getBoundingClientRect()
      this.ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1)
      this.ray.setFromCamera(this.ndc, this.camera)
      const h = this.ray.intersectObjects(this.pickables, false)
      return h.length ? h[0].object.userData : null
    }
    this.onDown = e => { down = { x: e.clientX, y: e.clientY } }
    this.onUp = e => {
      if (!down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      down = null
      if (moved > 6) return
      const u = hit(e)
      if (u) this.onSelect?.(u.rackId, u.binCode || null)
    }
    this.onMove = e => {
      last = e
      if (queued || e.pointerType === 'touch') return
      queued = true
      requestAnimationFrame(() => { queued = false; if (!down) el.style.cursor = hit(last) ? 'pointer' : 'grab' })
    }
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointermove', this.onMove)
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  updateLabels() {
    const w = this.container.clientWidth, h = this.container.clientHeight
    for (const L of this.labels) {
      this.v3.copy(L.pos).project(this.camera)
      const vis = this.v3.z < 1 && this.v3.z > -1
      L.el.style.display = vis ? '' : 'none'
      if (vis) L.el.style.transform = `translate(${(this.v3.x * 0.5 + 0.5) * w}px,${(-this.v3.y * 0.5 + 0.5) * h}px) translate(-50%,-100%)`
    }
  }

  loop(now) {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    if (this.fly) {
      let k = Math.min(1, (now - this.fly.t0) / this.fly.ms)
      k = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      this.controls.target.lerpVectors(this.fly.fT, this.fly.tT, k)
      this.camera.position.lerpVectors(this.fly.fP, this.fly.tP, k)
      if (k >= 1) this.fly = null
    }
    this.controls.update()
    if (this.fork) {
      const f = this.fork
      f.t += dt * 0.22
      const x = f.x0 + (f.x1 - f.x0) * (0.5 - 0.5 * Math.cos(f.t))
      f.g.position.set(x, 0, f.z)
      f.g.rotation.y = Math.sin(f.t) >= 0 ? Math.PI / 2 : -Math.PI / 2
    }
    const pulse = 0.22 + 0.16 * Math.sin(now / 220)
    this.highlights.forEach(h => { h.mesh.material.opacity = pulse })
    this.renderer.render(this.scene, this.camera)
    this.updateLabels()
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointermove', this.onMove)
    this.controls.dispose()
    this.labels.forEach(L => L.el.remove())
    this.scene.traverse(o => {
      if (o.isMesh) { o.geometry?.dispose?.() }
    })
    Object.values(this.cache).forEach(x => { x.map?.dispose?.(); x.dispose?.() })
    this.renderer.dispose()
    el.remove()
  }
}
