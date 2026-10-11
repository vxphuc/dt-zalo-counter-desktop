const { test } = require('node:test')
const assert = require('node:assert/strict')
const { crmUrl, sameOrigin, safeExternal, panelBounds } = require('../window-policy.cjs')
test('CRM uses secure origin; HTTP localhost allowed only in development', () => {
  assert.equal(crmUrl('https://crm.example/path?secret=x'), 'https://crm.example/desktop-assistant')
  assert.throws(() => crmUrl('http://crm.example'))
  assert.throws(() => crmUrl('https://name:secret@crm.example'))
  assert.throws(() => crmUrl('http://localhost:5173'))
  assert.equal(crmUrl('http://localhost:5173', true), 'http://localhost:5173/desktop-assistant')
})
test('remote navigation never permits a foreign origin or executable scheme', () => {
  assert.equal(sameOrigin('https://crm.example/login', 'https://crm.example'), true)
  for (const value of ['https://crm.example.evil.test/', 'file:///C:/Windows', 'javascript:alert(1)', 'https://user:pass@crm.example']) assert.equal(sameOrigin(value, 'https://crm.example'), false)
  for (const value of ['file:///C:/test.exe', 'javascript:alert(1)', 'data:text/html,hi', 'ms-settings:']) assert.equal(safeExternal(value), false)
})
test('popup remains inside small and multi-monitor work areas', () => {
  const area = { x: -1280, y: 0, width: 1280, height: 720 }
  const bounds = panelBounds({ x: -1250, y: 20 }, area)
  assert.ok(bounds.x >= area.x && bounds.x + bounds.width <= area.x + area.width)
  assert.ok(bounds.y >= area.y && bounds.y + bounds.height <= area.y + area.height)
})
