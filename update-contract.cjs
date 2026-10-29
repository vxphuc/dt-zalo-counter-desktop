'use strict'
const semver = require('semver')
const DOWNLOAD_ORIGIN = 'https://dtzalobe.io.vn'
const DOWNLOAD_PAGE = `${DOWNLOAD_ORIGIN}/tai-app/`
const TRACKS = { 'win-x64': ['win32', 'x64'], 'mac-x64': ['darwin', 'x64'], 'mac-arm64': ['darwin', 'arm64'] }
function trackFor(platform, arch) {
  const track = Object.keys(TRACKS).find(key => TRACKS[key][0] === platform && TRACKS[key][1] === arch)
  if (!track) throw new Error('Chỉ hỗ trợ Windows x64, macOS Intel và Apple Silicon.')
  return track
}
function stableVersion(version) {
  return typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version) && semver.valid(version) === version
}
function validateLatest(data, track) {
  if (!TRACKS[track] || !data || data.track !== track || !stableVersion(data.version)
    || typeof data.automatic !== 'boolean' || !Number.isSafeInteger(data.size) || data.size < 1
    || !/^[a-f0-9]{64}$/.test(data.sha256)) throw new Error('Thông tin phiên bản không hợp lệ.')
  const extension = track === 'win-x64' ? 'exe' : 'dmg'
  const prefix = `/downloads/desktop/${track}/releases/${data.version}/`
  if (typeof data.url !== 'string' || !data.url.startsWith(prefix)
    || !new RegExp(`^DT-Zalo-Counter-[A-Za-z0-9.-]+\\.${extension}$`).test(data.url.slice(prefix.length))) {
    throw new Error('Đường dẫn bộ cài không hợp lệ.')
  }
  return { ...data, downloadUrl: new URL(data.url, DOWNLOAD_ORIGIN).href }
}
module.exports = { DOWNLOAD_ORIGIN, DOWNLOAD_PAGE, TRACKS, trackFor, stableVersion, validateLatest }
