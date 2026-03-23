import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from "solid-js"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useNavigate, useParams } from "@solidjs/router"
import { base64Encode } from "@opencode-ai/util/encode"
import { TILE } from "./engine/sprites"
import { stateFromTool } from "./engine/sprites"
import { layout, render, type Agent, type Character, type Office } from "./engine/renderer"

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

  // Find active parent session (most recent non-child session with busy children)
  const sessions = createMemo(() => {
    const all = Object.values(sync.data.session).flat()
    return all.filter((s: any) => !s.parentID).sort((a: any, b: any) => b.time.updated - a.time.updated)
  })

  const parent = createMemo(() => sessions()[0])

  // Child sessions = agents in the office
  const agents = createMemo<Agent[]>(() => {
    const p = parent()
    if (!p) return []
    const all = Object.values(sync.data.session).flat()
    return all
      .filter((s: any) => s.parentID === p.id)
      .map((s: any) => {
        const status = sync.data.session_status?.[s.id]
        const msgs = sync.data.message?.[s.id] ?? []
        const parts = msgs.flatMap((m: any) => sync.data.part?.[m.id] ?? [])
        const tool = parts.findLast((p: any) => p.type === "tool" && (p as any).state?.status === "running") as any
        return {
          id: s.id,
          name: s.title?.replace(/\s*\(@\S+ subagent\)\s*$/, "") ?? "Task",
          agent: s.title?.match(/@(\S+) subagent/)?.[1] ?? "agent",
          status: (status?.type ?? "idle") as Agent["status"],
          tool: tool ? `${tool.tool}${tool.state?.title ? ` ${tool.state.title}` : ""}` : "",
          duration: (s.time?.updated ?? 0) - (s.time?.created ?? 0),
        }
      })
  })

  // Build office layout and characters
  const [chars, setChars] = createSignal<Character[]>([])
  const [office, setOffice] = createSignal<Office>(layout(1))

  createEffect(on(agents, (list) => {
    const count = Math.max(list.length, 1)
    const off = layout(count)
    setOffice(off)
    setChars(list.map((agent, i) => {
      const desk = off.desks[i]
      return {
        agent,
        x: desk?.x ?? TILE * 2,
        y: (desk?.y ?? TILE * 2) + 16,
        tx: desk?.x ?? TILE * 2,
        ty: desk?.y ?? TILE * 2,
        frame: 0,
        timer: 0,
        state: agent.status === "busy" ? stateFromTool(agent.tool) : "idle",
        palette: i,
      }
    }))
  }))

  // Update character states reactively
  createEffect(() => {
    const list = agents()
    setChars((prev) =>
      prev.map((c, i) => {
        const agent = list[i]
        if (!agent) return c
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
    const time = (Date.now() - start) / 1000
    render(ctx, off, chars(), time, hover(), s)
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

      <Show when={agents().length === 0}>
        <div class="text-center text-[#666688] font-mono text-sm max-w-md">
          <p>No agents working yet.</p>
          <p class="mt-2 text-xs">Start a session and delegate tasks to sub-agents — they'll appear here as characters in the office.</p>
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
