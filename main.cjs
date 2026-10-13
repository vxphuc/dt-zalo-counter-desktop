'use strict'
const { app, BrowserWindow, Menu, Tray, ipcMain, screen, shell, dialog, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { crmUrl, sameOrigin, safeExternal, panelBounds, bubblePosition, BUBBLE_SIZE } = require('./window-policy.cjs')
const { configureDesktopHost, floatWindow, loginController, initializeLogin } = require('./platform-support.cjs')
let bubble, panel, tray, quitting = false
let login
let settings = {}
let url, origin
let drag = null
configureDesktopHost(app)
if (process.env.DTCRM_USER_DATA && !app.isPackaged) app.setPath('userData', path.resolve(process.env.DTCRM_USER_DATA))
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (panel) showPanel() })
  app.on('activate', () => { if (bubble && !bubble.isDestroyed()) bubble.show(); showPanel() })
  app.on('before-quit', () => { quitting = true })
  app.on('window-all-closed', () => { if (quitting) app.quit() })
  app.whenReady().then(createWindows).catch(error => { dialog.showErrorBox('Không mở được trợ lý', error.message); app.quit() })
}
function saveSettings() {
  try { fs.writeFileSync(path.join(app.getPath('userData'), 'counter-settings.json'), JSON.stringify(settings)) } catch { /* Position persistence is optional. */ }
}
function showPanel() {
  if (!panel || panel.isDestroyed()) return
  const area = screen.getDisplayMatching(bubble.getBounds()).workArea
  panel.setBounds(panelBounds(bubble.getBounds(), area))
  panel.show(); panel.focus()
}
function bubbleEvent(event) {
  return bubble && !bubble.isDestroyed() && event.sender === bubble.webContents && event.senderFrame === bubble.webContents.mainFrame
}
function moveBubble() {
  if (!drag || !bubble || bubble.isDestroyed()) return
  const cursor = screen.getCursorScreenPoint()
  const dx = cursor.x - drag.cursor.x, dy = cursor.y - drag.cursor.y
  if (!drag.moved && Math.hypot(dx, dy) < 5) return
  drag.moved = true
  const position = bubblePosition({ x: drag.position.x + dx, y: drag.position.y + dy }, screen.getDisplayNearestPoint(cursor).workArea)
  bubble.setPosition(position.x, position.y)
  if (panel && !panel.isDestroyed() && panel.isVisible()) panel.setBounds(panelBounds(bubble.getBounds(), screen.getDisplayMatching(bubble.getBounds()).workArea))
}
function openExternal(value) {
  if (safeExternal(value)) void shell.openExternal(value).catch(() => {})
}
function secureContents(contents, remote) {
  contents.setWindowOpenHandler(({ url: target }) => { openExternal(target); return { action: 'deny' } })
  contents.on('will-navigate', (event, target) => {
    if (!remote || !sameOrigin(target, origin)) { event.preventDefault(); if (remote) openExternal(target) }
  })
  contents.on('will-attach-webview', event => event.preventDefault())
}
async function createWindows() {
  login = loginController(app)
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'counter-settings.json'), 'utf8'))
    settings = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
  } catch { settings = {} }
  url = crmUrl(process.env.DTCRM_URL || 'https://dtzalobe.io.vn', !app.isPackaged)
  origin = new URL(url).origin
  // Remote CRM receives no native bridge, filesystem API, or Node integration.
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'clipboard-sanitized-write'))
  const area = screen.getPrimaryDisplay().workArea
  const position = settings.position
  const x = Number.isFinite(position?.x) ? position.x : area.x + area.width - 96
  const y = Number.isFinite(position?.y) ? position.y : area.y + area.height - 120
  const visibleArea = screen.getDisplayNearestPoint({ x, y }).workArea
  bubble = new BrowserWindow({ width: BUBBLE_SIZE, height: BUBBLE_SIZE, x: Math.max(visibleArea.x, Math.min(x, visibleArea.x + visibleArea.width - BUBBLE_SIZE)), y: Math.max(visibleArea.y, Math.min(y, visibleArea.y + visibleArea.height - BUBBLE_SIZE)), frame: false, transparent: true, resizable: false, maximizable: false, skipTaskbar: true, alwaysOnTop: true, title: 'DT Zalo - Bong bóng tại quầy', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } })
  floatWindow(bubble)
  bubble.on('moved', () => { const bounds = bubble.getBounds(); settings.position = { x: bounds.x, y: bounds.y }; saveSettings() })
  secureContents(bubble.webContents, false)
  await bubble.loadFile(path.join(__dirname, 'bubble.html'))
  panel = new BrowserWindow({ width: 408, height: 520, show: false, alwaysOnTop: true, backgroundColor: '#ffffff', title: 'DT Zalo - Trợ lý tại quầy', icon: path.join(__dirname, 'assets/icon.png'), autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } })
  floatWindow(panel)
  panel.on('close', event => { if (!quitting) { event.preventDefault(); panel.hide() } })
  secureContents(panel.webContents, true)
  void panel.loadURL(url).catch(() => {})
  panel.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return
    dialog.showMessageBox(panel, { type: 'warning', title: 'Không kết nối được CRM', message: 'Kiểm tra kết nối mạng và địa chỉ CRM, sau đó chọn Thử lại.', buttons: ['Thử lại', 'Đóng'], defaultId: 0 }).then(({ response }) => { if (response === 0) void panel.loadURL(url).catch(() => {}); else panel.hide() })
  })
  ipcMain.on('counter:toggle', event => { if (event.sender === bubble.webContents && event.senderFrame === bubble.webContents.mainFrame) { if (panel.isVisible()) panel.hide(); else showPanel() } })
  ipcMain.on('counter:menu', event => { if (event.sender === bubble.webContents && event.senderFrame === bubble.webContents.mainFrame) menu().popup({ window: bubble }) })
  ipcMain.on('counter:drag-start', event => {
    if (bubbleEvent(event)) drag = { cursor: screen.getCursorScreenPoint(), position: bubble.getBounds(), moved: false }
  })
  ipcMain.on('counter:drag-move', event => { if (bubbleEvent(event)) moveBubble() })
  ipcMain.on('counter:drag-end', event => {
    if (!bubbleEvent(event) || !drag) return
    moveBubble()
    if (drag.moved) { const { x, y } = bubble.getBounds(); settings.position = { x, y }; saveSettings() }
    drag = null
  })
  tray = new Tray(path.join(__dirname, 'assets/icon.png'))
  tray.setToolTip('DT Zalo - Trợ lý tại quầy')
  tray.setContextMenu(menu()); tray.on('click', showPanel)
  try {
    if (initializeLogin(login, settings)) { saveSettings(); tray.setContextMenu(menu()) }
  } catch (error) {
    dialog.showErrorBox('Không thiết lập được khởi động cùng máy', error.message)
  }
}
function menu() {
  return Menu.buildFromTemplate([
    { label: 'Mở nhập mua hàng', click: showPanel },
    { label: 'Mở CRM trong trình duyệt', click: () => openExternal(origin) },
    { label: 'Tải lại CRM', click: () => { void panel.loadURL(url).catch(() => {}); showPanel() } },
    { label: `Khởi động cùng ${process.platform === 'darwin' ? 'macOS' : process.platform === 'linux' ? 'Linux' : 'Windows'}`, type: 'checkbox', enabled: login.enabled, checked: login.get(), click: item => {
      try { login.set(item.checked); settings.startupEnabled = item.checked; saveSettings() }
      catch (error) { dialog.showErrorBox('Không thiết lập được khởi động cùng máy', error.message) }
      if (tray) tray.setContextMenu(menu())
    } },
    { type: 'separator' }, { label: 'Thoát trợ lý', click: () => app.quit() },
  ])
}
