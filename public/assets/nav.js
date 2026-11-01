// Industries menu: opens on hover with a mouse, on tap with a finger. One file for every page.
document.querySelectorAll('.imenu').forEach(li => {
  const btn = li.querySelector('.imenu-btn'), hoverable = matchMedia('(hover: hover) and (min-width: 981px)');
  let t, hovered = false;
  const set = open => { li.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); };
  li.addEventListener('mouseenter', () => { if (!hoverable.matches) return; clearTimeout(t); hovered = true; set(true); });
  li.addEventListener('mouseleave', () => { if (!hoverable.matches) return; hovered = false; t = setTimeout(() => set(false), 200); });
  btn.addEventListener('click', () => set(hovered ? true : !li.classList.contains('open')));
  document.addEventListener('click', e => { if (!li.contains(e.target)) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && li.classList.contains('open')) { set(false); btn.focus(); } });
});

// Reviews carousel: swipe with a thumb, arrows on desktop, dots show where you are.
document.querySelectorAll('.rcar').forEach(car => {
  const track = car.querySelector('.rcar-track'), cards = [...track.children], dots = car.querySelector('.rcar-dots');
  const step = () => cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
  const stops = () => Math.max(1, Math.round((track.scrollWidth - track.clientWidth) / step()) + 1);
  const sync = () => { const k = Math.min(Math.round(track.scrollLeft / step()), stops() - 1); [...dots.children].forEach((d, n) => d.classList.toggle('on', n === k)); };
  const build = () => { dots.textContent = ''; for (let n = 0; n < stops(); n++) dots.append(document.createElement('i')); sync(); };
  track.addEventListener('scroll', () => requestAnimationFrame(sync), {passive: true});
  addEventListener('resize', build);
  car.querySelectorAll('.rcar-btn').forEach(b => b.addEventListener('click', () => track.scrollBy({left: step() * +b.dataset.dir, behavior: 'smooth'})));
  build();
});
