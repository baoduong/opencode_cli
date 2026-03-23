import { TILE, CHAR_W, CHAR_H, CHAR_FRAMES, CHAR_DIRS, CHAR_COUNT, img, type CharacterState } from "./sprites"

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

// Preload tile and furniture images
const FLOOR = img("/office/floor.png")
const WALL = img("/office/wall.png")
const DESK = img("/office/desk.png")
const PC_ON = img("/office/pc_on.png")
const PC_OFF = img("/office/pc_off.png")
const CHAIR = img("/office/chair.png")
const BOOKSHELF = img("/office/bookshelf.png")
const WHITEBOARD = img("/office/whiteboard.png")
const PLANT = img("/office/plant.png")
const LARGE_PLANT = img("/office/large_plant.png")
const COFFEE = img("/office/coffee.png")
const COFFEE_TABLE = img("/office/coffee_table.png")
const CLOCK = img("/office/clock.png")
const PAINTING = img("/office/painting.png")
const CACTUS = img("/office/cactus.png")
const SOFA = img("/office/sofa.png")
const BIN = img("/office/bin.png")

function ready(el: HTMLImageElement): boolean {
  return el.complete && el.naturalWidth > 0
}

function drawChar(
  ctx: CanvasRenderingContext2D,
  palette: number,
  frame: number,
  dir: "down" | "up" | "right",
  x: number,
  y: number,
  flip?: boolean,
) {
  const sheet = img(`/office/char_${palette % CHAR_COUNT}.png`)
  if (!ready(sheet)) return
  const row = CHAR_DIRS[dir]
  const sx = frame * CHAR_W
  const sy = row * CHAR_H
  if (flip) {
    ctx.save()
    ctx.translate(x + CHAR_W, y)
    ctx.scale(-1, 1)
    ctx.drawImage(sheet, sx, sy, CHAR_W, CHAR_H, 0, 0, CHAR_W, CHAR_H)
    ctx.restore()
    return
  }
  ctx.drawImage(sheet, sx, sy, CHAR_W, CHAR_H, x, y, CHAR_W, CHAR_H)
}

function sprite(ctx: CanvasRenderingContext2D, el: HTMLImageElement, x: number, y: number) {
  if (ready(el)) ctx.drawImage(el, x, y)
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

  // Floor tiles
  if (ready(FLOOR)) {
    for (let y = 0; y < h; y += 16) {
      for (let x = 0; x < w; x += 16) {
        ctx.drawImage(FLOOR, x, y)
      }
    }
  }

  // Top wall — 2 tiles high using wall.png (64×128), tile the top-left 16×16 portion
  if (ready(WALL)) {
    for (let y = 0; y < TILE * 2; y += 16) {
      for (let x = 0; x < w; x += 16) {
        ctx.drawImage(WALL, 0, y, 16, 16, x, y, 16, 16)
      }
    }
  }

  // Side walls — 1 tile wide
  if (ready(WALL)) {
    for (let y = TILE * 2; y < h - TILE; y += 16) {
      ctx.drawImage(WALL, 0, 0, 16, 16, 0, y, 16, 16)
      ctx.drawImage(WALL, 0, 0, 16, 16, 16, y, 16, 16)
      ctx.drawImage(WALL, 0, 0, 16, 16, w - TILE, y, 16, 16)
      ctx.drawImage(WALL, 0, 0, 16, 16, w - 16, y, 16, 16)
    }
  }

  // Bottom wall with door opening
  const doorX = Math.floor(w / 2)
  if (ready(WALL)) {
    for (let x = 0; x < w; x += 16) {
      if (x < doorX - TILE || x >= doorX + TILE) {
        ctx.drawImage(WALL, 0, 0, 16, 16, x, h - TILE, 16, 16)
        ctx.drawImage(WALL, 0, 0, 16, 16, x, h - 16, 16, 16)
      }
    }
  }

  // Door opening (procedural — no sprite)
  ctx.fillStyle = "#3a2a1a"
  ctx.fillRect(doorX - TILE - 2, h - TILE, 4, TILE)
  ctx.fillRect(doorX + TILE - 2, h - TILE, 4, TILE)
  ctx.fillRect(doorX - TILE - 2, h - TILE, TILE * 2 + 4, 3)
  ctx.fillStyle = "#2a2a3e"
  ctx.fillRect(doorX - TILE + 2, h - TILE + 3, TILE * 2 - 4, TILE - 3)

  // Wall decorations
  drawWallDecor(ctx, w, h, time)

  // Floor decorations
  for (const dec of office.decorations) {
    drawDecoration(ctx, dec.x, dec.y, dec.type, time)
  }

  // Desks
  for (const desk of office.desks) {
    const busy = chars.some((c) => c.tx === desk.x && c.ty === desk.y && c.agent.status === "busy")
    drawDesk(ctx, desk.x, desk.y, busy)
  }

  // Characters sorted by y for depth
  const sorted = [...chars].sort((a, b) => a.y - b.y)
  for (const c of sorted) {
    drawCharacter(ctx, c, time, hover === chars.indexOf(c))
  }

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - 1, p.y - 1, 3, 3)
  }
  ctx.globalAlpha = 1

  // Labels
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (c.state === "walking") continue
    drawLabel(ctx, c, i === hover, scale)
  }
}

