'use strict'
const fs = require('node:fs')
const path = require('node:path')
const UPDATE_ROOT = 'https://dtzalobe.io.vn/desktop-updates'

function updateTarget({ platform = process.platform, arch = process.arch, packaged, macSigned, appImage, packageType }) {
  if (!packaged) return { reason: 'Chức năng cập nhật chỉ dùng trong bản đã cài đặt.' }
  if (!['x64', 'arm64'].includes(arch)) return { reason: 'Chưa hỗ trợ cập nhật cho kiến trúc máy này.' }
  if (platform === 'win32' && arch === 'x64') return { kind: 'nsis', channel: 'win-x64' }
  if (platform === 'darwin') return macSigned ? { kind: 'mac', channel: `mac-${arch}` } : { reason: 'Bản Mac này chưa ký Developer ID. Cần cài bản Mac đã ký trước khi dùng tự cập nhật.' }
  if (platform === 'linux' && appImage) return { kind: 'appimage', channel: `linux-${arch}` }
  if (platform === 'linux' && packageType === 'deb') return { kind: 'deb', channel: `linux-${arch}` }
  return { reason: 'Linux: hãy dùng bản AppImage hoặc bộ cài .deb để cập nhật.' }
}

function readPolicy() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'update-policy.json'), 'utf8')) } catch { return { macSigned: false } }
}

