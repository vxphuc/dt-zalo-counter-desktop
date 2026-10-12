'use strict'
const BUBBLE_SIZE = 66

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
  const width = Math.min(480, area.width), height = Math.min(680, area.height)
  return { width, height, x: Math.max(area.x, Math.min(bubble.x - width - 12, area.x + area.width - width)), y: Math.max(area.y, Math.min(bubble.y + BUBBLE_SIZE - height, area.y + area.height - height)) }
}
function bubblePosition(position, area) {
  return { x: Math.round(Math.max(area.x, Math.min(position.x, area.x + area.width - BUBBLE_SIZE))), y: Math.round(Math.max(area.y, Math.min(position.y, area.y + area.height - BUBBLE_SIZE))) }
}
module.exports = { BUBBLE_SIZE, crmUrl, sameOrigin, safeExternal, panelBounds, bubblePosition }
