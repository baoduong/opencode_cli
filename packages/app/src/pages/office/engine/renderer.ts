import { TILE, CHAR_H, HAIR_STYLES, PALETTES, type CharacterState, type HairStyle } from "./sprites"

export interface Agent {
  id: string
  name: string
  agent: string
  status: "busy" | "idle" | "retry"
  tool: string
  duration: number
}

export interface Character {
  agent: Agent
  x: number
  y: number
  tx: number
  ty: number
  frame: number
  timer: number
  state: CharacterState
  palette: number
  spawn: number
  facing: number
  hop: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  color: string
}

export interface Desk {
  x: number
  y: number
}

export interface Office {
  width: number
  height: number
  desks: Desk[]
  decorations: Array<{ x: number; y: number; type: "plant" | "coffee" | "shelf" | "cat" }>
}

const COLORS = {
  floor: ["#8B7355", "#7A6344"],
  floorLine: "#6B5535",
  wall: ["#9B8E82", "#8A7D71"],
  wallMortar: "#ADA196",
  baseboard: "#5A4E42",
  desk: "#6B4F37",
  deskTop: "#7D614A",
  deskLight: "#8B7355",
  monitor: "#1A1A2E",
  monitorBezel: "#111122",
  screen: "#44DD88",
  screenBusy: "#44DD88",
  screenIdle: "#223344",
  chair: "#555577",
  chairCushion: "#666688",
  plant: "#55cc66",
  plantDark: "#44aa55",
  plantLight: "#66dd77",
  pot: "#aa7744",
  potRim: "#bb8855",
  coffee: "#887766",
  coffeeDark: "#776655",
  steam: "#bbbbdd",
  shelf: "#8a7a5a",
  shelfDark: "#6a5a3a",
  cat: "#eeaa44",
  catLight: "#ffcc66",
  catStripe: "#cc8833",
  door: "#3a2a1a",
  doorFrame: "#6a5a3a",
  rug: "#664433",
  ceiling: "#FFFDE8",
  lightCone: "rgba(255, 253, 220, 0.06)",
}

function hair(p: number): HairStyle {
  return HAIR_STYLES[p % HAIR_STYLES.length]
}

function glasses(p: number): boolean {
  return PALETTES.glasses[p % PALETTES.glasses.length]
}

export function layout(count: number): Office {
  const actual = Math.max(count, 2)
  const cols = Math.min(actual, 3)
  const rows = Math.ceil(actual / cols)
  const w = Math.max(cols * 3 + 3, 8)
  const h = Math.max(rows * 3 + 3, 6)
  const desks: Desk[] = []
  const ox = Math.floor((w - cols * 3) / 2) + 1
  const oy = 2
  for (let i = 0; i < actual; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    desks.push({ x: (col * 3 + ox) * TILE + TILE / 2, y: (row * 3 + oy) * TILE })
  }
  const decorations: Office["decorations"] = [
    { x: TILE + 12, y: (h - 2) * TILE, type: "plant" },
    { x: (w - 1) * TILE - 12, y: (h - 2) * TILE, type: "coffee" },
    { x: (w - 1) * TILE - 8, y: TILE + 16, type: "shelf" },
  ]
  if (count > 2) decorations.push({ x: TILE + 12, y: TILE + 16, type: "cat" })
  return { width: w * TILE, height: h * TILE, desks, decorations }
}

