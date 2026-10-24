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
