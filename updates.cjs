'use strict'
const semver = require('semver')
const { DOWNLOAD_ORIGIN, DOWNLOAD_PAGE, trackFor, validateLatest } = require('./update-contract.cjs')

function createUpdates({ app, updater, dialog, openExternal, beforeInstall, onChange = () => {},
  fetchLatest = globalThis.fetch, platform = process.platform, arch = process.arch,
  setTimeoutFn = setTimeout, setIntervalFn = setInterval, clearTimeoutFn = clearTimeout, clearIntervalFn = clearInterval }) {
  const enabled = app.isPackaged && ['win32', 'darwin'].includes(platform)
  const track = enabled ? trackFor(platform, arch) : null
  let busy = false, ready = false, promptOpen = false, status = '', timer, interval
  let disposed = false
  const automatic = enabled && (platform === 'win32' || require('./package.json').desktopUpdateMode === 'automatic')
  function change(message) { status = message; onChange() }
  async function message(options) { return dialog.showMessageBox({ title: 'Cập nhật Tro Ly App', ...options }) }
  async function install() {
    if (!ready || promptOpen || disposed) return
    promptOpen = true
    try {
      const result = await message({ type: 'info', message: 'Bản cập nhật đã tải xong.', detail: 'Hoàn tất phiếu đang nhập trước khi khởi động lại để cài bản mới.', buttons: ['Cài và mở lại', 'Để sau'], defaultId: 1, cancelId: 1 })
      if (result.response === 0 && !disposed) { beforeInstall(); updater.quitAndInstall(false, true) }
    } finally { promptOpen = false }
  }
  if (automatic) {
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.allowDowngrade = false
    updater.allowPrerelease = false
    updater.disableWebInstaller = true
    updater.logger = null
  }
  const handlers = automatic ? {
    'download-progress': progress => change(`Đang tải cập nhật ${Math.floor(progress.percent)}%`),
    'update-downloaded': () => { ready = true; change('Cài bản cập nhật đã tải'); void install().catch(() => {}) },
    error: () => change('Thử kiểm tra cập nhật lại'),
  } : {}
  for (const [event, handler] of Object.entries(handlers)) updater.on(event, handler)
  async function check(manual = false) {
    if (!enabled || disposed) {
      if (manual && !disposed) await message({ type: 'info', message: 'Tự cập nhật chỉ hoạt động trong bản đã cài trên Windows/macOS.' })
      return
    }
    if (ready) return manual ? install() : undefined
    if (busy) return
    busy = true
    change('Đang kiểm tra cập nhật…')
    try {
      const response = await fetchLatest(`${DOWNLOAD_ORIGIN}/downloads/desktop/${track}/latest.json`, { cache: 'no-store', signal: AbortSignal.timeout(15000), redirect: 'error' })
      if (!response.ok) throw new Error('Không tải được thông tin cập nhật.')
      const latest = validateLatest(await response.json(), track)
      if (disposed) return
      if (!semver.gt(latest.version, app.getVersion())) {
        change('Kiểm tra bản cập nhật')
        if (manual) await message({ type: 'info', message: `Bạn đang dùng bản mới nhất (${app.getVersion()}).` })
        return
      }
      if (automatic && latest.automatic) {
        const result = await updater.checkForUpdates()
        // JSON and YAML can come from different edge caches. Never download a different version.
        if (!result || result.updateInfo.version !== latest.version) throw new Error('Máy chủ đang cập nhật phiên bản. Vui lòng thử lại.')
        change('Đang tải bản cập nhật…')
        await updater.downloadUpdate()
      } else {
        change(`Có bản ${latest.version} — tải để cài đè`)
        const result = await message({ type: 'info', message: `Đã có Tro Ly App ${latest.version}.`, detail: 'Tải bộ cài mới, thoát trợ lý rồi cài đè để giữ dữ liệu đăng nhập.', buttons: ['Tải bản mới', 'Để sau'], defaultId: 1, cancelId: 1 })
        if (result.response === 0 && !disposed) await openExternal(latest.downloadUrl)
      }
    } catch {
      change('Thử kiểm tra cập nhật lại')
      if (manual && !disposed) await message({ type: 'warning', message: 'Chưa kiểm tra hoặc tải được bản cập nhật.', detail: 'Bạn vẫn có thể dùng app bình thường. Kiểm tra mạng rồi thử lại hoặc mở trang tải bộ cài.', buttons: ['Đóng'] })
    } finally { busy = false; onChange() }
  }
  return {
    start() {
      if (!enabled || timer || interval || disposed) return
      timer = setTimeoutFn(() => { void check() }, 15000); timer.unref?.()
      interval = setIntervalFn(() => { void check() }, 6 * 60 * 60 * 1000); interval.unref?.()
    },
    check,
    menuItem: () => ({ label: status || 'Kiểm tra bản cập nhật', enabled: enabled && !busy, click: () => { void check(true) } }),
    downloadPage: DOWNLOAD_PAGE,
    dispose() {
      disposed = true; clearTimeoutFn(timer); clearIntervalFn(interval)
      for (const [event, handler] of Object.entries(handlers)) updater.removeListener(event, handler)
    },
  }
}
module.exports = { createUpdates }
