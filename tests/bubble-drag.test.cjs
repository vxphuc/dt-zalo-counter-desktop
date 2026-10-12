const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const { bubblePosition } = require('../window-policy.cjs')

function bubbleFixture() {
  const handlers = {}, calls = []
  const handle = { addEventListener: (name, handler) => { handlers[name] = handler }, setPointerCapture: () => {}, classList: { add() {}, remove() {} } }
  vm.runInNewContext(fs.readFileSync(require.resolve('../bubble.js'), 'utf8'), {
    document: { querySelector: () => handle, addEventListener() {} },
    window: { counterBubble: Object.fromEntries(['toggle', 'menu', 'startDrag', 'moveDrag', 'endDrag'].map(name => [name, () => calls.push(name)])) },
  })
  return { calls, fire: (name, event = {}) => handlers[name]({ button: 0, pointerId: 1, screenX: 100, screenY: 100, detail: 1, ...event }) }
}

test('click and tiny pointer movement open popup; dragging from center suppresses click', () => {
  const { fire, calls } = bubbleFixture()
  fire('pointerdown'); fire('pointermove', { screenY: 102 }); fire('pointerup'); fire('click')
  assert.deepEqual(calls, ['startDrag', 'endDrag', 'toggle'])
  calls.length = 0
  fire('pointerdown'); fire('pointermove', { screenY: 190 }); fire('pointerup'); fire('click')
  assert.deepEqual(calls, ['startDrag', 'moveDrag', 'endDrag'])
  fire('click', { detail: 0 })
  assert.equal(calls.at(-1), 'toggle')
})

test('right clicks never start drag and canceled or lost pointers end the drag', () => {
  const { fire, calls } = bubbleFixture()
  fire('pointerdown', { button: 2 })
  assert.deepEqual(calls, [])
  fire('pointerdown'); fire('pointermove', { pointerId: 2, screenY: 190 }); fire('pointercancel'); fire('lostpointercapture')
  assert.deepEqual(calls, ['startDrag', 'endDrag'])
})

test('bubble stays visible on negative-coordinate and small monitor work areas', () => {
  for (const area of [{ x: -1280, y: -720, width: 1280, height: 720 }, { x: 0, y: 30, width: 800, height: 570 }]) {
    for (const point of [{ x: -10000, y: -10000 }, { x: 10000, y: 10000 }]) {
      const position = bubblePosition(point, area)
      assert.ok(position.x >= area.x && position.x + 78 <= area.x + area.width)
      assert.ok(position.y >= area.y && position.y + 78 <= area.y + area.height)
    }
  }
})
