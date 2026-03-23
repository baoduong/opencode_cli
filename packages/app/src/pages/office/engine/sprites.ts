export const TILE = 32
export const CHAR_W = 16
export const CHAR_H = 32
export const WALK_SPEED = 2 // tiles per second
export const DOOR_X = 0
export const DOOR_Y = 0

export type CharacterState = "idle" | "typing" | "reading" | "walking" | "celebrating"

export type HairStyle = "short" | "long" | "ponytail" | "bun" | "mohawk" | "curly"

export const HAIR_STYLES: HairStyle[] = ["short", "long", "ponytail", "bun", "mohawk", "curly"]

export const PALETTES = {
  skin: ["#f5d0a9", "#e8b88a", "#d4956b", "#c07850", "#8b5e3c", "#5c3d2e"],
  hair: ["#2a1a0a", "#5a3a1a", "#8b6b3a", "#cc9944", "#dd5533", "#222244"],
  shirt: ["#4488cc", "#cc4444", "#44aa44", "#aa44aa", "#ccaa22", "#44aaaa"],
  glasses: [true, false, true, false, true, false],
} as const

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
  return "typing"
}
