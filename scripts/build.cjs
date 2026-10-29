'use strict'
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const { trackFor } = require('../update-contract.cjs')
const { prepareRelease } = require('./prepare-release.cjs')
const [target, ...args] = process.argv.slice(2)
const platform = target === 'win' ? 'win32' : target === 'mac' ? 'darwin' : ''
if (args.some(arg => !['--x64', '--arm64'].includes(arg)) || args.length > 1) throw new Error('Chỉ truyền --x64 hoặc --arm64.')
const arch = args[0]?.slice(2) || (platform === 'win32' ? 'x64' : process.arch)
const track = trackFor(platform, arch)
if (platform === 'darwin' && process.platform !== 'darwin') throw new Error('Build macOS trên máy Mac hoặc GitHub Actions macOS.')
if (platform === 'darwin' && process.env.DTCRM_MAC_SIGNED === '1') {
  for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']) {
    if (!process.env[key]) throw new Error(`Thiếu biến ký macOS: ${key}`)
  }
}
const source = path.resolve(__dirname, '..')
const env = { ...process.env, DTCRM_BUILD_PLATFORM: platform, DTCRM_BUILD_ARCH: arch }
const result = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--config', 'electron-builder.config.cjs', `--${target}`, `--${arch}`, '--publish', 'never'], { cwd: source, env, stdio: 'inherit', windowsHide: true })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)
const config = require('../package.json')
const directory = path.resolve(source, config.build.directories.output, track, config.version)
prepareRelease({ directory, track, version: config.version, automatic: platform === 'win32' || env.DTCRM_MAC_SIGNED === '1' })
