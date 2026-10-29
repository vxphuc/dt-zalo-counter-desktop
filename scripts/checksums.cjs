'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const config = require('../package.json')
const root = path.resolve(__dirname, '..', config.build.directories.output)
let found = false
for (const track of ['win-x64', 'mac-x64', 'mac-arm64']) {
  const output = path.join(root, track, config.version, 'publish')
  if (!fs.existsSync(output)) continue
  found = true
  const lines = fs.readdirSync(output).filter(name => name !== 'SHA256.txt').sort().map(name => `${createHash('sha256').update(fs.readFileSync(path.join(output, name))).digest('hex')}  ${name}`)
  // Verify, never rewrite the integrity record of an existing release.
  if (fs.readFileSync(path.join(output, 'SHA256.txt'), 'utf8') !== lines.join('\n') + '\n') throw new Error(`Checksum không khớp: ${track}`)
  console.log(`${track}: checksum hợp lệ (${lines.length} file).`)
}
if (!found) throw new Error('Chưa có gói publish cho phiên bản hiện tại. Chạy npm run build trước.')
