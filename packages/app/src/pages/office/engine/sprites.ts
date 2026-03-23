export const TILE = 32
export const CHAR_W = 16
export const CHAR_H = 24
export const WALK_SPEED = 2 // tiles per second
export const DOOR_X = 0
export const DOOR_Y = 0

export type CharacterState = "idle" | "typing" | "reading" | "walking" | "celebrating"

export interface Sprite {
  frames: ImageData[]
  width: number
  height: number
}

export function stateFromTool(tool: string): CharacterState {
  if (!tool) return "idle"
  const writing = ["write", "edit", "bash", "apply_patch", "todo_write"]
  const reading = ["read", "grep", "glob", "ls", "web_fetch", "web_search", "code_search"]
  if (writing.some((t) => tool.includes(t))) return "typing"
  if (reading.some((t) => tool.includes(t))) return "reading"
  return "typing" // default for unknown tools = working
}
