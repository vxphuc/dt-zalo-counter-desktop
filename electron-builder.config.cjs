'use strict'
const path = require('node:path')
const { build, version } = require('./package.json')
const { trackFor, DOWNLOAD_ORIGIN } = require('./update-contract.cjs')
const platform = process.env.DTCRM_BUILD_PLATFORM
const arch = process.env.DTCRM_BUILD_ARCH
const track = trackFor(platform, arch)
const signedMac = platform === 'darwin' && process.env.DTCRM_MAC_SIGNED === '1'
module.exports = {
  ...build,
  directories: { output: path.resolve(__dirname, '../output/desktop-assistant', track, version) },
  extraMetadata: { desktopUpdateMode: platform === 'win32' || signedMac ? 'automatic' : 'manual' },
  publish: [{ provider: 'generic', url: `${DOWNLOAD_ORIGIN}/downloads/desktop/${track}/`, useMultipleRangeRequest: false }],
  ...(platform === 'darwin' ? { mac: { ...build.mac, target: signedMac ? ['dmg', 'zip'] : ['dmg'],
    identity: signedMac ? undefined : '-', hardenedRuntime: signedMac, notarize: signedMac,
    ...(signedMac ? { entitlements: 'assets/entitlements.mac.plist', entitlementsInherit: 'assets/entitlements.mac.plist' } : {}),
  }, forceCodeSigning: signedMac } : {}),
}
