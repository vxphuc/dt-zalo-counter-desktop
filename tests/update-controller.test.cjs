const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createUpdateController, updateTarget, UPDATE_ROOT } = require('../update-controller.cjs')

function fixture(options = {}) {
  const app = new EventEmitter(), updater = new EventEmitter(), notices = [], opened = [], schedules = [], factoryCalls = []
  let checks = 0, installs = 0, beforeInstall = 0, answer = 1
  Object.assign(app, { isPackaged: true, getVersion: () => '1.0.4' })
  updater.checkForUpdates = async () => { checks++; updater.emit('update-not-available'); return null }
  updater.quitAndInstall = () => { installs++ }
  const controller = createUpdateController({ app, platform: 'win32', arch: 'x64', policy: { macSigned: false }, env: {},
    dialog: { showMessageBox: async options => { notices.push(options); return { response: answer } } },
    shell: { openPath: async file => { opened.push(file); return '' } },
    timers: { setTimeout: (fn, delay) => { schedules.push({ fn, delay }); return { unref() {} } }, setInterval: (fn, delay) => { schedules.push({ fn, delay }); return { unref() {} } }, clearTimeout() {}, clearInterval() {} },
    factory: (target, config) => { factoryCalls.push({ target, config }); return updater }, beforeInstall: () => { beforeInstall++ }, ...options,
  })
  return { controller, updater, notices, opened, schedules, factoryCalls, answer: value => { answer = value }, count: () => ({ checks, installs, beforeInstall }) }
}

test('updater chooses separate feeds for all five architectures and blocks unsigned Mac/dev', () => {
  assert.equal(updateTarget({ packaged: true, platform: 'win32', arch: 'x64' }).channel, 'win-x64')
  for (const arch of ['x64', 'arm64']) {
    assert.equal(updateTarget({ packaged: true, platform: 'darwin', arch, macSigned: true }).channel, `mac-${arch}`)
    assert.equal(updateTarget({ packaged: true, platform: 'linux', arch, appImage: '/fixture.AppImage' }).channel, `linux-${arch}`)
    assert.ok(updateTarget({ packaged: true, platform: 'darwin', arch }).reason)
  }
  assert.ok(updateTarget({ packaged: false, platform: 'win32', arch: 'x64' }).reason)
  assert.ok(updateTarget({ packaged: true, platform: 'win32', arch: 'arm64' }).reason)
  const mac = fixture({ platform: 'darwin' })
  assert.equal(mac.factoryCalls.length, 0)
  const win = fixture()
  assert.equal(win.factoryCalls[0].config.url, `${UPDATE_ROOT}/win-x64/`)
  assert.equal(win.updater.autoInstallOnAppQuit, false)
  assert.equal(win.updater.allowDowngrade, false)
})

test('startup checks after 15s, then every 6h; manual check reports current version', async () => {
  const f = fixture()
  f.controller.start(); f.controller.start()
  assert.deepEqual(f.schedules.map(timer => timer.delay), [15000, 21600000])
  await f.controller.check(true)
  assert.equal(f.count().checks, 1)
  assert.equal(f.notices[0].title, 'Ứng dụng đã cập nhật')
  assert.equal(f.controller.getState().status, 'idle')
})

test('download prompts to restart; choosing later preserves app and menu can install', async () => {
  const f = fixture()
  f.updater.emit('update-available', { version: '1.0.5' })
  f.updater.emit('download-progress', { percent: 43.9 })
  assert.match(f.controller.menuItems()[1].label, /43%/)
  await f.controller.check(true)
  assert.equal(f.count().checks, 0)
  f.updater.emit('update-downloaded', { version: '1.0.5', downloadedFile: 'fixture.exe' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.count().installs, 0)
  assert.equal(f.controller.getState().status, 'ready')
  f.answer(0)
  await f.controller.check(true)
  assert.deepEqual(f.count(), { checks: 0, installs: 1, beforeInstall: 1 })
})

test('automatic errors stay quiet; manual errors report once and permit retry', async () => {
  const f = fixture()
  f.updater.checkForUpdates = async () => { f.updater.emit('error', new Error('offline')); throw new Error('offline') }
  await f.controller.check()
  assert.equal(f.notices.length, 0)
  await f.controller.check(true)
  assert.equal(f.notices.length, 1)
  assert.equal(f.controller.getState().status, 'error')
})

test('installed DEB opens Linux package UI, never starts an elevated Electron/apt command', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-updater-'))
  try {
    fs.writeFileSync(path.join(directory, 'package-type'), 'deb')
    const f = fixture({ platform: 'linux', resourcesPath: directory })
    assert.equal(f.factoryCalls[0].target.kind, 'deb')
    f.updater.emit('update-downloaded', { version: '1.0.5', downloadedFile: '/fixture/update.deb' })
    await new Promise(resolve => setImmediate(resolve))
    f.controller.install()
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(f.opened, ['/fixture/update.deb'])
    assert.equal(f.count().installs, 0)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})

test('install failure restores normal window close behavior and AppImage rename repairs startup', async () => {
  let recovered = 0, newPath
  const f = fixture({ onInstallFailure: () => { recovered++ } })
  f.updater.emit('update-downloaded', { version: '1.0.5', downloadedFile: 'fixture.exe' })
  await new Promise(resolve => setImmediate(resolve))
  f.updater.quitAndInstall = () => { f.updater.emit('error', new Error('cannot install')) }
  f.controller.install()
  assert.equal(recovered, 1)
  assert.equal(f.controller.getState().status, 'error')
  assert.equal(f.notices.at(-1).type, 'warning')
  const linux = fixture({ platform: 'linux', env: { APPIMAGE: '/app/1.0.4.AppImage' }, onAppImagePathChanged: value => { newPath = value } })
  linux.updater.emit('appimage-filename-updated', '/app/1.0.5.AppImage')
  assert.equal(newPath, '/app/1.0.5.AppImage')
})
