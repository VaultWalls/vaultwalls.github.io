// ── DOWNLOAD LINK ────────────────────────────────────────────────────
// Replace this URL with your actual GitHub Release DMG link after building
const MAC_URL = '#'; // e.g. https://github.com/hvneel/VaultWalls/releases/download/v0.1.0/VaultWalls_0.1.0_aarch64.dmg

document.querySelectorAll('#dl-mac, #dl-mac-2').forEach(el => {
  if (el) el.href = MAC_URL;
});

// ── NAV SCROLL BEHAVIOUR ─────────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── ACTIVE NAV LINK ON SCROLL ────────────────────────────────────────
const sections = ['hero', 'features', 'download'];
const navLinks  = document.querySelectorAll('.nav-link[data-section]');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const active = document.querySelector(`.nav-link[data-section="${entry.target.id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { threshold: 0.4 });

sections.forEach(id => {
  const el = document.getElementById(id);
  if (el) observer.observe(el);
});

// ── SUBTLE PARALLAX ON HERO ──────────────────────────────────────────
let raf;
window.addEventListener('mousemove', e => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const x = (e.clientX / window.innerWidth  - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;
    const bg = document.querySelector('.hero-bg');
    if (bg) bg.style.transform = `translate(${x * 0.4}px, ${y * 0.4}px) scale(1.05)`;
  });
}, { passive: true });
