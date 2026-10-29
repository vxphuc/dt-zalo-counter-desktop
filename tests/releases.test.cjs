'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const yaml = require('js-yaml')
const { prepareRelease, digest } = require('../scripts/prepare-release.cjs')
const { publishRelease } = require('../scripts/publish-release.cjs')
function fixture(t, track = 'win-x64', version = '1.0.12') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-release-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const filename = `DT-Zalo-Counter-${version}.${track === 'win-x64' ? 'exe' : 'dmg'}`
  fs.writeFileSync(path.join(directory, filename), 'fake installer for isolated release tests')
  const metadata = { version, files: [{ url: filename, sha512: digest(path.join(directory, filename), 'sha512', 'base64'), size: fs.statSync(path.join(directory, filename)).size }], path: filename }
  fs.writeFileSync(path.join(directory, 'latest.yml'), yaml.dump(metadata))
  return { directory, track, version, automatic: track === 'win-x64', filename }
}
test('release contains only its installer, verified feed and complete checksums', t => {
  const f = fixture(t); const bundle = prepareRelease(f)
  const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'latest.json')))
  assert.ok(manifest.url.endsWith(f.filename)); assert.equal(manifest.automatic, true)
  assert.equal(yaml.load(fs.readFileSync(path.join(bundle, 'latest.yml'), 'utf8')).files[0].url, `releases/1.0.12/${f.filename}`)
  assert.throws(() => prepareRelease(f), /EEXIST/)
})
test('corrupt builder checksum is rejected before publication', t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.directory, f.filename), 'tampered')
  assert.throws(() => prepareRelease(f), /Checksum/)
})
test('manual Mac package has a DMG download without an automatic feed', t => {
  const f = fixture(t, 'mac-arm64'); const bundle = prepareRelease(f)
  assert.equal(JSON.parse(fs.readFileSync(path.join(bundle, 'latest.json'))).automatic, false)
  assert.equal(fs.existsSync(path.join(bundle, 'latest-mac.yml')), false)
})
test('publisher switches one atomic pointer and rejects downgrade or tampered bundles', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t); const bundle = prepareRelease(f), root = path.join(f.directory, 'host')
  publishRelease(bundle, root)
  const current = path.join(root, f.track, 'current')
  assert.equal(fs.readlinkSync(current), 'releases/1.0.12')
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, f.track, 'latest.json'))).version, f.version)
  assert.throws(() => publishRelease(bundle, root), /lớn hơn/)
  const next = fixture(t, 'win-x64', '1.0.13'), nextBundle = prepareRelease(next)
  fs.appendFileSync(path.join(nextBundle, next.filename), 'tamper')
  assert.throws(() => publishRelease(nextBundle, root), /Checksum/)
  assert.equal(fs.readlinkSync(current), 'releases/1.0.12')
})
