export const TILE = 32
export const CHAR_W = 16
export const CHAR_H = 32
export const WALK_SPEED = 2 // tiles per second
export const CHAR_FRAMES = 7
export const CHAR_DIRS = { down: 0, up: 1, right: 2 } as const
export const CHAR_COUNT = 6

export type CharacterState = "idle" | "typing" | "reading" | "walking" | "celebrating"

const cache = new Map<string, HTMLImageElement>()

export function img(src: string): HTMLImageElement {
  const cached = cache.get(src)
  if (cached) return cached
  const el = new Image()
  el.src = src
  cache.set(src, el)
  return el
}

export function stateFromTool(tool: string): CharacterState {
  if (!tool) return "idle"
  const writing = ["write", "edit", "bash", "apply_patch", "todo_write"]
  const reading = ["read", "grep", "glob", "ls", "web_fetch", "web_search", "code_search"]
  if (writing.some((t) => tool.includes(t))) return "typing"
  if (reading.some((t) => tool.includes(t))) return "reading"
  return "typing"
}
