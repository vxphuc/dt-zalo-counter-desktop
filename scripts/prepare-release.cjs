'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const yaml = require('js-yaml')
const { UPDATE_ROOT } = require('../update-controller.cjs')

function metadataName(platform, arch) {
  return platform === 'win' ? 'latest.yml' : platform === 'mac' ? 'latest-mac.yml' : `latest-linux${arch === 'x64' ? '' : '-arm64'}.yml`
}
function validateMetadata(content, output, version, platform, arch) {
  const info = yaml.load(content)
  if (info?.version !== version || !Array.isArray(info.files) || !info.files.length) throw new Error('Metadata không đúng phiên bản hoặc thiếu file cập nhật.')
  const allowed = { win: ['.exe'], mac: ['.zip', '.dmg'], linux: ['.AppImage', '.deb'] }[platform]
  for (const file of info.files) {
    if (typeof file.url !== 'string' || path.basename(file.url) !== file.url || !file.url.startsWith('DT-Zalo-Counter-') || !file.url.includes(version) || !allowed.some(ext => file.url.endsWith(ext)) || (platform !== 'win' && !file.url.includes(`-${arch}.`))) throw new Error('Metadata phải trỏ tới bộ cài cùng OS/kiến trúc trong thư mục hiện tại.')
    const source = path.join(output, file.url)
    if (!fs.existsSync(source) || crypto.createHash('sha512').update(fs.readFileSync(source)).digest('base64') !== file.sha512 || (file.size != null && fs.statSync(source).size !== file.size)) throw new Error(`Hash/kích thước không khớp: ${file.url}`)
  }
  if (platform === 'mac' && !info.files.some(file => file.url.endsWith('.zip'))) throw new Error('Cập nhật Mac cần file ZIP.')
  if (platform === 'linux' && !['.AppImage', '.deb'].every(ext => info.files.some(file => file.url.endsWith(ext)))) throw new Error('Kênh Linux cần cả AppImage và .deb.')
  return info
}
function prepareRelease(platform, arch, { root = path.resolve(__dirname, '..'), pkg = require('../package.json') } = {}) {
  if (!['win', 'mac', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch) || (platform === 'win' && arch !== 'x64')) throw new Error('OS/kiến trúc không hợp lệ.')
  const output = path.resolve(root, pkg.build.directories.output)
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'update-policy.json'), 'utf8'))
  const autoUpdate = platform !== 'mac' || policy.macSigned === true
  const channel = `${platform}-${arch}`
  const destination = path.join(output, 'update-bundle', channel)
  fs.mkdirSync(destination, { recursive: true })
  const manifestFile = metadataName(platform, arch)
  if (autoUpdate) validateMetadata(fs.readFileSync(path.join(output, manifestFile), 'utf8'), output, pkg.version, platform, arch)
  const extensions = { win: ['.exe', '.exe.blockmap'], mac: ['.dmg', '.zip', '.zip.blockmap', '.dmg.blockmap'], linux: ['.AppImage', '.deb', '.AppImage.blockmap'] }[platform]
  const names = fs.readdirSync(output).filter(name => name.startsWith('DT-Zalo-Counter-') && name.includes(`-${pkg.version}`) && (platform === 'win' || name.includes(`-${arch}.`)) && extensions.some(ext => name.endsWith(ext)))
  if (!names.length) throw new Error('Không có bộ cài đúng phiên bản/kiến trúc.')
  if (autoUpdate) names.push(manifestFile)
  const files = names.map(name => {
    const source = path.join(output, name), buffer = fs.readFileSync(source)
    fs.copyFileSync(source, path.join(destination, name))
    return { name, size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') }
  })
  const release = { schema: 1, version: pkg.version, platform, arch, channel, url: `${UPDATE_ROOT}/${channel}/`, autoUpdate, metadata: autoUpdate ? manifestFile : null, files }
  fs.writeFileSync(path.join(destination, 'release.json'), JSON.stringify(release, null, 2) + '\n')
  console.log(`Đã chuẩn bị ${channel} ${pkg.version}: ${autoUpdate ? 'có kênh cập nhật' : 'bộ cài Mac chưa ký, chưa bật kênh cập nhật'}`)
  return destination
}
if (require.main === module) {
  try { prepareRelease(process.argv[2], process.argv[3] || process.arch) } catch (error) { console.error(error.message); process.exitCode = 1 }
}
module.exports = { metadataName, validateMetadata, prepareRelease }
