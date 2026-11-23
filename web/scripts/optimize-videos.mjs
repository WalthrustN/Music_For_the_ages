import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ffmpeg = require('ffmpeg-static')
const here = dirname(fileURLToPath(import.meta.url))
const map = JSON.parse(await readFile(resolve(here, '../src/video-map.json'), 'utf8'))
const sourceDir = resolve(here, '../../Short_Vids')
const outDir = resolve(here, '../public/videos')

function svg(label, from, to) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  <text x="64" y="620" fill="#f4efe6" font-family="Georgia, serif" font-size="72">${label}</text>
  <text x="64" y="690" fill="#e4c39a" font-family="Georgia, serif" font-size="28">Music for the Ages</text>
</svg>`
}

function transcode(input, output) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(ffmpeg, [
      '-y',
      '-i', input,
      '-t', '12',
      '-an',
      '-vf', 'scale=720:-2',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'veryfast',
      '-crf', '30',
      '-movflags', '+faststart',
      output,
    ], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`ffmpeg exited ${code} for ${output}`))
    })
  })
}

await mkdir(outDir, { recursive: true })
const jobs = []
for (const [key, clip] of Object.entries(map)) {
  await writeFile(resolve(outDir, `${key}.svg`), svg(clip.label, clip.from, clip.to), 'utf8')
  jobs.push({ key, input: resolve(sourceDir, clip.file), output: resolve(outDir, `${key}.mp4`) })
}

if (!ffmpeg) {
  console.error('ffmpeg-static did not provide a binary. Posters were written; videos were not.')
  process.exit(1)
}

const queue = [...jobs]
const workers = Array.from({ length: 2 }, async () => {
  while (queue.length > 0) {
    const job = queue.shift()
    if (!job) return
    console.log(`Encoding ${job.key}`)
    await transcode(job.input, job.output)
  }
})
await Promise.all(workers)
console.log(`Wrote ${jobs.length} clips to ${outDir}`)
