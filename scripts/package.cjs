'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { build, Platform, Arch } = require('electron-builder')
const { UPDATE_ROOT } = require('../update-controller.cjs')

async function packageApp(platform, arch, env = process.env) {
  if (!['win', 'mac', 'linux'].includes(platform) || !['x64', 'arm64'].includes(arch) || (platform === 'win' && arch !== 'x64')) throw new Error('OS/kiến trúc build không được hỗ trợ.')
  const root = path.resolve(__dirname, '..')
  const pkg = require('../package.json')
  const config = structuredClone(pkg.build)
  config.publish = { provider: 'generic', url: `${UPDATE_ROOT}/${platform}-${arch}/`, useMultipleRangeRequest: false }
  // Linux's ${arch} macro expands to amd64 for DEB and x86_64 for AppImage.
  // Use one explicit channel architecture for both installer filenames.
  if (platform === 'linux') config.linux.artifactName = 'DT-Zalo-Counter-${version}-Linux-' + arch + '.${ext}'
  // GitHub passes missing Secrets as empty strings. electron-builder treats an
  // empty CSC_LINK as a local path, so do not leave these in its environment.
  const signingKeys = ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
  for (const key of signingKeys) if (!env[key]) delete env[key]
  let macSigned = false
  if (platform === 'mac') {
    const requested = env.DT_MAC_SIGNED === 'true'
    if (requested && signingKeys.some(key => !env[key])) throw new Error('Thiếu GitHub Secrets ký/notarize Mac. Xem AUTO_UPDATE.md; không dùng bản chưa ký làm kênh cập nhật.')
    macSigned = requested
    if (macSigned) delete config.mac.identity
    else { config.mac.identity = '-'; for (const key of signingKeys) delete env[key] }
    config.mac.hardenedRuntime = macSigned
    config.mac.notarize = macSigned
    if (macSigned) config.forceCodeSigning = true
    config.mac.entitlements = 'assets/entitlements.mac.plist'
    config.mac.entitlementsInherit = 'assets/entitlements.mac.plist'
    if (!macSigned) config.publish.publishAutoUpdate = false
  }
  // This file is generated independently on each runner and included in app.asar.
  fs.writeFileSync(path.join(root, 'update-policy.json'), JSON.stringify({ macSigned }) + '\n')
  const targetNames = { win: ['nsis'], mac: ['dmg', 'zip'], linux: ['AppImage', 'deb'] }
  const host = { win: Platform.WINDOWS, mac: Platform.MAC, linux: Platform.LINUX }[platform]
  await build({ projectDir: root, config, targets: host.createTarget(targetNames[platform], Arch[arch]), publish: 'never' })
}
if (require.main === module) packageApp(process.argv[2], process.argv.find(value => /^--(?:x64|arm64)$/.test(value))?.slice(2) || process.arch).catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { packageApp }
