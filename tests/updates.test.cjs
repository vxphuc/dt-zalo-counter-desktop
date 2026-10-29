'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createUpdates } = require('../updates.cjs')
const { trackFor, validateLatest } = require('../update-contract.cjs')
function latest(track = 'win-x64', version = '1.0.13') {
  return { track, version, automatic: track === 'win-x64', size: 1234, sha256: 'a'.repeat(64), url: `/downloads/desktop/${track}/releases/${version}/DT-Zalo-Counter-${version}.${track === 'win-x64' ? 'exe' : 'dmg'}` }
}
function fixture(overrides = {}) {
  const calls = [], dialogs = [], updater = new EventEmitter()
  let response = 1, data = latest(), networkError = false, releaseDownload
  updater.checkForUpdates = async () => { calls.push('check'); return { updateInfo: { version: data.version } } }
  updater.downloadUpdate = async () => { calls.push('download'); if (releaseDownload) await new Promise(resolve => { releaseDownload.resolve = resolve }); updater.emit('update-downloaded') }
  updater.quitAndInstall = (...args) => calls.push(['install', ...args])
  const instance = createUpdates({ app: { isPackaged: true, getVersion: () => '1.0.12' }, platform: 'win32', arch: 'x64', updater,
    dialog: { showMessageBox: async options => { dialogs.push(options); return { response } } }, beforeInstall: () => calls.push('before-install'), openExternal: async url => calls.push(url),
    fetchLatest: async url => { calls.push(url); if (networkError) throw Error('network'); return { ok: true, json: async () => data } }, ...overrides })
  return { instance, calls, dialogs, updater, setData(value) { data = value }, failNetwork() { networkError = true }, choose(value) { response = value }, holdDownload() { releaseDownload = {} }, finishDownload() { releaseDownload.resolve() } }
}
test('download contract restricts platform, version, path and executable type', () => {
  assert.equal(trackFor('darwin', 'arm64'), 'mac-arm64')
  assert.throws(() => trackFor('linux', 'x64'))
  const good = latest()
  assert.equal(validateLatest(good, 'win-x64').downloadUrl.startsWith('https://dtzalobe.io.vn/downloads/desktop/'), true)
  for (const bad of [{ ...good, url: 'https://evil.test/a.exe' }, { ...good, url: good.url.replace('DT-Zalo', '../DT-Zalo') }, { ...good, version: '1.0.13-beta' }, { ...good, size: -1 }, { ...good, track: 'mac-x64' }]) assert.throws(() => validateLatest(bad, 'win-x64'))
})
test('Windows downloads once, waits for user, then sets quitting before installation', async () => {
  const f = fixture(); f.holdDownload()
  const checking = f.instance.check(); await new Promise(resolve => setImmediate(resolve))
  await f.instance.check(true)
  assert.equal(f.calls.filter(value => value === 'check').length, 1)
  f.finishDownload(); await checking
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.updater.autoInstallOnAppQuit, false)
  assert.equal(f.updater.allowDowngrade, false)
  assert.equal(f.calls.some(value => Array.isArray(value)), false)
  f.choose(0); await f.instance.check(true)
  assert.deepEqual(f.calls.slice(-2), ['before-install', ['install', false, true]])
  assert.equal(f.calls.filter(value => value === 'download').length, 1)
  f.instance.dispose()
})
test('manual Mac release opens only its validated architecture download and never uses native updater', async () => {
  const f = fixture({ platform: 'darwin', arch: 'arm64' }); f.setData(latest('mac-arm64')); f.choose(0)
  await f.instance.check()
  assert.ok(f.calls.at(-1).includes('/mac-arm64/releases/1.0.13/'))
  assert.equal(f.calls.includes('check'), false)
  assert.equal(f.calls.includes('download'), false)
  f.instance.dispose()
})
test('old versions, metadata mismatch and invalid paths never install', async () => {
  const f = fixture(); f.setData(latest('win-x64', '1.0.11')); await f.instance.check(true)
  assert.equal(f.calls.includes('check'), false)
  f.setData(latest()); f.updater.checkForUpdates = async () => ({ updateInfo: { version: '1.0.14' } })
  await f.instance.check(true); assert.equal(f.calls.includes('download'), false)
  f.setData({ ...latest(), url: '//evil.test/file.exe' }); await f.instance.check(true)
  assert.equal(f.calls.includes('download'), false)
  f.instance.dispose()
})
test('network errors are quiet in background, manual retry informs user, disposed app stops timers', async () => {
  const cleared = []
  const f = fixture({ setTimeoutFn: () => 11, setIntervalFn: () => 22, clearTimeoutFn: id => cleared.push(id), clearIntervalFn: id => cleared.push(id) })
  f.instance.start(); f.instance.start(); f.failNetwork(); await f.instance.check()
  assert.equal(f.dialogs.length, 0)
  await f.instance.check(true); assert.equal(f.dialogs.length, 1)
  f.instance.dispose(); assert.deepEqual(cleared, [11, 22]); assert.equal(f.updater.listenerCount('update-downloaded'), 0)
  const count = f.calls.length; await f.instance.check(true); assert.equal(f.calls.length, count)
})
test('unpackaged app makes no update requests', async () => {
  const f = fixture({ app: { isPackaged: false } }); await f.instance.check()
  assert.equal(f.calls.length, 0); f.instance.dispose()
})