export function spawnParticles(particles: Particle[], x: number, y: number) {
  const colors = ["#ff4466", "#44cc88", "#ffcc44", "#4488ff", "#ff88ff", "#88ffcc"]
  for (let i = 0; i < 7; i++) {
    const angle = (Math.PI * 2 * i) / 7 + Math.random() * 0.5
    particles.push({
      x,
      y: y - 8,
      vx: Math.cos(angle) * (30 + Math.random() * 20),
      vy: Math.sin(angle) * (30 + Math.random() * 20) - 20,
      life: 0.6 + Math.random() * 0.4,
      color: colors[i % colors.length],
    })
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  office: Office,
  chars: Character[],
  particles: Particle[],
  time: number,
  hover: number,
  scale: number,
) {
  const w = office.width
  const h = office.height
  ctx.imageSmoothingEnabled = false

  // Floor — wood plank pattern
  for (let y = 0; y < h; y += TILE) {
    for (let x = 0; x < w; x += TILE) {
      const row = Math.floor(y / TILE)
      ctx.fillStyle = row % 2 === 0 ? COLORS.floor[0] : COLORS.floor[1]
      ctx.fillRect(x, y, TILE, TILE)
      // Plank horizontal grain lines
      ctx.fillStyle = "rgba(0,0,0,0.06)"
      for (let ly = 4; ly < TILE; ly += 8) {
        ctx.fillRect(x, y + ly, TILE, 1)
      }
      // Plank vertical seams (staggered per row)
      ctx.fillStyle = COLORS.floorLine
      const offset = row % 2 === 0 ? 0 : TILE / 2
      if ((x + offset) % (TILE * 2) === 0) {
        ctx.fillRect(x, y, 1, TILE)
      }
    }
  }

  // Welcome rug at door
  const doorX = Math.floor(w / 2)
  ctx.fillStyle = COLORS.rug
  ctx.fillRect(doorX - 14, h - TILE * 2 + 4, 28, 14)
  ctx.fillStyle = "#775544"
  ctx.fillRect(doorX - 12, h - TILE * 2 + 6, 24, 10)
  // Rug fringe
  ctx.fillStyle = "#886655"
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(doorX - 12 + i * 5, h - TILE * 2 + 16, 3, 2)
  }

  // Walls — warm textured with brick pattern
  drawWalls(ctx, w, h, doorX, time)

  // Decorations
  for (const dec of office.decorations) {
    drawDecoration(ctx, dec.x, dec.y, dec.type, time)
  }

  // Draw all desks (L-shaped for even indices)
  for (let i = 0; i < office.desks.length; i++) {
    const desk = office.desks[i]
    const busy = chars.some((c) => c.tx === desk.x && c.ty === desk.y && c.agent.status === "busy")
    drawDesk(ctx, desk.x, desk.y, busy, i % 2 === 1)
  }

  // Characters (sorted by y for depth)
  const sorted = [...chars].sort((a, b) => a.y - b.y)
  for (const char of sorted) {
    if (char.state === "walking") {
      drawWalkingCharacter(ctx, char, time)
    } else {
      drawCharacter(ctx, char, time, hover === chars.indexOf(char))
    }
  }

  // Particles
  drawParticles(ctx, particles)

  // Labels
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (c.state === "walking") continue
    drawLabel(ctx, c, i === hover, scale)
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, w: number, h: number, doorX: number, time: number) {
  // Top wall with brick texture
  ctx.fillStyle = COLORS.wall[0]
  ctx.fillRect(0, 0, w, TILE)
  // Brick pattern on top wall
  for (let bx = 0; bx < w; bx += 12) {
    const row = Math.floor(bx / 12) % 2
    ctx.fillStyle = COLORS.wallMortar
    ctx.fillRect(bx, TILE / 2, 1, TILE / 2)
    if (row === 0) ctx.fillRect(bx, TILE / 2, 12, 1)
  }
  ctx.fillStyle = COLORS.wallMortar
  ctx.fillRect(0, TILE - 1, w, 1)

  // Side walls
  ctx.fillStyle = COLORS.wall[0]
  ctx.fillRect(0, 0, TILE, h)
  ctx.fillRect(w - TILE, 0, TILE, h)
  // Brick pattern on side walls
  for (let by = 0; by < h; by += 8) {
    const row = Math.floor(by / 8) % 2
    ctx.fillStyle = COLORS.wallMortar
    ctx.fillRect(0, by, TILE, 1)
    ctx.fillRect(w - TILE, by, TILE, 1)
    const seam = row === 0 ? TILE / 2 : TILE / 4
    ctx.fillRect(seam - 1, by, 1, 8)
    ctx.fillRect(w - TILE + seam - 1, by, 1, 8)
  }

  // Darker inner edges
  ctx.fillStyle = COLORS.wall[1]
  ctx.fillRect(TILE - 2, TILE, 2, h - TILE)
  ctx.fillRect(w - TILE, TILE, 2, h - TILE)
  ctx.fillRect(0, TILE - 2, w, 2)

  // Baseboard — darker strip where wall meets floor
  ctx.fillStyle = COLORS.baseboard
  ctx.fillRect(TILE, TILE, w - TILE * 2, 2)
  ctx.fillRect(TILE, TILE, 2, h - TILE * 2)
  ctx.fillRect(w - TILE - 2, TILE, 2, h - TILE * 2)

  // Ceiling lights
  const lights = Math.max(1, Math.floor(w / (TILE * 4)))
  for (let i = 0; i < lights; i++) {
    const lx = TILE * 2 + i * Math.floor((w - TILE * 4) / Math.max(1, lights - 1))
    ctx.fillStyle = COLORS.ceiling
    ctx.fillRect(lx - 2, 2, 4, 3)
    ctx.beginPath()
    ctx.fillStyle = COLORS.ceiling
    ctx.arc(lx, 5, 3, 0, Math.PI * 2)
    ctx.fill()
    // Light cone
    ctx.fillStyle = COLORS.lightCone
    ctx.beginPath()
    ctx.moveTo(lx - 3, 5)
    ctx.lineTo(lx - 20, TILE + 10)
    ctx.lineTo(lx + 20, TILE + 10)
    ctx.lineTo(lx + 3, 5)
    ctx.fill()
  }

  // Bottom wall with door opening
  ctx.fillStyle = COLORS.wall[0]
  ctx.fillRect(0, h - TILE, doorX - TILE, TILE)
  ctx.fillRect(doorX + TILE, h - TILE, w - doorX - TILE, TILE)
  // Door frame
  ctx.fillStyle = COLORS.doorFrame
  ctx.fillRect(doorX - TILE - 2, h - TILE, 4, TILE)
  ctx.fillRect(doorX + TILE - 2, h - TILE, 4, TILE)
  ctx.fillRect(doorX - TILE - 2, h - TILE, TILE * 2 + 4, 3)
  // Door opening
  ctx.fillStyle = "#2a2a3e"
  ctx.fillRect(doorX - TILE + 2, h - TILE + 3, TILE * 2 - 4, TILE - 3)

  // Clock on top wall
  const cx = Math.floor(w / 2)
  ctx.fillStyle = "#ddd"
  ctx.beginPath()
  ctx.arc(cx, TILE / 2 + 1, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#444"
  ctx.beginPath()
  ctx.arc(cx, TILE / 2 + 1, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ddd"
  ctx.beginPath()
  ctx.arc(cx, TILE / 2 + 1, 3.5, 0, Math.PI * 2)
  ctx.fill()
  const hour = (time * 0.1) % (Math.PI * 2)
  const min = (time * 0.5) % (Math.PI * 2)
  ctx.strokeStyle = "#444"
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx, TILE / 2 + 1)
  ctx.lineTo(cx + Math.sin(hour) * 2, TILE / 2 + 1 - Math.cos(hour) * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx, TILE / 2 + 1)
  ctx.lineTo(cx + Math.sin(min) * 3, TILE / 2 + 1 - Math.cos(min) * 3)
  ctx.stroke()

  // Whiteboard on left wall
  ctx.fillStyle = "#ccc"
  ctx.fillRect(5, TILE + 6, TILE - 10, TILE - 6)
  ctx.fillStyle = "#f5f5f5"
  ctx.fillRect(7, TILE + 8, TILE - 14, TILE - 10)
  ctx.fillStyle = "#4488cc"
  ctx.fillRect(9, TILE + 11, 8, 1)
  ctx.fillRect(9, TILE + 14, 10, 1)
  ctx.fillStyle = "#cc4444"
  ctx.fillRect(9, TILE + 17, 6, 1)
  ctx.fillStyle = "#44aa44"
  ctx.fillRect(9, TILE + 20, 9, 1)
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean, lshaped: boolean) {
  // Chair with armrests and cushion
  ctx.fillStyle = COLORS.chair
  ctx.fillRect(x - 6, y + 12, 12, 6)
  ctx.fillStyle = COLORS.chairCushion
  ctx.fillRect(x - 5, y + 12, 10, 4)
  // Chair back
  ctx.fillStyle = COLORS.chair
  ctx.fillRect(x - 7, y + 16, 14, 4)
  // Armrests
  ctx.fillRect(x - 7, y + 12, 2, 6)
  ctx.fillRect(x + 5, y + 12, 2, 6)
  // Chair legs
  ctx.fillStyle = "#444466"
  ctx.fillRect(x - 4, y + 20, 2, 2)
  ctx.fillRect(x + 2, y + 20, 2, 2)

  // Desk surface — wider (28px)
  ctx.fillStyle = COLORS.deskTop
  ctx.fillRect(x - 14, y - 4, 28, 4)
  // Desk front highlight
  ctx.fillStyle = COLORS.deskLight
  ctx.fillRect(x - 14, y - 4, 28, 1)
  // Desk body
  ctx.fillStyle = COLORS.desk
  ctx.fillRect(x - 14, y, 28, 10)
  // Legs
  ctx.fillStyle = "#5A3E26"
  ctx.fillRect(x - 13, y + 10, 3, 6)
  ctx.fillRect(x + 10, y + 10, 3, 6)
  // Drawer
  ctx.fillStyle = "#7A5A3A"
  ctx.fillRect(x - 5, y + 1, 10, 7)
  ctx.fillStyle = "#8B6B4A"
  ctx.fillRect(x - 1, y + 3, 2, 2)

  // L-shaped extension
  if (lshaped) {
    ctx.fillStyle = COLORS.deskTop
    ctx.fillRect(x + 14, y - 4, 10, 4)
    ctx.fillStyle = COLORS.desk
    ctx.fillRect(x + 14, y, 10, 10)
    ctx.fillStyle = "#5A3E26"
    ctx.fillRect(x + 20, y + 10, 3, 6)
    // Small item on extension (paper stack)
    ctx.fillStyle = "#f0f0e8"
    ctx.fillRect(x + 16, y - 6, 6, 3)
    ctx.fillStyle = "#e8e8d8"
    ctx.fillRect(x + 16, y - 5, 6, 2)
  }

  // Monitor — 14×10 with 1px bezel
  ctx.fillStyle = COLORS.monitorBezel
  ctx.fillRect(x - 8, y - 18, 16, 14)
  ctx.fillStyle = COLORS.monitor
  ctx.fillRect(x - 7, y - 17, 14, 12)
  // Screen
  ctx.fillStyle = active ? COLORS.screenBusy : COLORS.screenIdle
  ctx.fillRect(x - 6, y - 16, 12, 10)
  // Screen content when active
  if (active) {
    ctx.fillStyle = "#55ddaa"
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x - 4, y - 15 + i * 3, 8 + (i % 2 ? -3 : 0), 1)
    }
    // Screen glow
    ctx.fillStyle = "rgba(68, 221, 136, 0.12)"
    ctx.fillRect(x - 12, y - 20, 24, 18)
  }
  // Monitor stand
  ctx.fillStyle = COLORS.monitorBezel
  ctx.fillRect(x - 2, y - 4, 4, 2)
  ctx.fillRect(x - 4, y - 3, 8, 1)

  // Keyboard — 10×2 with lighter key dots
  ctx.fillStyle = "#333"
  ctx.fillRect(x - 5, y - 2, 10, 2)
  ctx.fillStyle = "#555"
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillRect(x - 4 + i * 3, y - 2 + j, 1, 1)
    }
  }

  // Coffee cup on desk (4×4)
  ctx.fillStyle = "#eee"
  ctx.fillRect(x + 8, y - 8, 4, 4)
  ctx.fillStyle = "#ddd"
  ctx.fillRect(x + 8, y - 8, 4, 1)
  // Handle
  ctx.fillStyle = "#ccc"
  ctx.fillRect(x + 12, y - 7, 1, 2)
  // Coffee liquid
  ctx.fillStyle = "#5a3a1a"
  ctx.fillRect(x + 9, y - 7, 2, 2)
}

