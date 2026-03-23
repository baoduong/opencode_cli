import { TILE, CHAR_W, CHAR_H, type CharacterState } from "./sprites"

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
  spawn: number // timestamp when spawned (for pop-in)
  facing: number // 1 = right, -1 = left
  hop: number // bounce offset for celebration
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
  floor: ["#4e4e72", "#464668"],
  wall: "#5a5a7e",
  wallTop: "#6a6a8e",
  desk: "#8b7355",
  deskTop: "#a08a66",
  monitor: "#1a1a2e",
  screen: "#44cc88",
  screenBusy: "#44cc88",
  screenIdle: "#334455",
  chair: "#666688",
  plant: "#55cc66",
  pot: "#aa7744",
  coffee: "#998877",
  steam: "#bbbbdd",
  shelf: "#8a7a5a",
  cat: "#eeaa44",
  skin: [
    "#f5d0a9", "#e8b88a", "#d4956b", "#c07850", "#8b5e3c", "#5c3d2e",
  ],
  hair: ["#2a1a0a", "#5a3a1a", "#8b6b3a", "#cc9944", "#dd5533", "#222244"],
  shirt: ["#4488cc", "#cc4444", "#44aa44", "#aa44aa", "#ccaa22", "#44aaaa"],
  door: "#3a2a1a",
  doorFrame: "#6a5a3a",
  rug: "#664433",
}

function checkerboard(x: number, y: number) {
  return (Math.floor(x / TILE) + Math.floor(y / TILE)) % 2 === 0
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

  // Floor
  for (let y = 0; y < h; y += TILE) {
    for (let x = 0; x < w; x += TILE) {
      ctx.fillStyle = checkerboard(x, y) ? COLORS.floor[0] : COLORS.floor[1]
      ctx.fillRect(x, y, TILE, TILE)
      // Floor tile border
      ctx.fillStyle = "rgba(0,0,0,0.08)"
      ctx.fillRect(x, y, TILE, 1)
      ctx.fillRect(x, y, 1, TILE)
    }
  }

  // Welcome rug at door (small doormat)
  const doorX = Math.floor(w / 2)
  ctx.fillStyle = COLORS.rug
  ctx.fillRect(doorX - 12, h - TILE * 2 + 6, 24, 12)
  ctx.fillStyle = "#775544"
  ctx.fillRect(doorX - 10, h - TILE * 2 + 8, 20, 8)

  // Walls — thicker, with top highlight
  ctx.fillStyle = COLORS.wall
  ctx.fillRect(0, 0, w, TILE)
  ctx.fillRect(0, 0, TILE, h)
  ctx.fillRect(w - TILE, 0, TILE, h)
  // Wall top edge
  ctx.fillStyle = COLORS.wallTop
  ctx.fillRect(0, 0, w, 4)
  ctx.fillRect(0, 0, 4, h)
  ctx.fillRect(w - 4, 0, 4, h)

  // Bottom wall with door opening
  ctx.fillStyle = COLORS.wall
  ctx.fillRect(0, h - TILE, doorX - TILE, TILE)
  ctx.fillRect(doorX + TILE, h - TILE, w - doorX - TILE, TILE)
  // Door frame
  ctx.fillStyle = COLORS.doorFrame
  ctx.fillRect(doorX - TILE - 2, h - TILE, 4, TILE)
  ctx.fillRect(doorX + TILE - 2, h - TILE, 4, TILE)
  ctx.fillRect(doorX - TILE - 2, h - TILE, TILE * 2 + 4, 3)
  // Door opening (darker floor to suggest hallway)
  ctx.fillStyle = "#2a2a3e"
  ctx.fillRect(doorX - TILE + 2, h - TILE + 3, TILE * 2 - 4, TILE - 3)

  // Wall decorations — clock and whiteboard
  // Clock on top wall (small)
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
  // Hands
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

  // Whiteboard on left wall (small, on wall only)
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

  // Decorations
  for (const dec of office.decorations) {
    drawDecoration(ctx, dec.x, dec.y, dec.type, time)
  }

  // Draw all desks first (even empty ones)
  const occupied = new Set(chars.filter((c) => c.state !== "walking").map((c) => `${c.tx},${c.ty}`))
  for (const desk of office.desks) {
    const busy = chars.some((c) => c.tx === desk.x && c.ty === desk.y && c.agent.status === "busy")
    drawDesk(ctx, desk.x, desk.y, busy)
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

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean) {
  // Chair (behind desk, tucked under)
  ctx.fillStyle = COLORS.chair
  ctx.fillRect(x - 5, y + 10, 10, 6)
  // Chair back
  ctx.fillStyle = "#5a5a7a"
  ctx.fillRect(x - 6, y + 14, 12, 4)
  ctx.fillRect(x - 6, y + 10, 2, 8)
  ctx.fillRect(x + 4, y + 10, 2, 8)

  // Desk surface
  ctx.fillStyle = COLORS.deskTop
  ctx.fillRect(x - 14, y - 4, 28, 3)
  ctx.fillStyle = COLORS.desk
  ctx.fillRect(x - 14, y - 1, 28, 10)
  // Legs
  ctx.fillStyle = "#6a5a3a"
  ctx.fillRect(x - 12, y + 9, 3, 6)
  ctx.fillRect(x + 9, y + 9, 3, 6)
  // Drawer
  ctx.fillStyle = "#7a6a4a"
  ctx.fillRect(x - 4, y + 1, 8, 6)
  ctx.fillStyle = "#8a7a5a"
  ctx.fillRect(x - 1, y + 3, 2, 2)
  // Monitor
  ctx.fillStyle = COLORS.monitor
  ctx.fillRect(x - 7, y - 16, 14, 12)
  // Screen
  ctx.fillStyle = active ? COLORS.screenBusy : COLORS.screenIdle
  ctx.fillRect(x - 6, y - 15, 12, 10)
  // Screen glow lines when active
  if (active) {
    ctx.fillStyle = "#55ddaa"
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x - 4, y - 14 + i * 3, 8 + (i % 2 ? -3 : 0), 1)
    }
    // Screen glow
    ctx.fillStyle = "rgba(68, 204, 136, 0.1)"
    ctx.fillRect(x - 10, y - 18, 20, 16)
  }
  // Monitor stand
  ctx.fillStyle = COLORS.monitor
  ctx.fillRect(x - 2, y - 4, 4, 2)
  ctx.fillRect(x - 4, y - 4, 8, 1)
  // Keyboard
  ctx.fillStyle = "#444"
  ctx.fillRect(x - 5, y - 2, 10, 2)
  ctx.fillStyle = "#555"
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - 4 + i * 3, y - 2, 2, 1)
  }
}

