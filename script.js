// ─── WALLPAPER DATA ───────────────────────────────────────────────
const wallpapers = [
  {
    id: 1,
    name: 'Silver Surfer',
    category: 'Space',
    author: 'SleepyGinga',
    resolution: '1920×1080',
    size: '9 Mb',
    duration: '1m 11s',
    likes: 261,
    type: 'live',
    gradient: `
      radial-gradient(ellipse at 68% 38%, rgba(130, 60, 255, 0.45) 0%, transparent 60%),
      radial-gradient(ellipse at 30% 70%, rgba(40, 10, 120, 0.4) 0%, transparent 50%),
      linear-gradient(135deg, #04040e 0%, #0b0924 38%, #170d42 68%, #2a0e5e 100%)
    `
  },
  {
    id: 2,
    name: 'Desert Highway GT',
    category: 'Cars',
    author: 'NightRider',
    resolution: '2560×1440',
    size: '14 Mb',
    duration: '2m 4s',
    likes: 194,
    type: 'live',
    gradient: `
      radial-gradient(ellipse at 60% 45%, rgba(255, 110, 20, 0.5) 0%, transparent 55%),
      radial-gradient(ellipse at 80% 80%, rgba(180, 50, 0, 0.35) 0%, transparent 45%),
      linear-gradient(135deg, #120500 0%, #2e0e00 38%, #5c2000 68%, #8c3400 100%)
    `
  },
  {
    id: 3,
    name: 'Alpine Sunrise Valley',
    category: 'Nature',
    author: 'FrostPeak',
    resolution: '3840×2160',
    size: '22 Mb',
    duration: null,
    likes: 432,
    type: 'still',
    gradient: `
      radial-gradient(ellipse at 55% 30%, rgba(255, 180, 80, 0.35) 0%, transparent 55%),
      radial-gradient(ellipse at 25% 65%, rgba(20, 120, 60, 0.4) 0%, transparent 50%),
      linear-gradient(135deg, #021008 0%, #053a1c 38%, #086832 68%, #0c8840 100%)
    `
  },
  {
    id: 4,
    name: 'Crystal Gradient Layers',
    category: 'Abstract',
    author: 'Prism',
    resolution: '1920×1080',
    size: '6 Mb',
    duration: null,
    likes: 317,
    type: 'still',
    gradient: `
      radial-gradient(ellipse at 50% 40%, rgba(190, 80, 255, 0.5) 0%, transparent 55%),
      radial-gradient(ellipse at 75% 70%, rgba(80, 10, 200, 0.4) 0%, transparent 45%),
      linear-gradient(135deg, #06060e 0%, #0e0720 38%, #180c38 68%, #240850 100%)
    `
  },
  {
    id: 5,
    name: 'Arctic Wolf in Snowstorm',
    category: 'Animals',
    author: 'WildLens',
    resolution: '2560×1440',
    size: '18 Mb',
    duration: null,
    likes: 528,
    type: 'still',
    gradient: `
      radial-gradient(ellipse at 60% 35%, rgba(140, 200, 240, 0.35) 0%, transparent 55%),
      radial-gradient(ellipse at 35% 70%, rgba(60, 110, 160, 0.3) 0%, transparent 50%),
      linear-gradient(135deg, #050c12 0%, #0c1e2e 38%, #183045 68%, #204868 100%)
    `
  },
  {
    id: 6,
    name: 'Bioluminescent Night Shore',
    category: 'Beach',
    author: 'TidalDrift',
    resolution: '3840×2160',
    size: '25 Mb',
    duration: '1m 45s',
    likes: 389,
    type: 'live',
    gradient: `
      radial-gradient(ellipse at 45% 55%, rgba(0, 220, 240, 0.4) 0%, transparent 55%),
      radial-gradient(ellipse at 70% 30%, rgba(0, 100, 180, 0.3) 0%, transparent 50%),
      linear-gradient(135deg, #010810 0%, #012236 38%, #023452 68%, #035878 100%)
    `
  },
  {
    id: 7,
    name: 'Frosted Blur Waves',
    category: 'Minimal',
    author: 'GreyScale',
    resolution: '1920×1080',
    size: '4 Mb',
    duration: null,
    likes: 145,
    type: 'still',
    gradient: `
      radial-gradient(ellipse at 55% 40%, rgba(210, 210, 210, 0.14) 0%, transparent 60%),
      radial-gradient(ellipse at 75% 75%, rgba(160, 160, 160, 0.10) 0%, transparent 50%),
      linear-gradient(135deg, #0c0c0c 0%, #181818 38%, #222222 68%, #2c2c2c 100%)
    `
  },
  {
    id: 8,
    name: 'Earth Night Orbit',
    category: 'Space',
    author: 'CosmicView',
    resolution: '3840×2160',
    size: '31 Mb',
    duration: '3m 20s',
    likes: 612,
    type: 'live',
    gradient: `
      radial-gradient(ellipse at 55% 48%, rgba(30, 90, 210, 0.55) 0%, transparent 58%),
      radial-gradient(ellipse at 80% 25%, rgba(10, 180, 255, 0.25) 0%, transparent 40%),
      linear-gradient(135deg, #020408 0%, #040c18 38%, #071524 68%, #091e36 100%)
    `
  }
];

