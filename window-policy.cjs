'use strict'

function crmUrl(value = 'https://dtzalobe.io.vn', development = false) {
  const url = new URL(value)
  const local = development && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('CRM cần địa chỉ HTTPS hợp lệ.')
  url.pathname = '/desktop-assistant'; url.search = ''; url.hash = ''
  return url.href
}
function sameOrigin(value, origin) {
  try { const url = new URL(value); return url.origin === origin && !url.username && !url.password } catch { return false }
}
function safeExternal(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
function panelBounds(bubble, area) {
  const width = Math.min(600, area.width), height = Math.min(850, area.height)
  return { width, height, x: Math.max(area.x, Math.min(bubble.x - width - 12, area.x + area.width - width)), y: Math.max(area.y, Math.min(bubble.y + 78 - height, area.y + area.height - height)) }
}
module.exports = { crmUrl, sameOrigin, safeExternal, panelBounds }
