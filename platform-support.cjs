'use strict'
const fs = require('node:fs')
const path = require('node:path')

function configureDesktopHost(app, platform = process.platform, env = process.env) {
  // XWayland provides placement/dragging/always-on-top unavailable on native Wayland.
  if (platform === 'linux' && env.DISPLAY) app.commandLine.appendSwitch('ozone-platform', 'x11')
}

function floatWindow(window, platform = process.platform) {
  window.setAlwaysOnTop(true, platform === 'linux' ? 'normal' : 'screen-saver')
  if (platform === 'darwin') window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  else if (platform === 'linux') window.setVisibleOnAllWorkspaces(true)
}

function desktopEntry(executable) {
  if (!path.posix.isAbsolute(executable) || /[\r\n\0=]/.test(executable)) throw new Error('Đường dẫn ứng dụng không hợp lệ để khởi động cùng Linux.')
  // Desktop Entry value escaping is applied before Exec argument unquoting.
  const quoted = executable.replace(/["`$\\]/g, character => '\\' + character).replace(/\\/g, '\\\\').replace(/%/g, '%%')
  return `[Desktop Entry]\nType=Application\nName=DT Zalo - Tro ly tai quay\nExec="${quoted}"\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`
}

function loginController(app, { platform = process.platform, env = process.env, executable = process.execPath } = {}) {
  if (platform !== 'linux') return {
    enabled: app.isPackaged,
    get: () => app.isPackaged && app.getLoginItemSettings().openAtLogin,
    set: enabled => app.setLoginItemSettings({ openAtLogin: enabled }),
  }
  const config = env.XDG_CONFIG_HOME && path.posix.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(app.getPath('home'), '.config')
  const file = path.join(config, 'autostart', 'vn.dtzalobe.counter.desktop')
  return {
    enabled: app.isPackaged,
    get: () => {
      try { return !/^(Hidden=true|X-GNOME-Autostart-enabled=false)$/m.test(fs.readFileSync(file, 'utf8')) }
      catch { return false }
    },
    set: (enabled, updatedExecutable) => {
      if (!enabled) { fs.rmSync(file, { force: true }); return }
      const entry = desktopEntry(updatedExecutable || env.APPIMAGE || executable)
      fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
      fs.writeFileSync(file, entry, { mode: 0o600 })
    },
  }
}

module.exports = { configureDesktopHost, floatWindow, desktopEntry, loginController }