function drawHair(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, bob: number) {
  const style = hair(p)
  ctx.fillStyle = PALETTES.hair[p % PALETTES.hair.length]

  if (style === "short") {
    ctx.fillRect(x - 4, y - 16 + bob, 8, 3)
    ctx.fillRect(x - 5, y - 15 + bob, 1, 3)
    ctx.fillRect(x + 4, y - 15 + bob, 1, 3)
    return
  }
  if (style === "long") {
    ctx.fillRect(x - 4, y - 16 + bob, 8, 3)
    ctx.fillRect(x - 5, y - 15 + bob, 1, 8)
    ctx.fillRect(x + 4, y - 15 + bob, 1, 8)
    ctx.fillRect(x - 5, y - 8 + bob, 2, 3)
    ctx.fillRect(x + 3, y - 8 + bob, 2, 3)
    return
  }
  if (style === "ponytail") {
    ctx.fillRect(x - 4, y - 16 + bob, 8, 3)
    ctx.fillRect(x - 5, y - 15 + bob, 1, 3)
    // Ponytail extension
    ctx.fillRect(x + 4, y - 15 + bob, 2, 2)
    ctx.fillRect(x + 5, y - 13 + bob, 2, 6)
    ctx.fillRect(x + 4, y - 8 + bob, 2, 2)
    return
  }
  if (style === "bun") {
    ctx.fillRect(x - 4, y - 16 + bob, 8, 3)
    ctx.fillRect(x - 5, y - 15 + bob, 1, 3)
    ctx.fillRect(x + 4, y - 15 + bob, 1, 3)
    // Bun on top
    ctx.fillRect(x - 2, y - 19 + bob, 4, 3)
    ctx.fillRect(x - 1, y - 20 + bob, 2, 1)
    return
  }
  if (style === "mohawk") {
    ctx.fillRect(x - 1, y - 20 + bob, 2, 6)
    ctx.fillRect(x - 2, y - 18 + bob, 4, 3)
    ctx.fillRect(x - 4, y - 15 + bob, 8, 1)
    return
  }
  // curly
  ctx.fillRect(x - 5, y - 16 + bob, 10, 3)
  ctx.fillRect(x - 5, y - 14 + bob, 1, 5)
  ctx.fillRect(x + 4, y - 14 + bob, 1, 5)
  ctx.fillRect(x - 6, y - 15 + bob, 1, 3)
  ctx.fillRect(x + 5, y - 15 + bob, 1, 3)
  ctx.fillRect(x - 6, y - 12 + bob, 1, 2)
  ctx.fillRect(x + 5, y - 12 + bob, 1, 2)
}

