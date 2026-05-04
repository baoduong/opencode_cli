import z from "zod"
import { BusEvent } from "@/bus/bus-event"

export namespace PluginStatus {
  export const Info = z.object({
    plugin: z.string(),
    status: z.enum(["running", "completed", "error"]),
    message: z.string().optional(),
  })
  export type Info = z.infer<typeof Info>

  export const Updated = BusEvent.define("plugin.status", Info)
}