function drawWallDecor(ctx: CanvasRenderingContext2D, w: number, h: number, _time: number) {
  // Whiteboard on top wall
  sprite(ctx, WHITEBOARD, TILE + 8, TILE * 2 - 32)
  // Clock on top wall
  sprite(ctx, CLOCK, Math.floor(w / 2) - 8, 0)
  // Painting on top wall
  sprite(ctx, PAINTING, w - TILE * 3, 0)
  // Bookshelf against top wall
  sprite(ctx, BOOKSHELF, TILE * 2 + 8, TILE * 2 - 16)
  // Plants in corners
  sprite(ctx, LARGE_PLANT, 4, h - TILE - 48)
  sprite(ctx, PLANT, w - TILE - 16, TILE * 2)
  sprite(ctx, CACTUS, w - TILE * 2, h - TILE - 32)
  // Sofa in break area
  sprite(ctx, SOFA, TILE * 2, h - TILE - 20)
  // Coffee table near sofa
  sprite(ctx, COFFEE_TABLE, TILE * 2 + 36, h - TILE - 36)
  // Coffee on table
  sprite(ctx, COFFEE, TILE * 2 + 44, h - TILE - 52)
  // Bin near door
  sprite(ctx, BIN, doorX(w) + TILE + 8, h - TILE - 16)
}

function doorX(w: number): number {
  return Math.floor(w / 2)
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean) {
  // desk.png is 48×32, center on desk position
  sprite(ctx, DESK, x - 24, y - 8)
  // PC on top of desk
  const pc = active ? PC_ON : PC_OFF
  sprite(ctx, pc, x - 8, y - 36)
  // Chair in front of desk
  sprite(ctx, CHAIR, x - 8, y + 24)
}

function drawCharacter(ctx: CanvasRenderingContext2D, char: Character, time: number, hovered: boolean) {
  const x = char.x
  const y = char.y

  if (char.state === "walking") {
    const cycle = Math.floor(time / 0.1) % 6 + 1
    const dx = char.tx - char.x
    const dy = char.ty - char.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx > absDy) {
      // Moving horizontally
      const flip = dx < 0
      drawChar(ctx, char.palette, cycle, "right", x - CHAR_W / 2, y - CHAR_H + 8, flip)
    } else if (dy > 0) {
      drawChar(ctx, char.palette, cycle, "down", x - CHAR_W / 2, y - CHAR_H + 8)
    } else {
      drawChar(ctx, char.palette, cycle, "up", x - CHAR_W / 2, y - CHAR_H + 8)
    }
    return
  }

  // Seated / stationary states
  const hop = char.state === "celebrating" ? char.hop : 0
  const py = y - hop

  if (char.state === "typing") {
    const frame = Math.floor(time / 0.3) % 2 + 1
    drawChar(ctx, char.palette, frame, "down", x - CHAR_W / 2, py - CHAR_H + 8)
  } else if (char.state === "celebrating") {
    drawChar(ctx, char.palette, 0, "down", x - CHAR_W / 2, py - CHAR_H + 8)
    ctx.fillStyle = "#44cc88"
    ctx.font = "bold 10px monospace"
    ctx.textAlign = "center"
    ctx.fillText("✓", x, py - CHAR_H - 4)
  } else {
    drawChar(ctx, char.palette, 0, "down", x - CHAR_W / 2, py - CHAR_H + 8)
  }

  // Status indicators
  if (char.state === "typing") {
    const dots = Math.floor(time * 4) % 4
    ctx.fillStyle = "#88ffaa"
    for (let i = 0; i < dots; i++) {
      ctx.fillRect(x + 8 + i * 3, py - CHAR_H - 2, 2, 2)
    }
  } else if (char.agent.status === "idle" && char.state !== "celebrating") {
    ctx.fillStyle = "#8888aa"
    ctx.font = "8px monospace"
    const zz = "z".repeat(1 + (Math.floor(time * 2) % 3))
    ctx.fillText(zz, x + 6, py - CHAR_H - 2 - Math.sin(time * 2) * 2)
  }

  // Hover highlight
  if (hovered) {
    ctx.strokeStyle = "#ffcc44"
    ctx.lineWidth = 1
    ctx.strokeRect(x - CHAR_W / 2 - 2, py - CHAR_H + 6, CHAR_W + 4, CHAR_H + 4)
  }
}

function drawDecoration(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, _time: number) {
  if (type === "plant") {
    sprite(ctx, PLANT, x - 8, y - 16)
    return
  }
  if (type === "coffee") {
    sprite(ctx, COFFEE_TABLE, x - 16, y - 16)
    sprite(ctx, COFFEE, x - 8, y - 32)
    return
  }
  if (type === "shelf") {
    sprite(ctx, BOOKSHELF, x - 16, y - 8)
    return
  }
  if (type === "cat") {
    // Keep procedural cat — no sprite asset
    const purr = Math.sin(_time * 4) * 0.5
    ctx.fillStyle = "#eeaa44"
    ctx.fillRect(x - 5, y + purr, 10, 6)
    ctx.fillRect(x - 4, y - 5 + purr, 8, 6)
    ctx.fillRect(x - 4, y - 8 + purr, 3, 3)
    ctx.fillRect(x + 1, y - 8 + purr, 3, 3)
    ctx.fillStyle = "#222"
    ctx.fillRect(x - 2, y - 3 + purr, 2, 2)
    ctx.fillRect(x + 1, y - 3 + purr, 2, 2)
    ctx.fillStyle = "#dd8899"
    ctx.fillRect(x, y - 1 + purr, 1, 1)
    const wag = Math.sin(_time * 3) * 4
    ctx.fillStyle = "#eeaa44"
    ctx.fillRect(x + 5, y - 1 + wag, 3, 2)
    ctx.fillRect(x + 7, y - 2 + wag * 0.8, 3, 2)
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
      ? `done · ${duration(char.agent.duration)}`
      : "idle"
  ctx.fillText(label, x, y + size + 2)
}

function duration(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m${s % 60}s`
}
