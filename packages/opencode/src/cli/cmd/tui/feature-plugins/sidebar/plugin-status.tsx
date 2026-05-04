import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal, For, Show, onCleanup } from "solid-js"

const id = "internal:sidebar-plugin-status"

type StatusEntry = {
  plugin: string
  status: "running" | "completed" | "error"
  message?: string
  time: number
}

const COMPLETED_TTL = 5000

function View(props: { api: TuiPluginApi }) {
  const [open, setOpen] = createSignal(true)
  const theme = () => props.api.theme.current
  const [entries, setEntries] = createSignal<StatusEntry[]>([])

  // Auto-prune completed entries after TTL
  const timer = setInterval(() => {
    const now = Date.now()
    setEntries((prev) => prev.filter((e) => e.status !== "completed" || now - e.time < COMPLETED_TTL))
  }, 1000)
  onCleanup(() => clearInterval(timer))

  props.api.event.on("plugin.status" as any, (event: any) => {
    const info = event.properties ?? event
    setEntries((prev) => {
      const next = prev.filter((e) => e.plugin !== info.plugin)
      next.push({
        plugin: info.plugin,
        status: info.status,
        message: info.message,
        time: Date.now(),
      })
      return next
    })
  })

  const dot = (status: string) => {
    if (status === "running") return theme().warning
    if (status === "completed") return theme().success
    if (status === "error") return theme().error
    return theme().textMuted
  }

  const statusLabel = (status: string) => {
    if (status === "running") return "⟳"
    if (status === "completed") return "✓"
    if (status === "error") return "✗"
    return "?"
  }

  const active = () => entries().filter((e) => e.status === "running").length
  const errors = () => entries().filter((e) => e.status === "error").length

  return (
    <Show when={entries().length > 0}>
      <box>
        <box flexDirection="row" gap={1} onMouseDown={() => entries().length > 2 && setOpen((x) => !x)}>
          <Show when={entries().length > 2}>
            <text fg={theme().text}>{open() ? "▼" : "▶"}</text>
          </Show>
          <text fg={theme().text}>
            <b>Plugins</b>
            <Show when={!open()}>
              <span style={{ fg: theme().textMuted }}>
                {" "}
                ({entries().length} loaded{active() > 0 ? `, ${active()} running` : ""}
                {errors() > 0 ? `, ${errors()} error${errors() > 1 ? "s" : ""}` : ""})
              </span>
            </Show>
          </text>
        </box>
        <Show when={entries().length <= 2 || open()}>
          <For each={entries()}>
            {(entry) => (
              <box flexDirection="row" gap={1}>
                <text flexShrink={0} style={{ fg: dot(entry.status) }}>
                  {statusLabel(entry.status)}
                </text>
                <text fg={theme().text} wrapMode="word">
                  {entry.plugin}{" "}
                  <Show when={entry.message}>
                    <span style={{ fg: theme().textMuted }}>{entry.message}</span>
                  </Show>
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 250,
    slots: {
      sidebar_content() {
        return <View api={api} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
