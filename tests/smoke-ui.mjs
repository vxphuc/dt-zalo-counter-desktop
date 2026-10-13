// Local QA only. All CRM API requests are intercepted with synthetic fixture data.
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { version } = JSON.parse(await readFile(path.join(root, 'desktop-assistant/package.json'), 'utf8'))
const output = path.join(root, 'output/desktop-assistant/review')
await mkdir(output, { recursive: true })
const port = 9338
const environment = { ...process.env, DTCRM_URL: 'http://127.0.0.1:5192', DTCRM_USER_DATA: path.join(root, `.tmp/counter-profile-${Date.now()}`) }
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
const policy = { amount_per_play: 200000, credits: 2, valid_days: 7 }
const apiRequests = []
const products = [{ id: 'product-a', name: 'Hộp sữa', sku: 'MILK', price: '150000', status: 'active' }, ...Array.from({ length: 54 }, (_, index) => ({ id: `product-${index}`, name: `Sản phẩm ${index + 1}`, sku: `SKU${index + 1}`, price: '50000', status: 'active' })), { id: 'product-hidden', name: 'Sản phẩm đã ẩn', price: '1', status: 'inactive' }]
const productPages = []
const redeemedVouchers = new Set()
let presentationUrl = null
function mock(url, method, raw) {
  const route = new URL(url).pathname.replace('/api/v1', '')
  const body = raw ? JSON.parse(raw) : {}
  if (method === 'OPTIONS') return {}
  apiRequests.push({ route, method })
  if (route === '/public/storefront/mini-game-presentation') return { data: {
    store, game: { id: 'game-a', key: 'golden_egg', name: 'Đập trứng tại quầy', status: 'active' },
    logo_url: null, participation_url: presentationUrl, prizes: [{ id: 'gift', title: 'Bình giữ nhiệt', quantity_total: 100, quantity_awarded: 0 }],
    winners: [], winner_total: 0, page: 1, page_size: 6,
  } }
  if (route === '/auth/login') return { data: { access_token: 'fixture-only', csrf_token: 'fixture-only', session_expires_at: Math.floor(Date.now() / 1000) + 3600, user: access.user } }
  if (route === '/auth/me') return { data: access }
  if (route === '/stores') return { data: [store], meta: { total: 1 } }
  if (route === '/products') {
    const params = new URL(url).searchParams
    assert.equal(params.get('status'), 'active')
    const search = params.get('search')?.toLowerCase() || ''
    const page = Number(params.get('page') || 1), pageSize = Number(params.get('page_size') || 20)
    const matches = products.filter(product => product.status === 'active' && `${product.name} ${product.sku}`.toLowerCase().includes(search))
    productPages.push({ page, search })
    return { data: matches.slice((page - 1) * pageSize, page * pageSize), meta: { total: matches.length, page, page_size: pageSize } }
  }
  if (route === '/zalo/mini-apps') return { data: [{ id: 'app-a', ...store, store_id: store.id, status: 'active', mini_games: [{ id: 'game-a', key: 'golden_egg', name: 'Đập trứng tại quầy', status: 'active' }], mini_game_rewards: [{ game_id: 'game-a', voucher_id: 'gift-a', win_percentage: 100, quantity_total: 10, quantity_awarded: 0 }] }] }
  if (route === '/purchase-games/vouchers/check') {
    const kind = body.code === 'GIAM1' ? 'percentage' : 'gift'
    const used = redeemedVouchers.has(body.code)
    return { data: { id: body.code, title: kind === 'gift' ? 'Bình giữ nhiệt' : 'Giảm 10%', code: body.code, customer_name: 'Khách thử nghiệm', phone_masked: '8491*****678', discount_type: kind, discount_value: kind === 'gift' ? '0' : '10', minimum_order_amount: '200000', maximum_discount_amount: '30000', valid_until: '2026-10-19T07:00:00Z', status: used ? 'redeemed' : 'claimed', eligible: !used, redeemable: !used, reason: used ? 'Phiếu đã sử dụng' : '', purchase_amount: String(body.purchase_amount), discount_amount: kind === 'gift' ? '0' : String(Math.min(body.purchase_amount * .1, 30000)) } }
  }
  if (route.startsWith('/purchase-games/vouchers/claims/') && method === 'POST') {
    const id = route.split('/')[4]
    redeemedVouchers.add(id)
    return { data: { id, status: 'redeemed', already_redeemed: false } }
  }
  if (route === '/purchase-games/policy') return { data: policy }
  if (route === '/vouchers/mini-game-presentation-link') return { data: { token: 'fixture-game-a' } }
  if (route === '/purchase-games/invitations' && method === 'GET') return { data: invitations }
  if (route === '/purchase-games/invitations' && method === 'POST') {
    requestKeys.push(body.request_key)
    if (receipts.has(body.request_key)) return { data: receipts.get(body.request_key) }
    const total = body.items.reduce((sum, row) => sum + Number(products.find(p => p.id === row.product_id).price) * row.quantity, 0)
    const item = { id: `invite-${++issued}`, game_id: body.game_id, phone_masked: '8491*****678', game_name: 'Đập trứng tại quầy', total_amount: String(total), credits: total >= policy.amount_per_play ? policy.credits : 0, remaining: total >= policy.amount_per_play ? policy.credits : 0, amount_per_play: policy.amount_per_play, expires_at: '2026-10-17T07:00:00Z', participation_url: 'https://zalo.me/s/fixture/?purchase_invitation_id=fixture-private', items: body.items }
    receipts.set(body.request_key, item)
    presentationUrl = item.participation_url
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
  assert.equal(await panel.eval("!!document.querySelector('.desktop-login')"), true)
  assert.equal(await panel.eval("document.querySelector('.login-card').innerText.includes('Cổng vận hành') || document.querySelector('.login-card').innerText.includes('Chào mừng trở lại') || document.querySelector('.login-card').innerText.includes('Đăng nhập bằng số điện thoại được cấp') || document.querySelector('.login-card').innerText.includes('Liên hệ quản trị viên')"), false)
  assert.equal(await panel.eval("getComputedStyle(document.querySelector('.desktop-login')).zoom"), '0.68')
  assert.equal(await panel.eval('document.documentElement.scrollHeight > window.innerHeight || document.documentElement.scrollWidth > window.innerWidth'), false)
  const loginShot = await panel.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(output, 'counter-login.png'), Buffer.from(loginShot.data, 'base64'))
  await panel.call('Page.navigate', { url: 'http://127.0.0.1:5192/login' })
  await until(() => panel.eval("!!document.querySelector('.login-card h2')"))
  assert.equal(await panel.eval("!!document.querySelector('.desktop-login')"), false)
  assert.equal(await panel.eval("!!document.querySelector('.login-help')"), true)
  await panel.call('Page.navigate', { url: 'http://127.0.0.1:5192/desktop-assistant' })
  await until(() => panel.eval("!!document.querySelector('.desktop-login input[type=password]')"))
  const set = async (selector, value) => panel.eval(`(() => {const el=document.querySelector(${JSON.stringify(selector)});el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await set('input[inputmode=tel]', '0912345678'); await set('input[type=password]', 'fixture-password')
  await panel.eval("document.querySelector('form').requestSubmit()")
  await until(() => panel.eval("document.querySelector('.counter-form select')?.value === 'game-a'"))
  assert.equal(await panel.eval('location.pathname'), '/desktop-assistant')
  assert.equal(await panel.eval("!!document.querySelector('.counter-header') || !!document.querySelector('.counter-store') || !!document.querySelector('.counter-heading')"), false)
  assert.equal(await panel.eval("!!document.querySelector('.counter-product-options')"), false)
  assert.equal(productPages.length, 0)
  await set('#counter-product-search', 'Sản phẩm')
  await until(() => panel.eval("document.querySelectorAll('.counter-product-options button:not(.counter-load-more)').length === 20"))
  await panel.eval("document.querySelector('.counter-load-more').click()")
  await until(() => panel.eval("document.querySelectorAll('.counter-product-options button:not(.counter-load-more)').length === 40"))
  await panel.eval("document.querySelector('.counter-load-more').click()")
  await until(() => panel.eval("document.querySelectorAll('.counter-product-options button:not(.counter-load-more)').length === 54"))
  await set('#counter-product-search', 'SKU54')
  await until(() => panel.eval("document.querySelectorAll('.counter-product-options button').length === 1 && document.querySelector('.counter-product-options').innerText.includes('Sản phẩm 54')"))
  await set('#counter-product-search', 'Không tồn tại')
  await until(() => panel.eval("document.querySelector('.counter-product-options').innerText.includes('Không có sản phẩm phù hợp')"))
  await set('#counter-product-search', '')
  await until(() => panel.eval("!document.querySelector('.counter-product-options')"))
  await set('.counter-form input[type=tel]', '0912345678')
  await set('#counter-product-search', 'MILK')
  await until(() => panel.eval("document.querySelector('.counter-product-options')?.innerText.includes('Hộp sữa')"))
  await panel.eval("document.querySelector('.counter-product-options button').click()")
  await until(() => panel.eval("!!document.querySelector('.counter-line input')"))
  assert.equal(await panel.eval("document.querySelector('.counter-submit').disabled"), true)
  await set('.counter-line input', '3')
  await until(() => panel.eval("document.querySelector('.counter-total').innerText.includes('2 lượt')"))
  await set('.counter-line input', '6')
  await until(() => panel.eval("document.querySelector('.counter-total').innerText.includes('2 lượt')"))
  await panel.call('Emulation.setDeviceMetricsOverride', { width: 408, height: 482, deviceScaleFactor: 1, mobile: false })
  await panel.eval('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  assert.equal(await panel.eval("getComputedStyle(document.querySelector('.counter-app')).zoom"), '0.68')
  assert.equal(await panel.eval("document.querySelectorAll('.counter-game-row select').length === 1 && !document.querySelector('.counter-game-row input')"), true)
  assert.equal(await panel.eval('document.documentElement.scrollWidth > window.innerWidth'), false)
  for (const sku of ['SKU1', 'SKU2']) {
    await set('#counter-product-search', sku)
    await until(() => panel.eval("!!document.querySelector('.counter-product-options button')"))
    await panel.eval("document.querySelector('.counter-product-options button').click()")
  }
  await until(() => panel.eval("document.querySelectorAll('.counter-line').length === 3"))
  assert.equal(await panel.eval('document.documentElement.scrollHeight > window.innerHeight'), false, 'Three products must scroll inside the list')
  await panel.eval("document.querySelectorAll('.counter-line')[2].querySelector('button').click();document.querySelectorAll('.counter-line')[1].querySelector('button').click()")
  await until(() => panel.eval("document.querySelectorAll('.counter-line').length === 1"))
  const before = await panel.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(output, 'counter-form.png'), Buffer.from(before.data, 'base64'))
  await panel.call('Emulation.clearDeviceMetricsOverride')
  await panel.eval('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
  const nativeForm = await panel.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(output, 'counter-native-form.png'), Buffer.from(nativeForm.data, 'base64'))
  await panel.eval("document.querySelector('.counter-form').requestSubmit()")
  await until(() => panel.eval("document.querySelector('.counter-submit')?.innerText.includes('Thử lại')"))
  await panel.eval("document.querySelector('.counter-form').requestSubmit()")
  await until(() => panel.eval("!!document.querySelector('.counter-toast')"))
  await until(() => panel.eval("document.querySelector('.counter-presentation-link a')?.search === '?token=fixture-game-a'"))
  assert.equal(issued, 1)
  assert.equal(requestKeys.length, 2)
  assert.equal(new Set(requestKeys).size, 1)
  assert.equal(invitations[0].credits, 2)
  assert.equal(await panel.eval("typeof window.require"), 'undefined')
  assert.equal(await panel.eval("typeof window.counterBubble"), 'undefined')
  const result = await panel.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(path.join(output, 'counter-result.png'), Buffer.from(result.data, 'base64'))
  assert.equal(await bubble.eval('getComputedStyle(document.body).width'), '66px')
  assert.ok(await bubble.eval('window.innerWidth >= 66 && window.innerWidth <= 68'), 'Windows display scaling may round the native viewport by two pixels')
  assert.equal(await panel.eval("document.querySelector('.counter-form input[type=tel]').value"), '')
  assert.equal(await panel.eval("document.querySelector('.counter-form select').value"), 'game-a')
  assert.equal(await panel.eval("document.querySelectorAll('.counter-line').length"), 0)
  assert.equal(await panel.eval("!!document.querySelector('.counter-result')"), false)
  await until(() => panel.eval("!document.querySelector('.counter-toast')"))
  await panel.eval("document.querySelectorAll('.counter-tabs button')[1].click()")
  assert.equal(await panel.eval("!!document.querySelector('.counter-voucher-form input[type=tel]')"), false)
  for (const code of ['GIFT1', 'GIAM1']) {
    await set('.counter-voucher-form input[maxlength]', code)
    await panel.eval("document.querySelector('.counter-voucher-lookup').requestSubmit()")
    await until(() => panel.eval("!!document.querySelector('.counter-voucher-review .primary-button')"))
    if (code === 'GIAM1') await set('#counter-voucher-amount', '300000')
    const voucherShot = await panel.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await writeFile(path.join(output, `counter-voucher-${code}.png`), Buffer.from(voucherShot.data, 'base64'))
    await panel.eval("document.querySelector('.counter-voucher-review .primary-button').click()")
    await until(() => panel.eval("!!document.querySelector('.counter-toast') && !document.querySelector('.counter-voucher-review')"))
    await panel.eval("document.querySelector('[aria-label=\"Đóng thông báo\"]').click()")
    assert.equal(await panel.eval("!!document.querySelector('.counter-toast')"), false)
    await set('.counter-voucher-form input[maxlength]', code)
    await panel.eval("document.querySelector('.counter-voucher-lookup').requestSubmit()")
    await until(() => panel.eval("document.querySelector('.counter-voucher-review')?.innerText.includes('Phiếu đã sử dụng')"))
    assert.equal(await panel.eval("!!document.querySelector('.counter-voucher-review .primary-button')"), false)
  }
  assert.equal(redeemedVouchers.size, 2)
  await panel.call('Page.navigate', { url: 'http://127.0.0.1:5192/mini-game-presentation?token=fixture' })
  await until(() => panel.eval("!!document.querySelector('.mg-display-qr img')"))
  const qr1 = await panel.eval("document.querySelector('.mg-display-qr img').src")
  presentationUrl = null // Simulate verified customer acknowledging the invitation.
  await until(() => panel.eval("!document.querySelector('.mg-display-qr img') && document.body.innerText.includes('Chờ cửa hàng cấp QR cá nhân tiếp theo')"))
  presentationUrl = invitations[0].participation_url + '&next=2'
  await until(() => panel.eval("!!document.querySelector('.mg-display-qr img')"))
  assert.notEqual(await panel.eval("document.querySelector('.mg-display-qr img').src"), qr1)

  await writeFile(path.join(output, 'smoke-report.json'), JSON.stringify({ version, simplifiedDesktopLogin: true, desktopFormsScale: 0.68, loginRedirect: true, nativeBubbleToggle: true, bubbleSize: 66, successToastAutoDismiss: true, successToastManualDismiss: true, voucherGiftAndDiscount: true, voucherDoubleUseBlocked: true, privateBridgeUnavailableToCRM: true, lostResponseRetryUsesSameReceipt: true, quantity: 6, total: invitations[0].total_amount, credits: 2, all55ProductsAccessible: true, skuSearch: true, compactFormFits482px: true, fixedCredits: true, presentationLink: true, productsSearchOnly: true, noHorizontalOverflow: true, productPages, apiRequests }, null, 2))
  console.log('Native popup, 55 paginated products, SKU search, compact form, 3-second toast, voucher redemption and renderer isolation passed.')
} finally { bubble?.ws.close(); panel?.ws.close(); child.kill() }
