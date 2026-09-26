document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return
  const toggle = event.target.closest('.side-toggle')
  if (!toggle) return
  const side = toggle.closest('.side')
  if (!side) return
  const compact = side.classList.toggle('is-compact')
  const label = compact ? 'メニューを展開する' : 'メニューをコンパクトにする'
  toggle.setAttribute('aria-label', label)
  toggle.setAttribute('title', label)
  toggle.setAttribute('aria-expanded', String(!compact))
})
