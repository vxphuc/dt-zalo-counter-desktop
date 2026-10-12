const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const { EventEmitter } = require('node:events')
const policy = require('../window-policy.cjs')

test('only local bubble can move native window; drag follows cursor, clamps and saves position', async () => {
  const windows = [], ipc = new EventEmitter(), writes = []
  let cursor = { x: 900, y: 600 }, ready
  const area = { x: 0, y: 0, width: 1000, height: 700 }
  class FakeWindow extends EventEmitter {
    constructor(options) { super(); this.bounds = { x: options.x || 0, y: options.y || 0, width: options.width, height: options.height }; this.visible = options.show !== false; this.webContents = new EventEmitter(); this.webContents.mainFrame = {}; this.webContents.setWindowOpenHandler = () => {}; windows.push(this) }
    getBounds() { return this.bounds }
    setBounds(bounds) { this.bounds = bounds }
    setPosition(x, y) { this.bounds = { ...this.bounds, x, y } }
    isDestroyed() { return false }
    isVisible() { return this.visible }
    show() { this.visible = true }
    hide() { this.visible = false }
    focus() {}
    async loadFile() {}
    async loadURL() {}
  }
  const app = new EventEmitter()
  Object.assign(app, { isPackaged: true, requestSingleInstanceLock: () => true, getPath: () => '/fixture', quit() {}, whenReady: () => ({ then: fn => ({ catch: () => { ready = fn() } }) }) })
  class Tray { setToolTip() {} setContextMenu() {} on() {} }
  vm.runInNewContext(fs.readFileSync(require.resolve('../main.cjs'), 'utf8'), {
    process: { env: {}, platform: 'win32' }, __dirname: '/fixture', URL,
    require: name => {
      if (name === 'electron') return { app, BrowserWindow: FakeWindow, Menu: { buildFromTemplate: () => ({ popup() {} }) }, Tray, ipcMain: ipc, screen: { getPrimaryDisplay: () => ({ workArea: area }), getDisplayNearestPoint: () => ({ workArea: area }), getDisplayMatching: () => ({ workArea: area }), getCursorScreenPoint: () => cursor }, shell: {}, dialog: {}, session: { defaultSession: { setPermissionRequestHandler() {} } } }
      if (name === 'node:fs') return { mkdirSync() {}, readFileSync: () => '{}', writeFileSync: (_, data) => writes.push(JSON.parse(data)) }
      if (name === './window-policy.cjs') return policy
      if (name === './update-controller.cjs') return { createUpdateController: () => ({ start() {}, menuItems: () => [] }) }
      if (name === './platform-support.cjs') return { configureDesktopHost() {}, floatWindow() {}, loginController: () => ({ enabled: false, get: () => false }) }
      return require(name)
    },
  })
  await ready
  const [bubble, panel] = windows, start = bubble.getBounds()
  const local = { sender: bubble.webContents, senderFrame: bubble.webContents.mainFrame }
  const remote = { sender: panel.webContents, senderFrame: panel.webContents.mainFrame }
  ipc.emit('counter:drag-start', remote); cursor = { x: 900, y: 400 }; ipc.emit('counter:drag-move', remote)
  assert.deepEqual(bubble.getBounds(), start)
  ipc.emit('counter:drag-start', local); cursor = { x: 900, y: 200 }; ipc.emit('counter:drag-move', local)
  assert.equal(bubble.getBounds().y, start.y - 200)
  assert.equal(panel.isVisible(), false, 'Dragging must not open popup')
  ipc.emit('counter:toggle', local)
  cursor = { x: 900, y: -1000 }; ipc.emit('counter:drag-move', local)
  assert.equal(bubble.getBounds().y, 0)
  assert.deepEqual(panel.getBounds(), policy.panelBounds(bubble.getBounds(), area))
  ipc.emit('counter:drag-end', local)
  assert.equal(writes.at(-1).position.y, 0)
  cursor = { x: 900, y: 500 }; ipc.emit('counter:drag-move', local)
  assert.equal(bubble.getBounds().y, 0, 'Movement after release must be ignored')
})
