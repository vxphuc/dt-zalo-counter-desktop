const handle = document.querySelector('.bubble-drag')
let pointer = null
let suppressClick = false
handle.addEventListener('pointerdown', event => {
  if (event.button !== 0 || pointer) return
  suppressClick = false
  pointer = { id: event.pointerId, x: event.screenX, y: event.screenY, moved: false }
  handle.setPointerCapture(event.pointerId)
  window.counterBubble.startDrag()
})
handle.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id) return
  if (Math.hypot(event.screenX - pointer.x, event.screenY - pointer.y) >= 5) pointer.moved = true
  if (pointer.moved) {
    handle.classList.add('dragging')
    window.counterBubble.moveDrag()
  }
})
function endDrag(event) {
  if (!pointer || event.pointerId !== pointer.id) return
  suppressClick = pointer.moved
  pointer = null
  handle.classList.remove('dragging')
  window.counterBubble.endDrag()
}
handle.addEventListener('pointerup', endDrag)
handle.addEventListener('pointercancel', endDrag)
handle.addEventListener('lostpointercapture', endDrag)
handle.addEventListener('click', event => {
  if (suppressClick && event.detail !== 0) { suppressClick = false; return }
  window.counterBubble.toggle()
})
document.addEventListener('contextmenu', event => { event.preventDefault(); window.counterBubble.menu() })
