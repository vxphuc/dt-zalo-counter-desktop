'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const yaml = require('js-yaml')
const { TRACKS, stableVersion, validateLatest } = require('../update-contract.cjs')
function digest(file, algorithm, encoding = 'hex') { return createHash(algorithm).update(fs.readFileSync(file)).digest(encoding) }
function prepareRelease({ directory, track, version, automatic }) {
  if (!TRACKS[track] || !stableVersion(version) || typeof automatic !== 'boolean') throw new Error('Thông tin build không hợp lệ.')
  const files = fs.readdirSync(directory).filter(name => name.startsWith('DT-Zalo-Counter-') && name.includes(`-${version}`) && /\.(exe|dmg|zip|blockmap)$/.test(name))
  for (const name of files) if (!fs.lstatSync(path.join(directory, name)).isFile()) throw new Error('Artifact phải là file thông thường.')
  const installers = files.filter(name => name.endsWith(track === 'win-x64' ? '.exe' : '.dmg'))
  if (installers.length !== 1) throw new Error('Cần đúng một bộ cài cho kiến trúc hiện tại.')
  const output = path.join(directory, 'publish')
  // A released version is immutable; rebuild under a newer version instead of overwriting it.
  fs.mkdirSync(output)
  for (const name of files) fs.copyFileSync(path.join(directory, name), path.join(output, name), fs.constants.COPYFILE_EXCL)
  if (automatic) {
    const metadataName = track === 'win-x64' ? 'latest.yml' : 'latest-mac.yml'
    const metadata = yaml.load(fs.readFileSync(path.join(directory, metadataName), 'utf8'))
    if (metadata.version !== version || !Array.isArray(metadata.files) || !metadata.files.length || metadata.packages) throw new Error('Metadata build không hợp lệ.')
    for (const file of metadata.files) {
      if (!files.includes(file.url) || digest(path.join(output, file.url), 'sha512', 'base64') !== file.sha512) throw new Error('Checksum metadata không khớp bộ cài.')
      file.url = `releases/${version}/${file.url}`
    }
    if (track.startsWith('mac-') && !files.some(name => name.endsWith('.zip'))) throw new Error('Tự cập nhật macOS cần file ZIP đã ký.')
    if (metadata.path) metadata.path = `releases/${version}/${path.basename(metadata.path)}`
    fs.writeFileSync(path.join(output, metadataName), yaml.dump(metadata))
  }
  const installer = installers[0]
  const latest = { track, version, automatic, url: `/downloads/desktop/${track}/releases/${version}/${installer}`,
    size: fs.statSync(path.join(output, installer)).size, sha256: digest(path.join(output, installer), 'sha256') }
  validateLatest(latest, track)
  fs.writeFileSync(path.join(output, 'latest.json'), JSON.stringify(latest, null, 2) + '\n')
  const checksums = fs.readdirSync(output).sort().map(name => `${digest(path.join(output, name), 'sha256')}  ${name}`)
  fs.writeFileSync(path.join(output, 'SHA256.txt'), checksums.join('\n') + '\n')
  console.log(`Bộ phát hành VPS: ${output}`)
  return output
}
module.exports = { prepareRelease, digest }
