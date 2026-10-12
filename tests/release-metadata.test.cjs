const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const yaml = require('js-yaml')
const { validateMetadata, metadataName } = require('../scripts/prepare-release.cjs')

test('release validation rejects wrong hashes, versions, architectures and external URLs', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-release-'))
  try {
    const name = 'DT-Zalo-Counter-Setup-1.0.4.exe', buffer = Buffer.from('fixture-only')
    fs.writeFileSync(path.join(directory, name), buffer)
    const info = { version: '1.0.4', files: [{ url: name, size: buffer.length, sha512: crypto.createHash('sha512').update(buffer).digest('base64') }] }
    assert.equal(validateMetadata(yaml.dump(info), directory, '1.0.4', 'win', 'x64').version, '1.0.4')
    assert.throws(() => validateMetadata(yaml.dump(info), directory, '1.0.5', 'win', 'x64'))
    for (const url of ['https://other.example/file.exe', '../file.exe', 'DT-Zalo-Counter-1.0.4-macOS-arm64.zip']) {
      assert.throws(() => validateMetadata(yaml.dump({ ...info, files: [{ ...info.files[0], url }] }), directory, '1.0.4', 'win', 'x64'))
    }
    assert.throws(() => validateMetadata(yaml.dump({ ...info, files: [{ ...info.files[0], sha512: 'invalid' }] }), directory, '1.0.4', 'win', 'x64'))
    assert.equal(metadataName('linux', 'arm64'), 'latest-linux-arm64.yml')
    assert.equal(metadataName('mac', 'arm64'), 'latest-mac.yml')
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
