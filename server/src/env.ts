import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function loadEnv(): void {
  const start = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(start, '../../.env'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../.env'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      config({ path })
      return
    }
  }
}