function drawWalkingCharacter(ctx: CanvasRenderingContext2D, char: Character, time: number) {
  const x = char.x
  const y = char.y
  const p = char.palette % COLORS.skin.length

  // Pop-in scale
  const age = time - char.spawn
  const pop = age < 0.3 ? age / 0.3 : 1

  ctx.save()
  ctx.translate(x, y)
  ctx.scale(char.facing * pop, pop)

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)"
  ctx.beginPath()
  ctx.ellipse(0, CHAR_H / 2 + 2, 6, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Leg animation — alternating stride
  const stride = Math.sin(time * 10) * 3
  ctx.fillStyle = "#334"
  ctx.fillRect(-3, 4, 3, 8)
  ctx.fillRect(0, 4, 3, 8)
  // Offset legs
  ctx.fillRect(-3 + stride, 10, 3, 3)
  ctx.fillRect(0 - stride, 10, 3, 3)

  // Body
  ctx.fillStyle = COLORS.shirt[p % COLORS.shirt.length]
  ctx.fillRect(-4, -4, 8, 10)

  // Arms swinging
  const swing = Math.sin(time * 10) * 4
  ctx.fillRect(-6, -2 + swing, 3, 7)
  ctx.fillRect(3, -2 - swing, 3, 7)

  // Head
  ctx.fillStyle = COLORS.skin[p]
  ctx.fillRect(-4, -12, 8, 8)

  // Hair
  ctx.fillStyle = COLORS.hair[p % COLORS.hair.length]
  ctx.fillRect(-4, -14, 8, 3)
  ctx.fillRect(-5, -13, 1, 4)
  ctx.fillRect(4, -13, 1, 4)

  // Eyes
  ctx.fillStyle = "#222"
  ctx.fillRect(-2, -9, 2, 2)
  ctx.fillRect(1, -9, 2, 2)

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
  const p = char.palette % COLORS.skin.length
  const bobble = char.state === "typing" ? Math.sin(time * 8) * 1 : 0
  const breathe = Math.sin(time * 2) * 0.5

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)"
  ctx.beginPath()
  ctx.ellipse(x, y + CHAR_H / 2 + 2, 6, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Body
  ctx.fillStyle = COLORS.shirt[p % COLORS.shirt.length]
  ctx.fillRect(x - 4, y - 4 + breathe, 8, 10)

  // Arms
  if (char.state === "typing") {
    // Arms forward on desk
    ctx.fillRect(x - 7, y + 1 + bobble, 4, 3)
    ctx.fillRect(x + 3, y + 1 - bobble, 4, 3)
    // Hands
    ctx.fillStyle = COLORS.skin[p]
    ctx.fillRect(x - 8, y + 1 + bobble, 2, 2)
    ctx.fillRect(x + 6, y + 1 - bobble, 2, 2)
  } else if (char.state === "reading") {
    ctx.fillRect(x - 6, y, 3, 6)
    ctx.fillRect(x + 3, y, 3, 6)
  } else {
    // Idle arms at sides
    ctx.fillRect(x - 6, y - 2 + breathe, 3, 8)
    ctx.fillRect(x + 3, y - 2 + breathe, 3, 8)
  }

  // Head
  ctx.fillStyle = COLORS.skin[p]
  ctx.fillRect(x - 4, y - 12 + bobble, 8, 8)

  // Hair
  ctx.fillStyle = COLORS.hair[p % COLORS.hair.length]
  ctx.fillRect(x - 4, y - 14 + bobble, 8, 3)
  ctx.fillRect(x - 5, y - 13 + bobble, 1, 4)
  ctx.fillRect(x + 4, y - 13 + bobble, 1, 4)

  // Eyes
  const blink = Math.sin(time * 3 + p * 2) > 0.95
  ctx.fillStyle = "#222"
  if (!blink) {
    ctx.fillRect(x - 2, y - 9 + bobble, 2, 2)
    ctx.fillRect(x + 1, y - 9 + bobble, 2, 2)
  } else {
    ctx.fillRect(x - 2, y - 8 + bobble, 2, 1)
    ctx.fillRect(x + 1, y - 8 + bobble, 2, 1)
  }

  // Status indicator
  if (char.state === "celebrating") {
    ctx.fillStyle = "#44cc88"
    ctx.font = "bold 10px monospace"
    ctx.textAlign = "center"
    ctx.fillText("✓", x, y - 18)
  } else if (char.state === "typing") {
    // Typing dots animation
    const dots = Math.floor(time * 4) % 4
    ctx.fillStyle = "#88ffaa"
    for (let i = 0; i < dots; i++) {
      ctx.fillRect(x + 8 + i * 3, y - 14, 2, 2)
    }
  } else if (char.agent.status === "idle") {
    // Zzz
    ctx.fillStyle = "#8888aa"
    ctx.font = "8px monospace"
    const zz = "z".repeat(1 + (Math.floor(time * 2) % 3))
    ctx.fillText(zz, x + 6, y - 14 - Math.sin(time * 2) * 2)
  }

  // Hover highlight
  if (hovered) {
    ctx.strokeStyle = "#ffcc44"
    ctx.lineWidth = 1
    ctx.strokeRect(x - 8, y - 16, 16, 26)
  }
}

