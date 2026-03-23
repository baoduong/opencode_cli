import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  // When --cwd is used (e.g. bun run --cwd ...), process.cwd() points to the
  // package source dir instead of the user's shell directory.  Prefer the
  // original PWD env var so the project is resolved from where the user
  // actually launched the command.
  const resolved =
    process.env.PWD && Filesystem.resolve(process.env.PWD) !== Filesystem.resolve(directory)
      ? Filesystem.resolve(process.env.PWD)
      : directory
  return Instance.provide({
    directory: resolved,
    init: InstanceBootstrap,
    fn: async () => {
      try {
        const result = await cb()
        return result
      } finally {
        await Instance.dispose()
      }
    },
  })
}
