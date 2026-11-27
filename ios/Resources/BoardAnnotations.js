(() => {
  // The website and the embedded browser can both load this script.
  if (document.querySelector('#remorse-board-annotations')) return
  const style = document.createElement('style')
  style.id = 'remorse-board-annotations'
  style.textContent = `
    .rc-annotation-board { position: relative; }
    .rc-annotation-layer { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 8; pointer-events: none; }
    .rc-annotation-drawing { touch-action: none; cursor: crosshair; }
    .rc-annotation-controls { display: flex; flex-wrap: wrap; gap: .45rem; margin: .55rem 0; }
    .rc-annotation-controls > button { min-height: 44px; }
  `
  document.head.append(style)

  const boardSelector = '.board:has(button[data-square]), .puzzle-board:has(button[data-square]), .study-board:has(button[data-square])'
  const palette = { red: '#ed536d', yellow: '#ffca55', blue: '#51afe8', green: '#60ca88' }
  const marks = new Map()
  let board
  let layer
  let toolbar
  let drawButton
  let clearButton
  let drawing = false
  let gesture
  let positionKey
  let routeKey

  function svg(tag, attributes) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value)
    return node
  }

  function color(keys, arrow) {
    if (keys.shiftKey) return palette.green
    if (keys.altKey) return palette.blue
    if (keys.ctrlKey) return arrow ? palette.red : palette.yellow
    return arrow ? palette.yellow : palette.red
  }

  function render() {
    if (!layer) return
    const coordinates = new Map(Array.from(board.querySelectorAll('button[data-square]'), (cell, index) =>
      [cell.dataset.square, { x: index % 8 + .5, y: Math.floor(index / 8) + .5 }]
    ))
    const nodes = []
    for (const { from, to, fill } of marks.values()) {
      const start = coordinates.get(from)
      const end = coordinates.get(to)
      if (!start || !end) continue
      if (from === to) {
        nodes.unshift(svg('rect', {x: start.x - .5, y: start.y - .5, width: 1, height: 1, fill, opacity: .42}))
        continue
      }

      const dx = end.x - start.x
      const dy = end.y - start.y
      const knight = Math.abs(dx * dy) === 2 && Math.abs(dx) + Math.abs(dy) === 3
      const bend = knight ? (Math.abs(dx) === 2 ? {x: end.x, y: start.y} : {x: start.x, y: end.y}) : start
      const length = Math.hypot(end.x - bend.x, end.y - bend.y)
      const ux = (end.x - bend.x) / length
      const uy = (end.y - bend.y) / length
      const tip = {x: end.x + ux * .18, y: end.y + uy * .18}
      const base = {x: tip.x - ux * .46, y: tip.y - uy * .46}
      const shaft = knight ? ` L ${bend.x} ${bend.y}` : ''
      const group = svg('g', {opacity: .83})
      group.append(
        svg('path', {
          d: `M ${start.x} ${start.y}${shaft} L ${base.x} ${base.y}`,
          fill: 'none', stroke: fill, 'stroke-width': .19, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        }),
        svg('polygon', {
          points: `${tip.x},${tip.y} ${base.x - uy * .26},${base.y + ux * .26} ${base.x + uy * .26},${base.y - ux * .26}`,
          fill,
        }),
      )
      nodes.push(group)
    }
    layer.replaceChildren(...nodes)
    clearButton.disabled = marks.size === 0
    drawButton.setAttribute('aria-pressed', String(drawing))
    board.classList.toggle('rc-annotation-drawing', drawing)
  }

  function toggleMark(from, to, keys) {
    const key = `${from}:${to}`
    const fill = color(keys, from !== to)
    if (marks.get(key)?.fill === fill) marks.delete(key)
    else marks.set(key, {from, to, fill})
    render()
  }

  function refreshBoard() {
    if (board?.isConnected) return
    toolbar?.remove()
    gesture = undefined
    const next = document.querySelector(boardSelector)
    if (!next) {
      board = undefined
      return
    }

    const cells = Array.from(next.querySelectorAll('button[data-square]'))
    if (cells.length !== 64) return
    const route = location.pathname + location.search + location.hash
    const key = cells.map(cell => `${cell.dataset.square}:${cell.querySelector('.piece img, img')?.getAttribute('src') ?? cell.getAttribute('aria-label') ?? ''}`).sort().join('|')
    if (positionKey !== key || routeKey !== route) marks.clear()
    if (routeKey !== route) drawing = false
    positionKey = key
    routeKey = route
    board = next
    board.classList.add('rc-annotation-board')
    layer = svg('svg', {viewBox: '0 0 8 8', class: 'rc-annotation-layer', 'aria-hidden': 'true'})
    board.append(layer)

    toolbar = document.createElement('div')
    toolbar.className = 'rc-annotation-controls'
    drawButton = document.createElement('button')
    drawButton.type = 'button'
    drawButton.textContent = 'Draw'
    drawButton.setAttribute('aria-label', 'Draw arrows and highlight squares')
    drawButton.addEventListener('click', () => {
      drawing = !drawing
      render()
    })
    clearButton = document.createElement('button')
    clearButton.type = 'button'
    clearButton.textContent = 'Clear marks'
    clearButton.addEventListener('click', () => {
      marks.clear()
      render()
    })
    toolbar.append(drawButton, clearButton)
    board.after(toolbar)
    render()
  }

  function square(target) {
    const cell = target instanceof Element ? target.closest('button[data-square]') : null
    return cell && board?.contains(cell) ? cell.dataset.square : undefined
  }

  document.addEventListener('pointerdown', event => {
    const from = square(event.target)
    if (from === undefined || gesture || (event.button !== 2 && !(drawing && event.button === 0))) return
    gesture = { id: event.pointerId, from, keys: event }
    event.preventDefault()
  }, true)

  document.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return
    const {from, keys} = gesture
    gesture = undefined
    const to = square(document.elementFromPoint(event.clientX, event.clientY))
    if (to !== undefined) toggleMark(from, to, keys)
    event.preventDefault()
  }, true)

  document.addEventListener('pointercancel', event => {
    if (gesture?.id === event.pointerId) gesture = undefined
  }, true)
  window.addEventListener('blur', () => { gesture = undefined })
  document.addEventListener('contextmenu', event => {
    if (square(event.target) !== undefined) event.preventDefault()
  }, true)
  document.addEventListener('dragstart', event => {
    if (drawing && square(event.target) !== undefined) event.preventDefault()
  }, true)
  document.addEventListener('click', event => {
    const cell = square(event.target)
    if (cell === undefined) return
    if (drawing) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.detail === 0) toggleMark(cell, cell, event)
    } else if (marks.size) {
      marks.clear()
      render()
    }
  }, true)

  new MutationObserver(refreshBoard).observe(document.body, {childList: true, subtree: true})
  refreshBoard()
})()
