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
  floor: ["#3a3a5c", "#33334f"],
  wall: "#4a4a6a",
  desk: "#6b5b3d",
  monitor: "#1a1a2e",
  screen: "#44cc88",
  screenBusy: "#44cc88",
  screenIdle: "#334455",
  chair: "#555577",
  plant: "#44aa55",
  pot: "#8b6b3d",
  coffee: "#887766",
  steam: "#aaaacc",
  shelf: "#7a6a4a",
  cat: "#ddaa55",
  skin: [
    "#f5d0a9", "#e8b88a", "#d4956b", "#c07850", "#8b5e3c", "#5c3d2e",
  ],
  hair: ["#2a1a0a", "#5a3a1a", "#8b6b3a", "#cc9944", "#dd5533", "#222244"],
  shirt: ["#4488cc", "#cc4444", "#44aa44", "#aa44aa", "#ccaa22", "#44aaaa"],
}

function checkerboard(x: number, y: number) {
  return (Math.floor(x / TILE) + Math.floor(y / TILE)) % 2 === 0
}

export function layout(count: number): Office {
  const cols = Math.min(count, 4)
  const rows = Math.ceil(count / cols)
  const w = cols * 3 + 2
  const h = rows * 3 + 3
  const desks: Desk[] = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    desks.push({ x: (col * 3 + 2) * TILE, y: (row * 3 + 2) * TILE })
  }
  const decorations: Office["decorations"] = [
    { x: TILE, y: TILE, type: "plant" },
    { x: (w - 2) * TILE, y: TILE, type: "coffee" },
  ]
  if (w > 6) decorations.push({ x: Math.floor(w / 2) * TILE, y: (h - 2) * TILE, type: "cat" })
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
    }
  }

  // Walls
  ctx.fillStyle = COLORS.wall
  ctx.fillRect(0, 0, w, TILE)
  ctx.fillRect(0, 0, TILE, h)
  ctx.fillRect(w - TILE, 0, TILE, h)

  // Door opening on bottom wall
  ctx.fillStyle = COLORS.floor[0]
  ctx.fillRect(Math.floor(w / 2) - TILE, h - TILE, TILE * 2, TILE)

  // Decorations
  for (const dec of office.decorations) {
    drawDecoration(ctx, dec.x, dec.y, dec.type, time)
  }

  // Desks + characters (sorted by y for depth)
  const sorted = [...chars].sort((a, b) => a.y - b.y)
  for (const char of sorted) {
    const desk = office.desks.find((d) => d.x === char.tx && d.y === char.ty)
    if (desk && char.state !== "walking") drawDesk(ctx, desk.x, desk.y, char.agent.status === "busy")
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
  // Desk surface
  ctx.fillStyle = COLORS.desk
  ctx.fillRect(x - 12, y - 4, 24, 12)
  // Legs
  ctx.fillRect(x - 10, y + 8, 3, 6)
  ctx.fillRect(x + 7, y + 8, 3, 6)
  // Monitor
  ctx.fillStyle = COLORS.monitor
  ctx.fillRect(x - 6, y - 14, 12, 10)
  // Screen
  ctx.fillStyle = active ? COLORS.screenBusy : COLORS.screenIdle
  ctx.fillRect(x - 5, y - 13, 10, 8)
  // Screen glow lines when active
  if (active) {
    ctx.fillStyle = "#55ddaa"
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - 3, y - 12 + i * 3, 6 + (i % 2 ? -2 : 0), 1)
    }
  }
  // Monitor stand
  ctx.fillStyle = COLORS.monitor
  ctx.fillRect(x - 1, y - 4, 2, 2)
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

  // Chair (behind character)
  ctx.fillStyle = COLORS.chair
  ctx.fillRect(x - 5, y + 2, 10, 8)
  ctx.fillRect(x - 6, y - 2, 2, 12)
  ctx.fillRect(x + 4, y - 2, 2, 12)

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
    ctx.fillStyle = COLORS.pot
    ctx.fillRect(x - 4, y + 2, 8, 6)
    ctx.fillStyle = COLORS.plant
    const sway = Math.sin(time + x) * 1
    ctx.fillRect(x - 3 + sway, y - 8, 2, 10)
    ctx.fillRect(x + 1 + sway, y - 10, 2, 12)
    ctx.fillRect(x - 5 + sway, y - 6, 3, 3)
    ctx.fillRect(x + 3 + sway, y - 8, 3, 3)
  } else if (type === "coffee") {
    ctx.fillStyle = COLORS.coffee
    ctx.fillRect(x - 5, y - 2, 10, 10)
    ctx.fillRect(x - 3, y - 4, 6, 2)
    // Steam
    ctx.fillStyle = COLORS.steam
    const s = Math.sin(time * 3) * 2
    ctx.fillRect(x - 1 + s, y - 8, 1, 3)
    ctx.fillRect(x + 2 - s, y - 10, 1, 4)
  } else if (type === "cat") {
    const purr = Math.sin(time * 4) * 0.5
    ctx.fillStyle = COLORS.cat
    // Body
    ctx.fillRect(x - 4, y + purr, 8, 5)
    // Head
    ctx.fillRect(x - 3, y - 4 + purr, 6, 5)
    // Ears
    ctx.fillRect(x - 3, y - 6 + purr, 2, 2)
    ctx.fillRect(x + 1, y - 6 + purr, 2, 2)
    // Eyes
    ctx.fillStyle = "#222"
    ctx.fillRect(x - 1, y - 2 + purr, 1, 1)
    ctx.fillRect(x + 1, y - 2 + purr, 1, 1)
    // Tail
    ctx.fillStyle = COLORS.cat
    ctx.fillRect(x + 4, y - 1 + Math.sin(time * 2) * 2, 4, 2)
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
