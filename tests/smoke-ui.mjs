// Local QA only. All CRM API requests are intercepted with synthetic fixture data.
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const output = path.join(root, 'output/desktop-assistant/review')
await mkdir(output, { recursive: true })
const port = 9338
const environment = { ...process.env, DTCRM_URL: 'http://127.0.0.1:5192', DTCRM_USER_DATA: path.join(root, `.tmp-counter-profile-${Date.now()}`) }
delete environment.ELECTRON_RUN_AS_NODE
const child = spawn(path.join(root, 'desktop-assistant/node_modules/electron/dist/electron.exe'), ['.', `--remote-debugging-port=${port}`], {
  cwd: path.join(root, 'desktop-assistant'), windowsHide: true,
  env: environment, stdio: ['ignore', 'pipe', 'pipe'],
})
child.stderr.on('data', data => { void writeFile(path.join(output, 'electron-stderr.log'), data, { flag: 'a' }) })
child.on('exit', code => { if (code) console.error(`Electron exit ${code}`) })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(fn) { for (let i = 0; i < 100; i++) { const value = await fn().catch(() => null); if (value) return value; await pause(150) } throw new Error('UI did not reach expected state') }
class CDP {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.events = new Map(); this.ready = new Promise(resolve => this.ws.addEventListener('open', resolve)); this.ws.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id) { const pending = this.pending.get(message.id); this.pending.delete(message.id); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result) } else this.events.get(message.method)?.(message.params) }) }
  async call(method, params = {}) { await this.ready; const id = ++this.id; const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); this.ws.send(JSON.stringify({ id, method, params })); return promise }
  async eval(expression) { const result = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
}
const store = { id: 'store-a', organization_id: 'org-a', name: 'Cửa hàng thử nghiệm', code: 'TEST', status: 'active' }
const access = { user: { id: 'employee-a', full_name: 'Nhân viên thử nghiệm', status: 'active' }, platform_roles: [], organizations: [], stores: [{ store_id: store.id, role: 'store_manager' }] }
let invitations = [], issued = 0
const receipts = new Map()
const requestKeys = []
let simulateLostResponse = true
let policy = { amount_per_play: 200000, valid_days: 7 }
const apiRequests = []
const products = [{ id: 'product-a', name: 'Hộp sữa', price: '150000', status: 'active' }, { id: 'product-b', name: 'Bánh quy', price: '50000', status: 'active' }]
function mock(url, method, raw) {
  const route = new URL(url).pathname.replace('/api/v1', '')
  const body = raw ? JSON.parse(raw) : {}
  if (method === 'OPTIONS') return {}
  apiRequests.push({ route, method })
  if (route === '/auth/login') return { data: { access_token: 'fixture-only', csrf_token: 'fixture-only', session_expires_at: Math.floor(Date.now() / 1000) + 3600, user: access.user } }
  if (route === '/auth/me') return { data: access }
  if (route === '/stores') return { data: [store], meta: { total: 1 } }
  if (route === '/products') return { data: products, meta: { total: products.length } }
  if (route === '/zalo/mini-apps') return { data: [{ id: 'app-a', ...store, store_id: store.id, status: 'active', mini_games: [{ id: 'game-a', key: 'golden_egg', name: 'Đập trứng tại quầy', status: 'active' }], mini_game_rewards: [{ game_id: 'game-a', voucher_id: 'gift-a', win_percentage: 100, quantity_total: 10, quantity_awarded: 0 }] }] }
  if (route === '/purchase-games/policy') { if (method === 'PUT') policy = { amount_per_play: body.amount_per_play, valid_days: body.valid_days }; return { data: policy } }
  if (route === '/purchase-games/invitations' && method === 'GET') return { data: invitations }
  if (route === '/purchase-games/invitations' && method === 'POST') {
    requestKeys.push(body.request_key)
    if (receipts.has(body.request_key)) return { data: receipts.get(body.request_key) }
    const total = body.items.reduce((sum, row) => sum + Number(products.find(p => p.id === row.product_id).price) * row.quantity, 0)
    const item = { id: `invite-${++issued}`, phone_masked: '8491*****678', game_name: 'Đập trứng tại quầy', total_amount: String(total), credits: Math.floor(total / policy.amount_per_play), remaining: Math.floor(total / policy.amount_per_play), amount_per_play: policy.amount_per_play, expires_at: '2026-10-17T07:00:00Z', participation_url: 'https://zalo.me/s/fixture/?purchase_invitation_id=fixture-private', items: body.items }
    receipts.set(body.request_key, item)
    invitations = [item, ...invitations]; return { data: item }
  }
  throw new Error(`Unmocked API: ${route}`)
}
let bubble, panel
try {
  const tabs = await until(async () => { const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); return tabs.some(tab => tab.url.startsWith('http://127.0.0.1:5192/desktop-assistant')) && tabs.some(tab => tab.url.includes('bubble.html')) ? tabs : null })
  bubble = new CDP(tabs.find(tab => tab.url.includes('bubble.html')).webSocketDebuggerUrl)
  panel = new CDP(tabs.find(tab => tab.url.startsWith('http://127.0.0.1:5192/desktop-assistant')).webSocketDebuggerUrl)
  panel.events.set('Fetch.requestPaused', async event => {
    try {
      const response = mock(event.request.url, event.request.method, event.request.postData)
      if (simulateLostResponse && event.request.method === 'POST' && event.request.url.includes('/purchase-games/invitations')) {
        simulateLostResponse = false
        await panel.call('Fetch.failRequest', { requestId: event.requestId, errorReason: 'ConnectionClosed' })
        return
      }
      await panel.call('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://127.0.0.1:5192' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization,Content-Type,X-CSRF-TOKEN' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(JSON.stringify(response)).toString('base64') })
    } catch (error) { await panel.call('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Aborted' }); console.error(error.message) }
  })
  await panel.call('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] })
  await bubble.eval("document.getElementById('open').click()")
  await panel.call('Page.navigate', { url: 'http://127.0.0.1:5192/desktop-assistant' })
  await until(() => panel.eval("!!document.querySelector('input[type=password]')"))
  const set = async (selector, value) => panel.eval(`(() => {const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await set('input[inputmode=tel]', '0912345678'); await set('input[type=password]', 'fixture-password')
  await panel.eval("document.querySelector('form').requestSubmit()")
  await until(() => panel.eval("!!document.querySelector('.counter-form') && document.querySelectorAll('.counter-product-options button').length === 2"))
  assert.equal(await panel.eval('location.pathname'), '/desktop-assistant')
  await set('.counter-form input[type=tel]', '0912345678')
  await panel.eval("const select=document.querySelector('.counter-form select'); select.value='game-a';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.counter-product-options button').click()")
  await until(() => panel.eval("!!document.querySelector('.counter-line input')"))
  await set('.counter-line input', '3')
  await until(() => panel.eval("document.querySelector('.counter-total').innerText.includes('2 lượt')"))
  const overflow = await panel.eval('document.documentElement.scrollWidth > window.innerWidth')
  if (overflow) console.log(await panel.eval("JSON.stringify({innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>window.innerWidth).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width})).slice(0,15)})"))
  const before = await panel.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(output, 'counter-form.png'), Buffer.from(before.data, 'base64'))
  assert.equal(overflow, false)
  await panel.eval("document.querySelector('.counter-form').requestSubmit()")
  await until(() => panel.eval("document.querySelector('.counter-submit')?.innerText.includes('Thử lại')"))
  await panel.eval("document.querySelector('.counter-form').requestSubmit()")
  await until(() => panel.eval("!!document.querySelector('.counter-result img')"))
  assert.equal(issued, 1)
  assert.equal(requestKeys.length, 2)
  assert.equal(new Set(requestKeys).size, 1)
  assert.equal(invitations[0].credits, 2)
  assert.equal(await panel.eval("typeof window.require"), 'undefined')
  assert.equal(await panel.eval("typeof window.counterBubble"), 'undefined')
  const result = await panel.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(output, 'counter-result.png'), Buffer.from(result.data, 'base64'))
  await writeFile(path.join(output, 'smoke-report.json'), JSON.stringify({ loginRedirect: true, nativeBubbleToggle: true, privateBridgeUnavailableToCRM: true, lostResponseRetryUsesSameReceipt: true, quantity: 3, total: invitations[0].total_amount, credits: 2, noHorizontalOverflow: true, apiRequests }, null, 2))
  console.log('Native bubble, login, product quantity, private QR and renderer isolation passed.')
} finally { bubble?.ws.close(); panel?.ws.close(); child.kill() }
