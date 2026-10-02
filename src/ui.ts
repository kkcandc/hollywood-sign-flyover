export type Ui = {
  root: HTMLElement
  setProgress: (u: number) => void
  setPlaying: (playing: boolean) => void
  setOrbit: (on: boolean) => void
  showTitle: () => void
  hideTitle: () => void
  showChrome: () => void
}

export function createUi(handlers: {
  onTogglePlay: () => void
  onToggleOrbit: () => void
  onSeek: (u: number) => void
}): Ui {
  const root = document.createElement('div')
  root.id = 'chrome'
  root.innerHTML = `
    <div id="title">
      <p class="kicker">Last Light</p>
      <p class="sub">Hollywood Hills</p>
    </div>
    <p id="hint">Drag to look · scroll to move</p>
    <div id="controls">
      <button id="play" type="button" aria-label="Pause">
        <svg id="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
        <svg id="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
      </button>
      <div id="scrub" role="slider" tabindex="0" aria-label="Flight timeline" aria-valuemin="0" aria-valuemax="1000" aria-valuenow="0">
        <div id="scrub-fill"></div>
      </div>
      <button id="orbit" type="button" aria-pressed="false">Orbit</button>
    </div>
  `
  document.body.appendChild(root)

  const play = root.querySelector<HTMLButtonElement>('#play')!
  const orbit = root.querySelector<HTMLButtonElement>('#orbit')!
  const scrub = root.querySelector<HTMLDivElement>('#scrub')!
  const fill = root.querySelector<HTMLDivElement>('#scrub-fill')!

  play.addEventListener('click', handlers.onTogglePlay)
  orbit.addEventListener('click', handlers.onToggleOrbit)

  const seekFromEvent = (clientX: number) => {
    const rect = scrub.getBoundingClientRect()
    const u = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    handlers.onSeek(u)
  }
  scrub.addEventListener('pointerdown', (event) => {
    scrub.setPointerCapture(event.pointerId)
    seekFromEvent(event.clientX)
  })
  scrub.addEventListener('pointermove', (event) => {
    if (event.buttons & 1 || event.pointerType === 'touch') {
      if (scrub.hasPointerCapture(event.pointerId)) seekFromEvent(event.clientX)
    }
  })
  scrub.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') handlers.onSeek(Math.min(1, numberNow(scrub) + 0.02))
    if (event.key === 'ArrowLeft') handlers.onSeek(Math.max(0, numberNow(scrub) - 0.02))
  })

  return {
    root,
    setProgress(u) {
      const clamped = Math.min(1, Math.max(0, u))
      fill.style.transform = `scaleX(${clamped})`
      scrub.setAttribute('aria-valuenow', String(Math.round(clamped * 1000)))
    },
    setPlaying(playing) {
      root.classList.toggle('is-paused', !playing)
      play.setAttribute('aria-label', playing ? 'Pause' : 'Play')
    },
    setOrbit(on) {
      root.classList.toggle('is-orbit', on)
      orbit.setAttribute('aria-pressed', on ? 'true' : 'false')
      orbit.textContent = on ? 'Flying' : 'Orbit'
    },
    showTitle() {
      root.classList.add('show-title')
    },
    hideTitle() {
      root.classList.remove('show-title')
    },
    showChrome() {
      root.classList.add('show-chrome')
    },
  }
}

function numberNow(scrub: HTMLElement) {
  return Number(scrub.getAttribute('aria-valuenow') ?? 0) / 1000
}