function drawDecoration(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, time: number) {
  if (type === "plant") {
    // Pot
    ctx.fillStyle = COLORS.pot
    ctx.fillRect(x - 6, y + 4, 12, 8)
    ctx.fillRect(x - 8, y + 2, 16, 3)
    // Soil
    ctx.fillStyle = "#5a4020"
    ctx.fillRect(x - 5, y + 2, 10, 2)
    // Stems + leaves
    ctx.fillStyle = COLORS.plant
    const sway = Math.sin(time * 1.5 + x) * 1.5
    ctx.fillRect(x - 1 + sway, y - 14, 2, 16)
    ctx.fillRect(x + 3 + sway, y - 10, 2, 12)
    ctx.fillRect(x - 4 + sway, y - 8, 2, 10)
    // Leaves
    ctx.fillRect(x - 6 + sway, y - 14, 5, 4)
    ctx.fillRect(x + 2 + sway, y - 12, 5, 4)
    ctx.fillRect(x - 4 + sway, y - 8, 4, 3)
    ctx.fillRect(x + 1 + sway, y - 16, 4, 3)
    // Darker leaf detail
    ctx.fillStyle = "#44aa55"
    ctx.fillRect(x - 5 + sway, y - 13, 3, 2)
    ctx.fillRect(x + 3 + sway, y - 11, 3, 2)
  } else if (type === "coffee") {
    // Machine body
    ctx.fillStyle = COLORS.coffee
    ctx.fillRect(x - 8, y - 4, 16, 16)
    // Top
    ctx.fillStyle = "#887766"
    ctx.fillRect(x - 8, y - 6, 16, 3)
    // Front panel
    ctx.fillStyle = "#776655"
    ctx.fillRect(x - 6, y - 2, 12, 10)
    // Buttons
    ctx.fillStyle = "#44cc88"
    ctx.fillRect(x - 4, y, 3, 2)
    ctx.fillStyle = "#cc4444"
    ctx.fillRect(x + 1, y, 3, 2)
    // Cup area
    ctx.fillStyle = "#554433"
    ctx.fillRect(x - 4, y + 4, 8, 4)
    // Cup
    ctx.fillStyle = "#eee"
    ctx.fillRect(x - 2, y + 4, 4, 3)
    // Steam
    ctx.fillStyle = COLORS.steam
    const s = Math.sin(time * 3) * 2
    ctx.globalAlpha = 0.6
    ctx.fillRect(x - 1 + s, y - 10, 1, 4)
    ctx.fillRect(x + 1 - s, y - 12, 1, 5)
    ctx.fillRect(x + s * 0.5, y - 14, 1, 3)
    ctx.globalAlpha = 1
  } else if (type === "cat") {
    const purr = Math.sin(time * 4) * 0.5
    // Body
    ctx.fillStyle = COLORS.cat
    ctx.fillRect(x - 5, y + purr, 10, 6)
    // Head
    ctx.fillRect(x - 4, y - 5 + purr, 8, 6)
    // Ears
    ctx.fillRect(x - 4, y - 8 + purr, 3, 3)
    ctx.fillRect(x + 1, y - 8 + purr, 3, 3)
    // Inner ears
    ctx.fillStyle = "#ffcc88"
    ctx.fillRect(x - 3, y - 7 + purr, 1, 2)
    ctx.fillRect(x + 2, y - 7 + purr, 1, 2)
    // Eyes
    const blink = Math.sin(time * 2 + 1) > 0.9
    ctx.fillStyle = "#222"
    if (blink) {
      ctx.fillRect(x - 2, y - 2 + purr, 2, 1)
      ctx.fillRect(x + 1, y - 2 + purr, 2, 1)
    } else {
      ctx.fillRect(x - 2, y - 3 + purr, 2, 2)
      ctx.fillRect(x + 1, y - 3 + purr, 2, 2)
      // Pupils
      ctx.fillStyle = "#88cc44"
      ctx.fillRect(x - 2, y - 3 + purr, 1, 1)
      ctx.fillRect(x + 2, y - 3 + purr, 1, 1)
    }
    // Nose
    ctx.fillStyle = "#dd8899"
    ctx.fillRect(x, y - 1 + purr, 1, 1)
    // Tail
    ctx.fillStyle = COLORS.cat
    const wag = Math.sin(time * 2) * 3
    ctx.fillRect(x + 5, y - 2 + wag, 3, 2)
    ctx.fillRect(x + 7, y - 3 + wag, 3, 2)
    // Paws
    ctx.fillStyle = "#ddaa44"
    ctx.fillRect(x - 5, y + 5 + purr, 3, 2)
    ctx.fillRect(x + 3, y + 5 + purr, 3, 2)
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, char: Character, hovered: boolean, scale: number) {
  const x = char.x
  const y = char.y + CHAR_H / 2 + 12
  const size = Math.max(8, Math.round(10 / scale))

  ctx.font = `bold ${size}px monospace`
  ctx.textAlign = "center"

  // Name
  ctx.fillStyle = hovered ? "#ffcc44" : "#ccccdd"
  ctx.fillText(`@${char.agent.agent}`, x, y)

  // Status
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
