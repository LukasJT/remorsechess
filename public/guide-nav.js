const menu = document.querySelector('#site-menu')
const nav = document.querySelector('#site-nav')
if (menu && nav) {
  const setOpen = open => {
    menu.setAttribute('aria-expanded', String(open))
    document.body.classList.toggle('site-menu-open', open)
  }
  menu.addEventListener('click', () => setOpen(menu.getAttribute('aria-expanded') !== 'true'))
  nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false) })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      setOpen(false)
      menu.focus()
    }
  })
}