function createUpdateController({ app, dialog, shell, getWindow = () => null, onChange = () => {}, beforeInstall = () => {}, onInstallFailure = () => {}, onAppImagePathChanged = () => {}, platform = process.platform, arch = process.arch, env = process.env, resourcesPath = process.resourcesPath, policy = readPolicy(), factory, timers = { setTimeout, setInterval, clearTimeout, clearInterval } }) {
  let packageType = ''
  if (platform === 'linux' && !env.APPIMAGE && resourcesPath) {
    try { packageType = fs.readFileSync(path.join(resourcesPath, 'package-type'), 'utf8').trim() } catch { /* A loose executable is not an installed package. */ }
  }
  const target = updateTarget({ platform, arch, packaged: app.isPackaged, macSigned: policy.macSigned === true, appImage: env.APPIMAGE, packageType })
  let state = { status: target.reason ? 'disabled' : 'idle', reason: target.reason, version: app.getVersion(), percent: 0 }
  let updater, manualCheck = false, noticeOpen = false, downloading = false, installing = false, initialTimer, intervalTimer
  const notify = options => {
    const window = getWindow()
    return window && !window.isDestroyed() ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options)
  }
  const change = values => { state = { ...state, ...values }; onChange(state) }
  const failure = () => {
    downloading = false
    const showError = manualCheck || installing
    if (installing) { installing = false; onInstallFailure() }
    manualCheck = false
    change({ status: 'error' })
    if (showError) void notify({ type: 'warning', title: 'Chưa cập nhật được', message: 'Không kết nối hoặc tải được bản cập nhật. Kiểm tra mạng rồi chọn “Kiểm tra cập nhật” để thử lại.', buttons: ['Đóng'] }).catch(() => {})
  }
  function install() {
    if (state.status !== 'ready') return
    if (target.kind === 'deb') {
      // Let the OS package installer request permission. Never run Electron as root,
      // or install with flags disabling package authentication / permitting downgrades.
      void shell.openPath(state.downloadedFile).then(error => {
        if (error) return notify({ type: 'warning', title: 'Mở bộ cài cập nhật', message: 'Không mở được trình cài .deb. Dùng trình quản lý phần mềm để cài file đã tải.', detail: state.downloadedFile, buttons: ['Đóng'] })
      }).catch(failure)
      return
    }
    try {
      installing = true
      beforeInstall()
      updater.quitAndInstall(false, true)
    } catch { failure() }
  }
  async function check(manual = false) {
    if (!updater) { if (manual) await notify({ type: 'info', title: 'Cập nhật ứng dụng', message: target.reason, buttons: ['Đóng'] }); return }
    if (['checking', 'downloading'].includes(state.status)) return
    if (state.status === 'ready') { if (manual) await promptReady(); return }
    manualCheck = manual
    change({ status: 'checking' })
    try {
      const result = await updater.checkForUpdates()
      // Consume the download promise as well as the updater's error event.
      result?.downloadPromise?.catch(() => {})
    } catch { failure() }
  }
  async function promptReady() {
    if (noticeOpen) return
    noticeOpen = true
    try {
      const { response } = await notify({ type: 'info', title: 'Có bản cập nhật mới', message: `Bản ${state.version} đã tải xong.`, detail: target.kind === 'deb' ? 'Mở trình cài đặt của Linux để cập nhật. Hệ điều hành có thể yêu cầu mật khẩu quản trị.' : 'Hoàn tất phiếu đang nhập trước khi khởi động lại ứng dụng.', buttons: [target.kind === 'deb' ? 'Mở bộ cài cập nhật' : 'Khởi động lại để cập nhật', 'Để sau'], defaultId: 1, cancelId: 1 })
      if (response === 0) install()
    } finally { noticeOpen = false }
  }
  if (!target.reason) {
    const options = { provider: 'generic', url: `${UPDATE_ROOT}/${target.channel}/`, useMultipleRangeRequest: false }
    const classes = { nsis: 'NsisUpdater', mac: 'MacUpdater', appimage: 'AppImageUpdater', deb: 'DebUpdater' }
    updater = factory ? factory(target, options) : new (require('electron-updater')[classes[target.kind]])(options)
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = false
    updater.allowDowngrade = false
    updater.allowPrerelease = false
    updater.disableWebInstaller = true
    updater.logger = { info() {}, warn() {}, error() {}, debug() {} }
    updater.on('error', failure)
    if (target.kind === 'appimage') updater.on('appimage-filename-updated', onAppImagePathChanged)
    updater.on('update-available', info => { downloading = true; change({ status: 'downloading', version: info.version, percent: 0 }) })
    updater.on('download-progress', info => {
      const percent = Math.max(0, Math.min(100, Math.floor(info.percent || 0)))
      if (percent !== state.percent) change({ percent })
    })
    updater.on('update-not-available', () => {
      const showNotice = manualCheck
      manualCheck = false
      change({ status: 'idle', version: app.getVersion() })
      if (showNotice) void notify({ type: 'info', title: 'Ứng dụng đã cập nhật', message: `Bạn đang dùng bản mới nhất: ${app.getVersion()}.`, buttons: ['Đóng'] }).catch(() => {})
    })
    updater.on('update-downloaded', info => {
      downloading = false; manualCheck = false
      change({ status: 'ready', version: info.version, downloadedFile: info.downloadedFile, percent: 100 })
      void promptReady().catch(() => {})
    })
  }
  function start() {
    if (!updater || initialTimer) return
    initialTimer = timers.setTimeout(() => { void check() }, 15000)
    intervalTimer = timers.setInterval(() => { if (!downloading) void check() }, 6 * 60 * 60 * 1000)
    initialTimer.unref?.(); intervalTimer.unref?.()
  }
  function stop() { timers.clearTimeout(initialTimer); timers.clearInterval(intervalTimer) }
  function menuItems() {
    const labels = { checking: 'Đang kiểm tra cập nhật…', downloading: `Đang tải bản ${state.version}: ${state.percent}%`, ready: target.kind === 'deb' ? `Mở bộ cài ${state.version}` : `Khởi động lại để cập nhật ${state.version}` }
    return [
      { label: `Phiên bản ${app.getVersion()}`, enabled: false },
      { label: labels[state.status] || 'Kiểm tra cập nhật', enabled: !['checking', 'downloading'].includes(state.status), click: () => { if (state.status === 'ready') void promptReady().catch(() => {}); else void check(true).catch(() => {}) } },
    ]
  }
  app.on('before-quit', stop)
  return { start, stop, check, install, menuItems, getState: () => ({ ...state }) }
}
module.exports = { UPDATE_ROOT, updateTarget, createUpdateController }