function drawGlasses(ctx: CanvasRenderingContext2D, x: number, y: number, bob: number) {
  ctx.fillStyle = "#555577"
  // Left lens frame
  ctx.fillRect(x - 3, y - 10 + bob, 3, 3)
  // Right lens frame
  ctx.fillRect(x + 1, y - 10 + bob, 3, 3)
  // Bridge
  ctx.fillRect(x, y - 10 + bob, 1, 1)
  // Lens fill (slightly transparent)
  ctx.fillStyle = "rgba(150,180,220,0.3)"
  ctx.fillRect(x - 2, y - 9 + bob, 1, 1)
  ctx.fillRect(x + 2, y - 9 + bob, 1, 1)
}

function drawWalkingCharacter(ctx: CanvasRenderingContext2D, char: Character, time: number) {
  const x = char.x
  const y = char.y
  const p = char.palette % PALETTES.skin.length

  const age = time - char.spawn
  const pop = age < 0.3 ? age / 0.3 : 1
  const stride = Math.sin(time * 10)
  // Vertical bob with each step
  const bob = Math.abs(stride) * 1

  ctx.save()
  ctx.translate(x, y - bob)
  ctx.scale(char.facing * pop, pop)

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)"
  ctx.beginPath()
  ctx.ellipse(0, CHAR_H / 2 + 2 + bob, 7, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Shoes + legs — two separate 3×8 legs
  const legOffset = stride * 3
  // Left leg
  ctx.fillStyle = "#334"
  ctx.fillRect(-4, 6, 3, 8 + legOffset)
  // Right leg
  ctx.fillRect(1, 6, 3, 8 - legOffset)
  // Left shoe
  ctx.fillStyle = "#221"
  ctx.fillRect(-4, 14 + legOffset, 4, 2)
  // Right shoe
  ctx.fillRect(1, 14 - legOffset, 4, 2)

  // Body/torso — 8×10
  ctx.fillStyle = PALETTES.shirt[p % PALETTES.shirt.length]
  ctx.fillRect(-4, -6, 8, 12)
  // Collar
  ctx.fillStyle = "rgba(255,255,255,0.2)"
  ctx.fillRect(-2, -6, 4, 1)

  // Arms swinging opposite to legs — 3×8
  const swing = stride * 4
  ctx.fillStyle = PALETTES.shirt[p % PALETTES.shirt.length]
  ctx.fillRect(-7, -4 + swing, 3, 8)
  ctx.fillRect(4, -4 - swing, 3, 8)
  // Hands
  ctx.fillStyle = PALETTES.skin[p]
  ctx.fillRect(-7, 3 + swing, 3, 2)
  ctx.fillRect(4, 3 - swing, 3, 2)

  // Head — 8×8
  ctx.fillStyle = PALETTES.skin[p]
  ctx.fillRect(-4, -14, 8, 8)

  // Hair
  drawHair(ctx, 0, 0, p, 0)

  // Eyes
  ctx.fillStyle = "#222"
  ctx.fillRect(-2, -10, 2, 2)
  ctx.fillRect(1, -10, 2, 2)
  // Pupils
  ctx.fillStyle = "#111"
  ctx.fillRect(-1, -10, 1, 1)
  ctx.fillRect(2, -10, 1, 1)

  // Mouth
  ctx.fillStyle = "#553333"
  ctx.fillRect(0, -7, 1, 1)

  // Glasses
  if (glasses(p)) drawGlasses(ctx, 0, 0, 0)

  ctx.restore()
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 1, p.y - 1, 3, 3)
  }
  ctx.globalAlpha = 1
}

