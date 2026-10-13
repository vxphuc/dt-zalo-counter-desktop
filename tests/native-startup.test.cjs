'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const { EventEmitter } = require('node:events')
const policy = require('../window-policy.cjs')
const platform = require('../platform-support.cjs')

async function launch({ saved, registered = false, packaged = true, fail = false } = {}) {
  const windows = [], registrations = [], errors = []
  let ready, template, disk = saved, quit = false
  const area = { x: 0, y: 0, width: 1000, height: 700 }
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.visible = options.show !== false; this.bounds = options
      this.webContents = new EventEmitter(); this.webContents.mainFrame = {}
      this.webContents.setWindowOpenHandler = () => {}; windows.push(this)
    }
    getBounds() { return this.bounds }
    isDestroyed() { return false }
    async loadFile() {}
    async loadURL() {}
  }
  const app = new EventEmitter()
  Object.assign(app, {
    isPackaged: packaged, requestSingleInstanceLock: () => true, getPath: () => '/fixture',
    quit: () => { quit = true },
    whenReady: () => ({ then: fn => ({ catch: () => { ready = fn() } }) }),
    getLoginItemSettings: () => ({ openAtLogin: registered }),
    setLoginItemSettings: value => {
      if (fail) throw Error('Startup permission denied')
      registrations.push(value.openAtLogin); registered = value.openAtLogin
    },
  })
  class Tray { setToolTip() {} setContextMenu() {} on() {} }
  vm.runInNewContext(fs.readFileSync(require.resolve('../main.cjs'), 'utf8'), {
    process: { env: {}, platform: 'win32' }, __dirname: '/fixture', URL,
    require: name => {
      if (name === 'electron') return {
        app, BrowserWindow: Window, Menu: { buildFromTemplate: items => { template = items; return {} } },
        Tray, ipcMain: new EventEmitter(), shell: {},
        screen: { getPrimaryDisplay: () => ({ workArea: area }), getDisplayNearestPoint: () => ({ workArea: area }) },
        dialog: { showErrorBox: (title, message) => errors.push({ title, message }) },
        session: { defaultSession: { setPermissionRequestHandler() {} } },
      }
      if (name === 'node:fs') return {
        mkdirSync() {}, readFileSync: () => { if (disk === undefined) throw Error('No settings'); return JSON.stringify(disk) },
        writeFileSync: (_, json) => { disk = JSON.parse(json) },
      }
      if (name === './window-policy.cjs') return policy
      if (name === './platform-support.cjs') return { ...platform, floatWindow() {} }
      return require(name)
    },
  })
  await ready
  return { windows, registrations, errors, settings: () => disk, registered: () => registered,
    didQuit: () => quit, startupMenu: () => template.find(item => item.type === 'checkbox') }
}

test('native first launch registers startup, keeps popup hidden, and saves menu opt-out across restart', async () => {
  const first = await launch({ saved: { position: { x: 40, y: 50 } } })
  assert.deepEqual(first.registrations, [true])
  assert.equal(first.startupMenu().checked, true)
  assert.equal(first.windows[0].visible, true)
  assert.equal(first.windows[1].visible, false)
  first.startupMenu().click({ checked: false })
  assert.deepEqual(first.registrations, [true, false])
  assert.equal(first.settings().startupEnabled, false)
  assert.deepEqual(first.settings().position, { x: 40, y: 50 })
  const second = await launch({ saved: first.settings(), registered: false })
  assert.deepEqual(second.registrations, [])
  assert.equal(second.startupMenu().checked, false)
  second.startupMenu().click({ checked: true })
  assert.equal(second.settings().startupEnabled, true)
  const third = await launch({ saved: second.settings(), registered: false })
  assert.deepEqual(third.registrations, [], 'Disabling in Windows must not be undone on app launch')
  assert.equal(third.startupMenu().checked, false)
})

test('native dev mode writes no startup setting and registration failure does not close the app', async () => {
  const dev = await launch({ packaged: false })
  assert.deepEqual(dev.registrations, [])
  assert.equal(dev.startupMenu().enabled, false)
  assert.equal(dev.settings(), undefined)
  const failed = await launch({ fail: true })
  assert.equal(failed.didQuit(), false)
  assert.equal(failed.windows.length, 2)
  assert.equal(failed.errors[0].message, 'Startup permission denied')
  assert.equal(failed.settings(), undefined)
  const retry = await launch({ saved: failed.settings() })
  assert.deepEqual(retry.registrations, [true])
})
