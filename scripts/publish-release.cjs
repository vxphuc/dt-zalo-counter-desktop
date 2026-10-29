'use strict'
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')
const semver = require('semver')
const { validateLatest } = require('../update-contract.cjs')
const { digest } = require('./prepare-release.cjs')
function publishRelease(bundle, root) {
  if (process.platform === 'win32') throw new Error('Chạy publish trên VPS Linux hoặc môi trường POSIX thử nghiệm.')
  bundle = fs.realpathSync(bundle)
  root = path.resolve(root)
  fs.mkdirSync(root, { recursive: true, mode: 0o755 })
  if (fs.realpathSync(root) !== root) throw new Error('Thư mục phát hành không được là symlink.')
  const data = JSON.parse(fs.readFileSync(path.join(bundle, 'latest.json'), 'utf8'))
  validateLatest(data, data.track)
  const names = fs.readdirSync(bundle)
  if (names.some(name => !fs.lstatSync(path.join(bundle, name)).isFile() || !/^(DT-Zalo-Counter-[A-Za-z0-9.-]+\.(exe|dmg|zip)(\.blockmap)?|latest(?:-mac)?\.yml|latest\.json|SHA256\.txt)$/.test(name))) throw new Error('Gói phát hành chứa file không hợp lệ.')
  const lines = fs.readFileSync(path.join(bundle, 'SHA256.txt'), 'utf8').trim().split('\n')
  const checked = new Set()
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  ([A-Za-z0-9.-]+)$/.exec(line)
    if (!match || match[2] === 'SHA256.txt' || !names.includes(match[2]) || checked.has(match[2]) || digest(path.join(bundle, match[2]), 'sha256') !== match[1]) throw new Error('Checksum phát hành không hợp lệ.')
    checked.add(match[2])
  }
  if (names.some(name => name !== 'SHA256.txt' && !checked.has(name))) throw new Error('Thiếu checksum.')
  const installer = path.basename(data.url)
  if (!names.includes(installer) || fs.statSync(path.join(bundle, installer)).size !== data.size || digest(path.join(bundle, installer), 'sha256') !== data.sha256) throw new Error('Bộ cài không khớp latest.json.')
  const metadataName = data.track === 'win-x64' ? 'latest.yml' : 'latest-mac.yml'
  if (data.automatic) {
    const metadata = yaml.load(fs.readFileSync(path.join(bundle, metadataName), 'utf8'))
    if (metadata.version !== data.version || !Array.isArray(metadata.files) || !metadata.files.length || metadata.packages) throw new Error('Metadata tự cập nhật không hợp lệ.')
    for (const file of metadata.files) {
      const filename = path.basename(file.url)
      if (file.url !== `releases/${data.version}/${filename}` || !names.includes(filename) || digest(path.join(bundle, filename), 'sha512', 'base64') !== file.sha512) throw new Error('Metadata tham chiếu sai bộ cài.')
    }
    if (!metadata.files.some(file => file.url.endsWith(data.track === 'win-x64' ? '.exe' : '.zip'))) throw new Error('Thiếu artifact tự cập nhật.')
  } else if (names.some(name => name.endsWith('.yml'))) throw new Error('Bản cài thủ công không được công bố feed tự cập nhật.')
  const trackRoot = path.join(root, data.track)
  const releases = path.join(trackRoot, 'releases')
  fs.mkdirSync(releases, { recursive: true, mode: 0o755 })
  if (fs.realpathSync(releases) !== releases) throw new Error('Đường dẫn releases không được là symlink.')
  const lock = path.join(trackRoot, '.publish-lock')
  fs.mkdirSync(lock)
  try {
    const current = path.join(trackRoot, 'current')
    if (fs.existsSync(current)) {
      const previous = JSON.parse(fs.readFileSync(path.join(current, 'latest.json'), 'utf8'))
      if (!semver.gt(data.version, previous.version)) throw new Error('Phiên bản mới phải lớn hơn bản đang phát hành.')
    }
    const destination = path.join(releases, data.version)
    if (fs.existsSync(destination)) throw new Error('Phiên bản này đã có. Tăng version để giữ file bất biến.')
    fs.mkdirSync(destination, { mode: 0o755 })
    for (const name of names) { fs.copyFileSync(path.join(bundle, name), path.join(destination, name), fs.constants.COPYFILE_EXCL); fs.chmodSync(path.join(destination, name), 0o644) }
    // Fixed metadata aliases follow ONE atomic pointer, after every artifact is in place.
    for (const name of ['latest.json', metadataName]) {
      const alias = path.join(trackRoot, name)
      try { fs.symlinkSync(`current/${name}`, alias) } catch (error) {
        if (error.code !== 'EEXIST' || !fs.lstatSync(alias).isSymbolicLink() || fs.readlinkSync(alias) !== `current/${name}`) throw error
      }
    }
    const next = path.join(trackRoot, `.current-${process.pid}`)
    fs.symlinkSync(`releases/${data.version}`, next)
    fs.renameSync(next, current)
    console.log(`DESKTOP_RELEASE_ACTIVE: ${data.track} ${data.version}`)
  } finally { fs.rmdirSync(lock) }
}
if (require.main === module) {
  const [bundle, root = '/var/www/dt-zalo-downloads'] = process.argv.slice(2)
  if (!bundle) throw new Error('Dùng: node scripts/publish-release.cjs <thu-muc-publish> [thu-muc-host]')
  publishRelease(bundle, root)
}
module.exports = { publishRelease }
