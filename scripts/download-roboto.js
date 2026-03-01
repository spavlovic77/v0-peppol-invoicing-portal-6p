import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Google Fonts CSS API returns .ttf URLs when we use an older user-agent
const UA = 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)'

async function getTtfUrl(family, weight) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`
  const res = await fetch(cssUrl, { headers: { 'User-Agent': UA } })
  const css = await res.text()
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/)
  if (!match) throw new Error(`No .ttf URL found for ${family} weight ${weight}. CSS:\n${css}`)
  return match[1]
}

async function downloadFont(url, outputPath) {
  const res = await fetch(url)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(outputPath, buf)
  console.log(`Saved ${outputPath} (${buf.length} bytes)`)
}

const outDir = join(process.cwd(), 'public', 'fonts')
mkdirSync(outDir, { recursive: true })

const regularUrl = await getTtfUrl('Roboto', 400)
console.log('Regular URL:', regularUrl)
await downloadFont(regularUrl, join(outDir, 'Roboto-Regular.ttf'))

const boldUrl = await getTtfUrl('Roboto', 700)
console.log('Bold URL:', boldUrl)
await downloadFont(boldUrl, join(outDir, 'Roboto-Bold.ttf'))

console.log('Done! Both fonts downloaded.')
