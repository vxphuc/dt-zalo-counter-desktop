document.getElementById('open').addEventListener('click', () => window.counterBubble.toggle())
document.addEventListener('contextmenu', event => { event.preventDefault(); window.counterBubble.menu() })