function drawCharacter(ctx: CanvasRenderingContext2D, char: Character, time: number, hovered: boolean) {
  const x = char.x
  const y = char.y - char.hop
  const p = char.palette % PALETTES.skin.length
  const bobble = char.state === "typing" ? Math.sin(time * 8) * 1 : 0
  const breathe = Math.sin(time * 2) * 0.5
  const tilt = char.state === "reading" ? 1 : 0

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)"
  ctx.beginPath()
  ctx.ellipse(x, y + CHAR_H / 2 + 2, 7, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Body/torso — sitting, show upper half
  ctx.fillStyle = PALETTES.shirt[p % PALETTES.shirt.length]
  ctx.fillRect(x - 4, y - 4 + breathe, 8, 12)
  // Collar detail
  ctx.fillStyle = "rgba(255,255,255,0.2)"
  ctx.fillRect(x - 2, y - 4 + breathe, 4, 1)

  // Arms based on state
  ctx.fillStyle = PALETTES.shirt[p % PALETTES.shirt.length]
  if (char.state === "typing") {
    // Arms reach forward to keyboard
    ctx.fillRect(x - 8, y + bobble, 5, 3)
    ctx.fillRect(x + 3, y - bobble, 5, 3)
    // Hands on keyboard
    ctx.fillStyle = PALETTES.skin[p]
    ctx.fillRect(x - 9, y + bobble, 2, 2)
    ctx.fillRect(x + 7, y - bobble, 2, 2)
  } else if (char.state === "reading") {
    // Arms resting, slightly forward
    ctx.fillRect(x - 7, y - 1, 3, 7)
    ctx.fillRect(x + 4, y - 1, 3, 7)
    ctx.fillStyle = PALETTES.skin[p]
    ctx.fillRect(x - 7, y + 5, 3, 2)
    ctx.fillRect(x + 4, y + 5, 3, 2)
  } else if (char.state === "idle" && char.agent.status === "idle") {
    // Hands on lap, occasional head droop
    ctx.fillRect(x - 6, y - 1 + breathe, 3, 8)
    ctx.fillRect(x + 3, y - 1 + breathe, 3, 8)
    ctx.fillStyle = PALETTES.skin[p]
    ctx.fillRect(x - 4, y + 6 + breathe, 8, 2)
  } else {
    // Default arms at sides
    ctx.fillRect(x - 7, y - 2 + breathe, 3, 8)
    ctx.fillRect(x + 4, y - 2 + breathe, 3, 8)
  }

  // Head — 8×8 with tilt for reading
  ctx.fillStyle = PALETTES.skin[p]
  ctx.fillRect(x - 4 + tilt, y - 14 + bobble, 8, 8)

  // Hair (various styles)
  drawHair(ctx, x + tilt, y, p, bobble)

  // Eyes with blink
  const blink = Math.sin(time * 3 + p * 2) > 0.95
  const droop = char.state === "idle" && char.agent.status === "idle" && Math.sin(time * 0.5) > 0.7
  ctx.fillStyle = "#222"
  if (droop) {
    // Sleepy half-closed eyes
    ctx.fillRect(x - 2 + tilt, y - 9 + bobble, 2, 1)
    ctx.fillRect(x + 1 + tilt, y - 9 + bobble, 2, 1)
  } else if (blink) {
    ctx.fillRect(x - 2 + tilt, y - 9 + bobble, 2, 1)
    ctx.fillRect(x + 1 + tilt, y - 9 + bobble, 2, 1)
  } else {
    ctx.fillRect(x - 2 + tilt, y - 10 + bobble, 2, 2)
    ctx.fillRect(x + 1 + tilt, y - 10 + bobble, 2, 2)
    // Pupils
    ctx.fillStyle = "#111"
    ctx.fillRect(x - 1 + tilt, y - 10 + bobble, 1, 1)
    ctx.fillRect(x + 2 + tilt, y - 10 + bobble, 1, 1)
  }

  // Mouth
  ctx.fillStyle = "#553333"
  ctx.fillRect(x + tilt, y - 7 + bobble, 1, 1)

  // Glasses
  if (glasses(p)) drawGlasses(ctx, x + tilt, y, bobble)

  // Status indicator
  if (char.state === "celebrating") {
    ctx.fillStyle = "#44cc88"
    ctx.font = "bold 10px monospace"
    ctx.textAlign = "center"
    ctx.fillText("✓", x, y - 20)
  } else if (char.state === "typing") {
    const dots = Math.floor(time * 4) % 4
    ctx.fillStyle = "#88ffaa"
    for (let i = 0; i < dots; i++) {
      ctx.fillRect(x + 8 + i * 3, y - 16, 2, 2)
    }
  } else if (char.agent.status === "idle") {
    ctx.fillStyle = "#8888aa"
    ctx.font = "8px monospace"
    const zz = "z".repeat(1 + (Math.floor(time * 2) % 3))
    ctx.fillText(zz, x + 6, y - 16 - Math.sin(time * 2) * 2)
  }

  // Hover highlight
  if (hovered) {
    ctx.strokeStyle = "#ffcc44"
    ctx.lineWidth = 1
    ctx.strokeRect(x - 9, y - 18, 18, 30)
  }
}

