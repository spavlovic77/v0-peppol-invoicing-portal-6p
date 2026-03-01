import { writeFileSync, mkdirSync } from 'fs'

const fonts = {
  'Roboto-Regular.ttf': 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf',
  'Roboto-Bold.ttf': 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc9.ttf',
}

const dir = './public/fonts'
mkdirSync(dir, { recursive: true })

for (const [name, url] of Object.entries(fonts)) {
  console.log(`Downloading ${name}...`)
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`Failed to download ${name}: ${res.status}`)
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(`${dir}/${name}`, buf)
  console.log(`Saved ${name} (${buf.length} bytes)`)
}

console.log('Done!')
