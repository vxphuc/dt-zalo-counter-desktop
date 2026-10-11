'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { configureDesktopHost, floatWindow, desktopEntry, loginController } = require('../platform-support.cjs')

test('Linux selects X11 when available; other platforms keep their native backend', () => {
  const calls = []
  const app = { commandLine: { appendSwitch: (...args) => calls.push(args) } }
  configureDesktopHost(app, 'linux', { DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' })
  assert.deepEqual(calls, [['ozone-platform', 'x11']])
  calls.length = 0
  for (const platform of ['win32', 'darwin']) configureDesktopHost(app, platform, { DISPLAY: ':0' })
  configureDesktopHost(app, 'linux', { WAYLAND_DISPLAY: 'wayland-0' })
  assert.deepEqual(calls, [])
})

test('floating windows use only APIs supported on their platform', () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    const calls = []
    const window = { setAlwaysOnTop: (...args) => calls.push(['top', ...args]) }
    if (platform !== 'win32') window.setVisibleOnAllWorkspaces = (...args) => calls.push(['spaces', ...args])
    floatWindow(window, platform)
    assert.equal(calls[0][1], true)
    if (platform === 'win32') assert.equal(calls.length, 1)
    if (platform === 'darwin') assert.deepEqual(calls[1], ['spaces', true, { visibleOnFullScreen: true }])
    if (platform === 'linux') assert.deepEqual(calls, [['top', true, 'normal'], ['spaces', true]])
  }
})

test('native login toggle is disabled in development and persists on Windows/macOS', () => {
  for (const platform of ['win32', 'darwin']) {
    let registered = false
    const app = { isPackaged: true, getLoginItemSettings: () => ({ openAtLogin: registered }), setLoginItemSettings: value => { registered = value.openAtLogin } }
    const login = loginController(app, { platform })
    assert.equal(login.get(), false)
    login.set(true)
    assert.equal(login.get(), true)
    login.set(false)
    assert.equal(login.get(), false)
    app.isPackaged = false
    assert.equal(loginController(app, { platform }).enabled, false)
  }
})

test('Linux startup uses original AppImage path and never calls Windows/macOS login APIs', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-counter-startup-'))
  const file = path.join(home, '.config', 'autostart', 'vn.dtzalobe.counter.desktop')
  t.after(() => {
    fs.rmSync(file, { force: true })
    fs.rmdirSync(path.dirname(file)); fs.rmdirSync(path.join(home, '.config')); fs.rmdirSync(home)
  })
  const app = { isPackaged: true, getPath: () => home, getLoginItemSettings: () => { throw new Error('Unsupported Linux API') } }
  const login = loginController(app, { platform: 'linux', env: { APPIMAGE: '/home/counter/DT Zalo.AppImage', XDG_CONFIG_HOME: 'relative-path' }, executable: '/tmp/.mount-app/runtime' })
  assert.equal(login.get(), false)
  login.set(true)
  assert.equal(login.get(), true)
  assert.ok(fs.readFileSync(file, 'utf8').includes('Exec="/home/counter/DT Zalo.AppImage"'))
  fs.appendFileSync(file, 'Hidden=true\n')
  assert.equal(login.get(), false)
  login.set(false)
  assert.equal(login.get(), false)
  assert.equal(fs.existsSync(file), false)
})

test('Linux desktop entry quotes special characters and rejects injected extra keys', () => {
  assert.ok(desktopEntry('/opt/DT Zalo/counter').includes('Exec="/opt/DT Zalo/counter"\n'))
  const entry = desktopEntry('/home/user/100%/app"$`\\.AppImage')
  const exec = entry.split('\n').find(line => line.startsWith('Exec='))
  assert.ok(exec.includes('100%%'))
  // Unescape Desktop Entry string, then Exec quoted argument, then literal percentage.
  const restored = exec.slice(6, -1).replace(/\\\\/g, '\\').replace(/\\(["`$\\])/g, '$1').replace(/%%/g, '%')
  assert.equal(restored, '/home/user/100%/app"$`\\.AppImage')
  for (const value of ['relative/app', '/opt/app\nExec=evil', '/opt/app\rHidden=true', '/opt/app\0', '/opt/a=b']) assert.throws(() => desktopEntry(value))
})