function drawDecoration(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, time: number) {
  if (type === "plant") {
    // Taller pot
    ctx.fillStyle = COLORS.pot
    ctx.fillRect(x - 6, y + 6, 12, 10)
    ctx.fillStyle = COLORS.potRim
    ctx.fillRect(x - 8, y + 4, 16, 3)
    // Soil
    ctx.fillStyle = "#5a4020"
    ctx.fillRect(x - 5, y + 4, 10, 2)
    // Main stem
    const sway = Math.sin(time * 1.5 + x) * 1.5
    ctx.fillStyle = "#337733"
    ctx.fillRect(x - 1 + sway, y - 18, 2, 22)
    // Secondary stems
    ctx.fillRect(x + 3 + sway * 0.8, y - 12, 2, 16)
    ctx.fillRect(x - 4 + sway * 1.2, y - 10, 2, 14)
    // Varied leaves
    ctx.fillStyle = COLORS.plant
    ctx.fillRect(x - 7 + sway, y - 18, 6, 4)
    ctx.fillRect(x + 2 + sway, y - 15, 6, 4)
    ctx.fillStyle = COLORS.plantLight
    ctx.fillRect(x - 5 + sway, y - 10, 4, 3)
    ctx.fillRect(x + 1 + sway, y - 20, 5, 3)
    ctx.fillStyle = COLORS.plantDark
    ctx.fillRect(x - 6 + sway, y - 17, 3, 2)
    ctx.fillRect(x + 4 + sway, y - 14, 3, 2)
    ctx.fillRect(x - 3 + sway * 0.8, y - 12, 3, 2)
    // Leaf veins
    ctx.fillStyle = "#338833"
    ctx.fillRect(x - 5 + sway, y - 17, 1, 3)
    ctx.fillRect(x + 4 + sway, y - 14, 1, 3)
    return
  }
  if (type === "coffee") {
    // Machine body (water cooler style)
    ctx.fillStyle = COLORS.coffee
    ctx.fillRect(x - 8, y - 6, 16, 18)
    // Top reservoir
    ctx.fillStyle = "#aabbcc"
    ctx.fillRect(x - 6, y - 10, 12, 5)
    ctx.fillStyle = "#88aacc"
    ctx.fillRect(x - 5, y - 9, 10, 3)
    // Front panel
    ctx.fillStyle = COLORS.coffeeDark
    ctx.fillRect(x - 6, y - 2, 12, 12)
    // Buttons
    ctx.fillStyle = "#44cc88"
    ctx.fillRect(x - 4, y, 3, 2)
    ctx.fillStyle = "#cc4444"
    ctx.fillRect(x + 1, y, 3, 2)
    ctx.fillStyle = "#ccaa44"
    ctx.fillRect(x - 1, y + 3, 2, 2)
    // Dispenser nozzle
    ctx.fillStyle = "#555"
    ctx.fillRect(x - 1, y + 6, 2, 2)
    // Cup
    ctx.fillStyle = "#eee"
    ctx.fillRect(x - 2, y + 8, 4, 3)
    // Steam animation
    ctx.fillStyle = COLORS.steam
    const s = Math.sin(time * 3) * 2
    ctx.globalAlpha = 0.5
    ctx.fillRect(x - 1 + s, y - 14, 1, 4)
    ctx.fillRect(x + 1 - s, y - 16, 1, 5)
    ctx.fillRect(x + s * 0.5, y - 18, 1, 3)
    ctx.globalAlpha = 1
    return
  }
  if (type === "shelf") {
    // Bookshelf — 2-tile tall
    ctx.fillStyle = COLORS.shelf
    ctx.fillRect(x - 10, y - 24, 20, 36)
    // Back
    ctx.fillStyle = COLORS.shelfDark
    ctx.fillRect(x - 9, y - 23, 18, 34)
    // Shelf boards
    ctx.fillStyle = COLORS.shelf
    ctx.fillRect(x - 10, y - 12, 20, 2)
    ctx.fillRect(x - 10, y, 20, 2)
    // Books — top shelf (varied colors and heights)
    const tops = ["#cc4444", "#4488cc", "#44aa44", "#aa44aa", "#ccaa22"]
    for (let i = 0; i < 5; i++) {
      const bh = 8 + (i % 3) * 2
      ctx.fillStyle = tops[i]
      ctx.fillRect(x - 8 + i * 4, y - 12 - bh, 3, bh)
    }
    // Books — middle shelf
    const mids = ["#336699", "#cc6633", "#669933", "#993366", "#666699"]
    for (let i = 0; i < 5; i++) {
      const bh = 7 + ((i + 1) % 3) * 2
      ctx.fillStyle = mids[i]
      ctx.fillRect(x - 8 + i * 4, y - bh, 3, bh)
    }
    // Books — bottom shelf
    const bots = ["#884422", "#226688", "#448844", "#664488", "#886644"]
    for (let i = 0; i < 4; i++) {
      const bh = 8 + (i % 2) * 3
      ctx.fillStyle = bots[i]
      ctx.fillRect(x - 7 + i * 4, y + 2, 3, bh)
    }
    return
  }
  if (type === "cat") {
    const purr = Math.sin(time * 4) * 0.5
    const stretch = Math.sin(time * 0.3) > 0.9
    const len = stretch ? 12 : 10
    // Body with stripes
    ctx.fillStyle = COLORS.cat
    ctx.fillRect(x - 5, y + purr, len, 6)
    // Stripes on body
    ctx.fillStyle = COLORS.catStripe
    ctx.fillRect(x - 3, y + 1 + purr, 2, 4)
    ctx.fillRect(x + 1, y + 1 + purr, 2, 4)
    // Belly highlight
    ctx.fillStyle = COLORS.catLight
    ctx.fillRect(x - 4, y + 4 + purr, 8, 1)
    // Head
    ctx.fillStyle = COLORS.cat
    ctx.fillRect(x - 4, y - 5 + purr, 8, 6)
    // Ears
    ctx.fillRect(x - 4, y - 8 + purr, 3, 3)
    ctx.fillRect(x + 1, y - 8 + purr, 3, 3)
    // Inner ears
    ctx.fillStyle = "#ffcc88"
    ctx.fillRect(x - 3, y - 7 + purr, 1, 2)
    ctx.fillRect(x + 2, y - 7 + purr, 1, 2)
    // Whiskers
    ctx.fillStyle = "#ddddbb"
    ctx.fillRect(x - 6, y - 2 + purr, 3, 1)
    ctx.fillRect(x + 3, y - 2 + purr, 3, 1)
    // Eyes
    const blink = Math.sin(time * 2 + 1) > 0.9
    ctx.fillStyle = "#222"
    if (blink) {
      ctx.fillRect(x - 2, y - 2 + purr, 2, 1)
      ctx.fillRect(x + 1, y - 2 + purr, 2, 1)
    } else {
      ctx.fillRect(x - 2, y - 3 + purr, 2, 2)
      ctx.fillRect(x + 1, y - 3 + purr, 2, 2)
      ctx.fillStyle = "#88cc44"
      ctx.fillRect(x - 2, y - 3 + purr, 1, 1)
      ctx.fillRect(x + 2, y - 3 + purr, 1, 1)
    }
    // Nose
    ctx.fillStyle = "#dd8899"
    ctx.fillRect(x, y - 1 + purr, 1, 1)
    // Tail with animated wag
    ctx.fillStyle = COLORS.cat
    const wag = Math.sin(time * 3) * 4
    ctx.fillRect(x + 5, y - 1 + wag, 3, 2)
    ctx.fillRect(x + 7, y - 2 + wag * 0.8, 3, 2)
    ctx.fillRect(x + 9, y - 3 + wag * 0.5, 2, 2)
    // Paws
    ctx.fillStyle = COLORS.catLight
    ctx.fillRect(x - 5, y + 5 + purr, 3, 2)
    ctx.fillRect(x + 3, y + 5 + purr, 3, 2)
    // Toe beans
    ctx.fillStyle = "#dd8899"
    ctx.fillRect(x - 4, y + 6 + purr, 1, 1)
    ctx.fillRect(x + 4, y + 6 + purr, 1, 1)
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, char: Character, hovered: boolean, scale: number) {
  const x = char.x
  const y = char.y + CHAR_H / 2 + 12
  const size = Math.max(8, Math.round(10 / scale))

  ctx.font = `bold ${size}px monospace`
  ctx.textAlign = "center"

  ctx.fillStyle = hovered ? "#ffcc44" : "#ccccdd"
  ctx.fillText(`@${char.agent.agent}`, x, y)

  ctx.font = `${size - 1}px monospace`
  ctx.fillStyle = char.agent.status === "busy" ? "#44cc88" : "#888899"
  const label = char.agent.status === "busy"
    ? char.agent.tool || "working..."
    : char.agent.duration > 0
      ? `done · ${formatDuration(char.agent.duration)}`
      : "idle"
  ctx.fillText(label, x, y + size + 2)
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m${s % 60}s`
}