// ─── HERO CAROUSEL ────────────────────────────────────────────────
let currentHero = 0;
let heroTimer = null;

const heroBg    = document.getElementById('heroBg');
const heroCat   = document.getElementById('heroCat');
const heroTitle = document.getElementById('heroTitle');
const heroMeta  = document.getElementById('heroMeta');
const heroLikes = document.getElementById('heroLikes');
const heroDotsEl = document.getElementById('heroDots');

function buildDots() {
  heroDotsEl.innerHTML = '';
  wallpapers.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'hero-dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', `Go to wallpaper ${i + 1}`);
    btn.addEventListener('click', () => goToHero(i));
    heroDotsEl.appendChild(btn);
  });
}

function showHero(index) {
  const w = wallpapers[index];

  heroBg.style.background = w.gradient;
  heroCat.textContent = w.category.toUpperCase();
  heroTitle.textContent = w.name;

  const meta = [w.resolution, w.author, w.size];
  if (w.duration) meta.push(w.duration);
  heroMeta.textContent = meta.join(' · ');
  heroLikes.textContent = w.likes;

  heroDotsEl.querySelectorAll('.hero-dot').forEach((d, i) =>
    d.classList.toggle('active', i === index)
  );
}

function goToHero(index) {
  currentHero = ((index % wallpapers.length) + wallpapers.length) % wallpapers.length;
  showHero(currentHero);
  resetTimer();
}

function resetTimer() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => goToHero(currentHero + 1), 11000);
}

document.getElementById('heroPrev').addEventListener('click', () => goToHero(currentHero - 1));
document.getElementById('heroNext').addEventListener('click', () => goToHero(currentHero + 1));

// ─── SHELVES ──────────────────────────────────────────────────────
function renderShelf(containerId, list) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  list.forEach(w => {
    const card = document.createElement('div');
    card.className = 'shelf-card';
    const bg = document.createElement('div');
    bg.className = 'shelf-card-bg';
    bg.style.background = w.gradient;
    card.appendChild(bg);
    container.appendChild(card);
  });
}

const byLikes  = [...wallpapers].sort((a, b) => b.likes - a.likes);
const byRecent = [...wallpapers].sort((a, b) => b.id - a.id);

renderShelf('shelf-recommended', byLikes);
renderShelf('shelf-recent', byRecent);

// ─── NAV TABS ─────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const pageId = 'page-' + tab.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    tab.classList.add('active');
  });
});

// ─── INIT ─────────────────────────────────────────────────────────
buildDots();
showHero(0);
resetTimer();
