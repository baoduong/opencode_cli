import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from "solid-js"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useNavigate, useParams } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { TILE, WALK_SPEED } from "./engine/sprites"
import { stateFromTool } from "./engine/sprites"
import { layout, render, spawnParticles, type Agent, type Character, type Office, type Particle } from "./engine/renderer"

export default function OfficePage() {
  const sync = useSync()
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()
  const slug = () => base64Encode(sdk.directory)
  let canvas: HTMLCanvasElement | undefined
  let frame: number
  const [hover, setHover] = createSignal(-1)
  const [scale, setScale] = createSignal(3)
  let particles: Particle[] = []
  let prev: Map<string, Agent["status"]> = new Map()
  let last = Date.now()

  // Fetch ALL sessions (including children) via experimental endpoint, poll for updates
  const [allSessions, setAllSessions] = createSignal<any[]>([])
  const poll = async () => {
    const base = sdk.url
    const res = await fetch(`${base}/experimental/session?directory=${encodeURIComponent(sdk.directory)}&limit=200`)
    if (res.ok) setAllSessions(await res.json())
  }
  onMount(() => {
    poll()
    const interval = setInterval(poll, 3000)
    onCleanup(() => clearInterval(interval))
  })

  // Merge API-fetched sessions with real-time sync data
  const merged = createMemo(() => {
    const synced = Object.values(sync.data.session).flat()
    const fetched = allSessions()
    const map = new Map<string, any>()
    for (const s of fetched) map.set(s.id, s)
    for (const s of synced) map.set(s.id, s)
    return [...map.values()]
  })

  // Find most recently active parent that has children
  const parent = createMemo(() => {
    const all = merged()
    const kids = all.filter((s: any) => s.parentID)
    if (kids.length === 0) {
      const roots = all.filter((s: any) => !s.parentID).sort((a: any, b: any) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0))
      return roots[0]
    }
    const parents = new Map<string, number>()
    for (const s of kids) {
      const t = s.time?.updated ?? s.time?.created ?? 0
      const cur = parents.get(s.parentID) ?? 0
      if (t > cur) parents.set(s.parentID, t)
    }
    let best = ""
    let latest = 0
    for (const [id, t] of parents) {
      if (t > latest) { best = id; latest = t }
    }
    return all.find((s: any) => s.id === best)
  })

  // All sessions as agents: orchestrator first, then children
  const agents = createMemo<Agent[]>(() => {
    const all = merged()
    const p = parent()
    const pid = (p as any)?.id
    const kids = pid ? all.filter((s: any) => s.parentID === pid) : []

    const toAgent = (s: any, orchestrator?: boolean): Agent => {
      const status = sync.data.session_status?.[s.id]
      const msgs = sync.data.message?.[s.id] ?? []
      const parts = msgs.flatMap((m: any) => sync.data.part?.[m.id] ?? [])
      const tool = parts.findLast((p: any) => p.type === "tool" && (p as any).state?.status === "running") as any
      return {
        id: s.id,
        name: orchestrator ? (s.title ?? "Orchestrator") : (s.title?.replace(/\s*\(@\S+ subagent\)\s*$/, "") ?? "Task"),
        agent: orchestrator ? "orchestrator" : (s.title?.match(/@(\S+) subagent/)?.[1] ?? "agent"),
        status: (status?.type ?? "idle") as Agent["status"],
        tool: tool ? `${tool.tool}${tool.state?.title ? ` ${tool.state.title}` : ""}` : "",
        duration: (s.time?.updated ?? 0) - (s.time?.created ?? 0),
      }
    }

    const result: Agent[] = []
    if (p) result.push(toAgent(p, true))
    for (const s of kids) result.push(toAgent(s))
    return result
  })

  // Build office layout and characters
  const [chars, setChars] = createSignal<Character[]>([])
  const [office, setOffice] = createSignal<Office>(layout(1))
  const deskMap = new Map<string, number>()
  let nextDesk = 0

  function doorPos(off: Office) {
    return { x: Math.floor(off.width / 2), y: off.height - TILE / 2 }
  }

  createEffect(on(agents, (list) => {
    const count = Math.max(list.length, 1)
    const off = layout(count)
    setOffice(off)
    const door = doorPos(off)
    const time = (Date.now() - start) / 1000

    // Assign stable desk index per agent ID
    for (const agent of list) {
      if (!deskMap.has(agent.id)) {
        deskMap.set(agent.id, nextDesk++)
      }
    }

    setChars((existing) => {
      return list.map((agent) => {
        const idx = deskMap.get(agent.id)! % off.desks.length
        const desk = off.desks[idx]
        const dx = desk?.x ?? TILE * 2
        const dy = (desk?.y ?? TILE * 2) + 16
        const old = existing.find((c) => c.agent.id === agent.id)
        if (old) return { ...old, agent, tx: dx, ty: dy, palette: idx % 6 }
        // New character spawns at door and walks to desk
        return {
          agent,
          x: door.x,
          y: door.y,
          tx: dx,
          ty: dy,
          frame: 0,
          timer: 0,
          state: "walking" as const,
          palette: idx % 6,
          spawn: time,
          facing: dx > door.x ? 1 : -1,
          hop: 0,
        }
      })
    })
  }))

  // Detect status transitions (busy→idle = celebration)
  createEffect(() => {
    const list = agents()
    setChars((current) =>
      current.map((c, i) => {
        const agent = list[i]
        if (!agent) return c
        const was = prev.get(agent.id)
        const now = agent.status

        if (was === "busy" && now === "idle" && c.state !== "walking") {
          // Trigger celebration
          spawnParticles(particles, c.x, c.y)
          prev.set(agent.id, now)
          return { ...c, agent, state: "celebrating" as const, timer: 1.0, hop: 0 }
        }

        prev.set(agent.id, now)

        if (c.state === "celebrating") return { ...c, agent }
        if (c.state === "walking") return { ...c, agent }

        return {
          ...c,
          agent,
          state: agent.status === "busy" ? stateFromTool(agent.tool) : "idle",
        }
      }),
    )
  })

  // Game loop
  const start = Date.now()
  function loop() {
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) {
      frame = requestAnimationFrame(loop)
      return
    }
    const off = office()
    const s = scale()
    canvas.width = off.width * s
    canvas.height = off.height * s
    ctx.setTransform(s, 0, 0, s, 0, 0)
    const now = Date.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const time = (now - start) / 1000

    // Lerp character positions and update states
    setChars((current) =>
      current.map((c) => {
        const dx = c.tx - c.x
        const dy = c.ty - c.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = WALK_SPEED * TILE

        // Walking: lerp toward target
        if (c.state === "walking") {
          if (dist < 2) {
            return {
              ...c,
              x: c.tx,
              y: c.ty,
              state: c.agent.status === "busy" ? stateFromTool(c.agent.tool) : "idle",
            }
          }
          const step = Math.min(speed * dt, dist)
          return {
            ...c,
            x: c.x + (dx / dist) * step,
            y: c.y + (dy / dist) * step,
            facing: dx > 0 ? 1 : dx < 0 ? -1 : c.facing,
          }
        }

        // Celebrating: bounce hop then return to normal
        if (c.state === "celebrating") {
          const remaining = c.timer - dt
          if (remaining <= 0) {
            return {
              ...c,
              state: c.agent.status === "busy" ? stateFromTool(c.agent.tool) : "idle",
              timer: 0,
              hop: 0,
            }
          }
          return {
            ...c,
            timer: remaining,
            hop: Math.abs(Math.sin(remaining * 10)) * 6,
          }
        }

        // Settled: snap to desk if close
        if (dist > 2) {
          return { ...c, state: "walking" as const, facing: dx > 0 ? 1 : dx < 0 ? -1 : c.facing }
        }
        return c
      }),
    )

    // Update particles
    particles = particles
      .map((p) => ({
        ...p,
        x: p.x + p.vx * dt,
        y: p.y + p.vy * dt,
        vy: p.vy + 60 * dt,
        life: p.life - dt,
      }))
      .filter((p) => p.life > 0)

    render(ctx, off, chars(), particles, time, hover(), s)
    frame = requestAnimationFrame(loop)
  }

  onMount(() => {
    frame = requestAnimationFrame(loop)
  })

  onCleanup(() => {
    cancelAnimationFrame(frame)
  })

  // Mouse interaction
  function mouse(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const s = scale()
    const mx = (e.clientX - rect.left) / s
    const my = (e.clientY - rect.top) / s
    const list = chars()
    let found = -1
    for (let i = 0; i < list.length; i++) {
      const c = list[i]
      if (mx > c.x - 10 && mx < c.x + 10 && my > c.y - 16 && my < c.y + 16) {
        found = i
        break
      }
    }
    setHover(found)
  }

  function click() {
    const idx = hover()
    if (idx < 0) return
    const c = chars()[idx]
    if (c?.agent?.id) {
      navigate(`/${slug()}/session/${c.agent.id}`)
    }
  }

  return (
    <div class="flex flex-col size-full bg-[#1a1a2e] items-center justify-center gap-4">
      <div class="flex items-center gap-4">
        <button
          class="text-xs text-[#8888aa] hover:text-[#ccccdd] px-3 py-1.5 rounded bg-[#2a2a4a] hover:bg-[#3a3a5c] transition-colors"
          onClick={() => navigate(`/${slug()}/session`)}
        >
          ← Back to session
        </button>
        <h1 class="text-sm font-mono text-[#ccccdd]">
          🏢 Virtual Office
          <Show when={parent()}>
            <span class="text-[#666688]"> — {(parent() as any)?.title}</span>
          </Show>
        </h1>
        <div class="flex gap-1">
          {[2, 3, 4].map((s) => (
            <button
              class={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                scale() === s ? "bg-[#44cc88] text-[#1a1a2e]" : "bg-[#2a2a4a] text-[#8888aa] hover:text-[#ccccdd]"
              }`}
              onClick={() => setScale(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div
        class="rounded-lg border border-[#333355] overflow-hidden shadow-2xl"
        style={{ "max-width": "90vw", "max-height": "80vh", overflow: "auto" }}
      >
        <canvas
          ref={canvas}
          onMouseMove={mouse}
          onMouseLeave={() => setHover(-1)}
          onClick={click}
          style={{
            cursor: hover() >= 0 ? "pointer" : "default",
            "image-rendering": "pixelated",
          }}
        />
      </div>

      <Show when={chars().length === 0}>
        <div class="text-center text-[#666688] font-mono text-sm max-w-md">
          <p>No agents working yet.</p>
          <p class="mt-2 text-xs">Start a session and delegate tasks to sub-agents — they'll appear here as characters in the office.</p>
          <button
            class="mt-3 text-xs px-3 py-1.5 rounded bg-[#44cc88] text-[#1a1a2e] hover:bg-[#55dd99] transition-colors font-mono"
            onClick={() => {
              const names = ["Exploring codebase", "Running tests", "Writing docs", "Fixing bugs", "Code review", "Deploying"]
              const tools = ["grep", "bash", "edit", "view", "task", ""]
              const off = layout(Math.max(chars().length + 1, 2))
              setOffice(off)
              const door = doorPos(off)
              const idx = chars().length
              const desk = off.desks[idx]
              setChars((prev) => [
                ...prev,
                {
                  agent: {
                    id: `test-${idx}`,
                    name: names[idx % names.length],
                    agent: "explore",
                    status: "busy" as const,
                    tool: tools[idx % tools.length],
                    duration: 0,
                  },
                  x: door.x,
                  y: door.y,
                  tx: (desk?.x ?? TILE * 2),
                  ty: (desk?.y ?? TILE * 2) + 16,
                  frame: 0,
                  timer: 0,
                  state: "walking" as const,
                  palette: idx,
                  spawn: (Date.now() - start) / 1000,
                  facing: (desk?.x ?? TILE * 2) > door.x ? 1 : -1 as 1 | -1,
                  hop: 0,
                },
              ])
            }}
          >
            + Spawn Test Agent
          </button>
        </div>
      </Show>

      <div class="flex gap-3 flex-wrap justify-center max-w-2xl">
        {chars().map((c, i) => (
          <button
            class={`text-xs font-mono px-3 py-1.5 rounded transition-colors ${
              c.agent.status === "busy"
                ? "bg-[#1a3a2e] text-[#44cc88] border border-[#44cc88]/30"
                : "bg-[#2a2a4a] text-[#8888aa] border border-[#333355]"
            } hover:border-[#ffcc44]`}
            onClick={() => c.agent.id && navigate(`/${slug()}/session/${c.agent.id}`)}
          >
            <span class={c.agent.status === "busy" ? "animate-pulse" : ""}>●</span>
            {" "}@{c.agent.agent} — {c.agent.status === "busy" ? c.agent.tool || "working" : "idle"}
          </button>
        ))}
      </div>
    </div>
  )
}
