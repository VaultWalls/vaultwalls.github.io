// ─── PERSISTENT STATE ────────────────────────────────────────────
// Likes: seeded per-browser; for global community likes wire Firebase
// (see readme / generate-wallpapers.js comments for instructions)
const likedIds      = new Set(JSON.parse(localStorage.getItem('vw_liked')      || '[]'));
const downloadedIds = new Set(JSON.parse(localStorage.getItem('vw_downloaded') || '[]'));
let   viewHistory   =          JSON.parse(localStorage.getItem('vw_history')   || '[]'); // array of IDs, newest first
let   likeCounts    =          JSON.parse(localStorage.getItem('vw_counts')    || '{}');

function saveLiked()      { localStorage.setItem('vw_liked',      JSON.stringify([...likedIds])); }
function saveDownloaded() { localStorage.setItem('vw_downloaded', JSON.stringify([...downloadedIds])); }
function saveHistory()    { localStorage.setItem('vw_history',    JSON.stringify(viewHistory)); }
function saveCounts()     { localStorage.setItem('vw_counts',     JSON.stringify(likeCounts)); }

function getLikes(w) { return likeCounts[w.id] ?? 0; }

function adjustLike(id, delta) {
  likeCounts[id] = Math.max(0, (likeCounts[id] ?? 0) + delta);
  saveCounts();
}

function initLikeCounts() {
  wallpapers.forEach(w => { if (likeCounts[w.id] == null) likeCounts[w.id] = Math.floor(Math.random() * 180) + 8; });
  saveCounts();
}

function addToHistory(id) {
  viewHistory = viewHistory.filter(x => x !== id);
  viewHistory.unshift(id);
  if (viewHistory.length > 200) viewHistory.pop();
  saveHistory();
}

function addToDownloaded(id) {
  downloadedIds.add(id);
  saveDownloaded();
}

// ─── CORE DATA ────────────────────────────────────────────────────
let wallpapers = [];

// ─── HELPERS ──────────────────────────────────────────────────────
const CAT_GRADIENTS = {
  Space:    'radial-gradient(ellipse at 68% 38%, rgba(130,60,255,0.45) 0%, transparent 60%), linear-gradient(135deg,#04040e,#170d42)',
  Abstract: 'radial-gradient(ellipse at 50% 40%, rgba(190,80,255,0.5) 0%, transparent 55%), linear-gradient(135deg,#06060e,#240850)',
  Animals:  'radial-gradient(ellipse at 60% 35%, rgba(140,200,240,0.35) 0%, transparent 55%), linear-gradient(135deg,#050c12,#204868)',
  Beach:    'radial-gradient(ellipse at 45% 55%, rgba(0,220,240,0.4) 0%, transparent 55%), linear-gradient(135deg,#010810,#035878)',
  Cars:     'radial-gradient(ellipse at 60% 45%, rgba(255,110,20,0.5) 0%, transparent 55%), linear-gradient(135deg,#120500,#8c3400)',
  Minimal:  'radial-gradient(ellipse at 55% 40%, rgba(210,210,210,0.14) 0%, transparent 60%), linear-gradient(135deg,#0c0c0c,#2c2c2c)',
  Nature:   'radial-gradient(ellipse at 55% 30%, rgba(255,180,80,0.35) 0%, transparent 55%), linear-gradient(135deg,#021008,#0c8840)',
};

function catGradient(cat) { return CAT_GRADIENTS[cat] || 'linear-gradient(135deg,#111,#222)'; }

function srcToUrl(src) {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return src.split('/').map(encodeURIComponent).join('/');
}

function getFilename(w) {
  try {
    const parts = w.src.split('/');
    return decodeURIComponent(parts[parts.length - 1]);
  } catch { return w.name; }
}

function cardBgStyle(w) {
  if (w.type === 'still')
    return `background-image:url('${srcToUrl(w.src)}');background-size:cover;background-position:center`;
  return `background:${catGradient(w.category)}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showToast(msg, duration = 3500) {
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => { requestAnimationFrame(() => t.classList.add('toast-show')); });
  setTimeout(() => {
    t.classList.remove('toast-show');
    setTimeout(() => t.remove(), 350);
  }, duration);
}

// ─── LIVE VIDEO IN CARDS (always-on, lazy via IntersectionObserver) ──
const liveObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const vid = entry.target._liveVid;
    if (!vid) return;
    entry.isIntersecting ? vid.play().catch(() => {}) : vid.pause();
  });
}, { threshold: 0.1 });

function attachLiveVideo(w, containerEl) {
  const vid       = document.createElement('video');
  vid.src         = srcToUrl(w.src);
  vid.loop        = true;
  vid.muted       = true;
  vid.playsInline = true;
  vid.className   = 'card-live-video';
  vid.preload     = 'auto';
  containerEl.appendChild(vid);
  containerEl._liveVid = vid;
  liveObserver.observe(containerEl);
}

// ─── DOWNLOAD & SET WALLPAPER ─────────────────────────────────────
async function doDownload(w, setMode = false) {
  const url      = srcToUrl(w.src);
  const filename = getFilename(w);
  const tauri    = window.__TAURI__;

  // ── Tauri native path (Rust handles fetch + save + wallpaper) ──
  if (tauri) {
    showToast(setMode ? 'Setting wallpaper…' : `Saving "${w.name}"…`);
    try {
      const result = await tauri.core.invoke('save_and_set_wallpaper', {
        url,
        filename,
        setWallpaper: setMode,
      });
      addToDownloaded(w.id);
      refreshMediaPage();
      if (result === 'live_wallpaper_set') {
        showToast('Live wallpaper is now playing on your desktop!');
      } else if (result === 'wallpaper_set') {
        showToast('Wallpaper set! Check your desktop.');
      } else {
        showToast('Saved!');
      }
    } catch (err) {
      console.error('Tauri error:', err);
      showToast('Something went wrong. Check console.');
    }
    return;
  }

  // ── Browser fallback ───────────────────────────────────────────
  try {
    const res  = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    addToDownloaded(w.id);
    if (setMode) showToast('Downloaded! Right-click → Set as Desktop Picture (Mac) or desktop background (Windows)');
    else         showToast(`Downloading "${w.name}"…`);
    refreshMediaPage();
  } catch {
    window.open(url, '_blank');
    if (setMode) showToast('Opened in new tab — save the image, then right-click to set as wallpaper');
    else         showToast('Opening in new tab to download…');
  }
}

// ─── HERO CAROUSEL ────────────────────────────────────────────────
let heroWallpapers  = [];
let currentHero     = 0;
let heroTimer       = null;
let heroIntervalMs  = parseInt(localStorage.getItem('vw_setting_interval') || '11000');

const heroBg      = document.getElementById('heroBg');
const heroBgVideo = document.getElementById('heroBgVideo');
const heroCat     = document.getElementById('heroCat');
const heroTitle   = document.getElementById('heroTitle');
const heroMeta    = document.getElementById('heroMeta');
const heroDotsEl  = document.getElementById('heroDots');

function buildDots() {
  heroDotsEl.innerHTML = '';
  heroWallpapers.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'hero-dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('aria-label', `Go to wallpaper ${i + 1}`);
    btn.addEventListener('click', () => goToHero(i));
    heroDotsEl.appendChild(btn);
  });
}

function showHero(index) {
  const w = heroWallpapers[index];
  if (w.type === 'live') {
    heroBg.style.display      = 'none';
    heroBgVideo.style.display = 'block';
    if (heroBgVideo.src !== srcToUrl(w.src)) {
      heroBgVideo.src = srcToUrl(w.src);
      heroBgVideo.load();
    }
    heroBgVideo.play().catch(() => {});
  } else {
    heroBgVideo.pause();
    heroBgVideo.src           = '';
    heroBgVideo.style.display = 'none';
    heroBg.style.display      = '';
    heroBg.style.backgroundImage    = `url('${srcToUrl(w.src)}')`;
    heroBg.style.backgroundSize     = 'cover';
    heroBg.style.backgroundPosition = 'center';
  }
  heroCat.textContent   = (w.category || '').toUpperCase();
  heroTitle.textContent = w.name || '';
  const parts = [w.author].filter(Boolean);
  if (w.resolution) parts.push(w.resolution);
  if (w.size)       parts.push(w.size);
  heroMeta.textContent = parts.join(' · ');

  heroDotsEl.querySelectorAll('.hero-dot').forEach((d, i) =>
    d.classList.toggle('active', i === index)
  );
}

function goToHero(index) {
  currentHero = ((index % heroWallpapers.length) + heroWallpapers.length) % heroWallpapers.length;
  showHero(currentHero);
  resetTimer();
}

function resetTimer() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => goToHero(currentHero + 1), heroIntervalMs);
}

document.getElementById('heroPrev').addEventListener('click', () => goToHero(currentHero - 1));
document.getElementById('heroNext').addEventListener('click', () => goToHero(currentHero + 1));
document.querySelector('.btn-primary').addEventListener('click', () => {
  if (heroWallpapers.length) openViewer(heroWallpapers[currentHero]);
});

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
    bg.setAttribute('style', cardBgStyle(w));
    card.appendChild(bg);

    if (w.type === 'live') {
      const badge = document.createElement('span');
      badge.className   = 'live-badge';
      badge.textContent = 'LIVE';
      card.appendChild(badge);
      attachLiveVideo(w, card);
    }

    // Hover-preload: start buffering video before the user clicks
    if (w.type === 'live') {
      card.addEventListener('mouseenter', () => {
        const vs = srcToUrl(w.src);
        if (viewerVideo.src !== vs) { viewerVideo.src = vs; viewerVideo.load(); }
      });
    }
    card.addEventListener('click', () => openViewer(w));
    container.appendChild(card);
  });
}

// ─── NAV TABS ─────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const pageId = 'page-' + tab.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    tab.classList.add('active');
    if (tab.dataset.page === 'media') refreshMediaPage();
  });
});

// ─── EXPLORE PAGE ─────────────────────────────────────────────────
let exploreFilter   = localStorage.getItem('vw_setting_filter') || 'both';
let exploreQuery    = '';
let exploreSort     = 'newest';
let exploreCategory = 'all';

const categoryDefs = [
  { name: 'All',      key: 'all',      gradient: 'linear-gradient(135deg,#1c1c2e,#2e2e48)' },
  { name: 'Abstract', key: 'Abstract', gradient: 'linear-gradient(135deg,#1a0a20,#4a1a8a)' },
  { name: 'Animals',  key: 'Animals',  gradient: 'linear-gradient(135deg,#0a2a0a,#1a5c2a)' },
  { name: 'Beach',    key: 'Beach',    gradient: 'linear-gradient(135deg,#012236,#035878)' },
  { name: 'Cars',     key: 'Cars',     gradient: 'linear-gradient(135deg,#2a1000,#8c3400)' },
  { name: 'Minimal',  key: 'Minimal',  gradient: 'linear-gradient(135deg,#141418,#28283a)' },
  { name: 'Nature',   key: 'Nature',   gradient: 'linear-gradient(135deg,#021008,#0c6830)' },
  { name: 'Space',    key: 'Space',    gradient: 'linear-gradient(135deg,#04040e,#170d42)' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getSortedFiltered() {
  const q = exploreQuery.toLowerCase().trim();
  let list = wallpapers.filter(w => {
    const typeOk  = exploreFilter === 'both' || w.type === exploreFilter;
    const catOk   = exploreCategory === 'all' || w.category === exploreCategory;
    const queryOk = !q ||
      (w.name     && w.name.toLowerCase().includes(q)) ||
      (w.category && w.category.toLowerCase().includes(q)) ||
      (w.author   && w.author.toLowerCase().includes(q));
    return typeOk && catOk && queryOk;
  });
  if (exploreSort === 'newest')      list.sort((a, b) => b.id - a.id);
  else if (exploreSort === 'oldest') list.sort((a, b) => a.id - b.id);
  else if (exploreSort === 'liked')  list.sort((a, b) => getLikes(b) - getLikes(a));
  return list;
}

function renderExploreGrid() {
  const grid    = document.getElementById('explore-grid');
  const countEl = document.getElementById('explore-results-count');
  const list    = getSortedFiltered();
  countEl.textContent = `${list.length.toLocaleString()} wallpaper${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    grid.innerHTML = '<div class="explore-no-results">No wallpapers match your filters.</div>';
    return;
  }

  grid.innerHTML = '';
  list.forEach(w => {
    const card     = document.createElement('div');
    card.className = 'explore-card';
    const initial  = (w.author || 'V')[0].toUpperCase();
    const durHtml  = w.duration ? `<span class="explore-card-duration">${w.duration}</span>` : '';
    const liveBadge = w.type === 'live' ? '<span class="live-badge">LIVE</span>' : '';

    card.innerHTML = `
      <div class="explore-card-preview" style="${cardBgStyle(w)}">${liveBadge}</div>
      <div class="explore-card-info">
        <div class="explore-card-avatar">${initial}</div>
        <div class="explore-card-text">
          <div class="explore-card-name">${w.name}</div>
          <div class="explore-card-meta-text">${w.author || 'VaultWalls'} · ${w.category}</div>
        </div>
        <div class="explore-card-right">
          <div class="explore-card-likes">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,80,80,0.85)" stroke="none">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            ${getLikes(w)}
          </div>
          ${durHtml}
        </div>
      </div>
    `;

    if (w.type === 'live') {
      const preview = card.querySelector('.explore-card-preview');
      attachLiveVideo(w, preview);
      card.addEventListener('mouseenter', () => {
        const vs = srcToUrl(w.src);
        if (viewerVideo.src !== vs) { viewerVideo.src = vs; viewerVideo.load(); }
      });
    }
    card.addEventListener('click', () => openViewer(w));
    grid.appendChild(card);
  });
}

function buildCategories() {
  const container = document.getElementById('explore-categories');
  container.innerHTML = '';
  categoryDefs.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'cat-btn' + (cat.key === 'all' ? ' active' : '');
    btn.dataset.cat = cat.key;
    btn.innerHTML   = `<div class="cat-thumb" style="background:${cat.gradient}"></div><span class="cat-label">${cat.name}</span>`;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      exploreCategory = cat.key;
      renderExploreGrid();
    });
    container.appendChild(btn);
  });
}

// sync filter tabs with stored setting
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.classList.toggle('active', tab.dataset.filter === exploreFilter);
  tab.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    exploreFilter = tab.dataset.filter;
    renderExploreGrid();
  });
});

document.getElementById('explore-search').addEventListener('input', e => {
  exploreQuery = e.target.value;
  renderExploreGrid();
});

document.querySelectorAll('.popular-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const el = document.getElementById('explore-search');
    el.value     = tag.dataset.q;
    exploreQuery = tag.dataset.q;
    const match  = categoryDefs.find(c => c.name === tag.dataset.q || c.key === tag.dataset.q);
    if (match) {
      exploreCategory = match.key;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === match.key));
    }
    renderExploreGrid();
    el.focus();
  });
});

const sortBtn      = document.getElementById('sort-btn');
const sortDropdown = document.getElementById('sort-dropdown');
const sortLabel    = document.getElementById('sort-label');

sortBtn.addEventListener('click', e => { e.stopPropagation(); sortDropdown.hidden = !sortDropdown.hidden; });
document.addEventListener('click', () => { sortDropdown.hidden = true; });

document.querySelectorAll('.sort-option').forEach(opt => {
  opt.addEventListener('click', e => {
    e.stopPropagation();
    exploreSort = opt.dataset.sort;
    const labels = { newest: 'Newest', oldest: 'Oldest', liked: 'Most Liked' };
    sortLabel.textContent = labels[exploreSort];
    document.querySelectorAll('.sort-option').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    sortDropdown.hidden = true;
    renderExploreGrid();
  });
});

// ─── VIEWER ───────────────────────────────────────────────────────
let viewerCurrent = null;

const viewer        = document.getElementById('viewer');
const viewerBgEl    = document.getElementById('viewer-bg');
const viewerVideo   = document.getElementById('viewer-video');
const viewerSpinner = document.getElementById('viewer-spinner');
const viewerBack    = document.getElementById('viewer-back');
const viewerDl      = document.getElementById('viewer-dl');
const viewerSet     = document.getElementById('viewer-set');

function openViewer(w) {
  viewerCurrent = w;
  addToHistory(w.id);

  if (w.type === 'live') {
    // Show gradient immediately so viewer isn't blank while video buffers
    viewerBgEl.style.backgroundImage = '';
    viewerBgEl.style.background      = catGradient(w.category);
    viewerBgEl.style.display         = '';

    const videoSrc = srcToUrl(w.src);
    viewerVideo.muted   = localStorage.getItem('vw_setting_mute') !== 'false';
    viewerVideo.loop    = localStorage.getItem('vw_setting_loop') !== 'false';
    viewerVideo.opacity = '0';
    viewerVideo.style.display  = 'block';
    viewerVideo.style.opacity  = '0';

    viewerVideo.oncanplay = null;
    if (viewerVideo.src !== videoSrc) {
      viewerSpinner.classList.add('active');
      viewerVideo.src = videoSrc;
      viewerVideo.load();
    }
    viewerVideo.oncanplay = () => {
      viewerVideo.play().catch(() => {});
      viewerVideo.style.opacity = '1';
      viewerSpinner.classList.remove('active');
      setTimeout(() => { viewerBgEl.style.display = 'none'; }, 520);
      viewerVideo.oncanplay = null;
    };
    // Already buffered from hover-preload — play instantly
    if (viewerVideo.readyState >= 3) {
      viewerVideo.play().catch(() => {});
      viewerVideo.style.opacity = '1';
      viewerSpinner.classList.remove('active');
      viewerBgEl.style.display  = 'none';
    }
  } else {
    viewerVideo.oncanplay = null;
    viewerSpinner.classList.remove('active');
    viewerVideo.src               = '';
    viewerVideo.style.opacity     = '0';
    viewerVideo.style.display     = 'none';
    viewerBgEl.style.background   = '';
    viewerBgEl.style.display      = '';
    viewerBgEl.style.backgroundImage = `url('${srcToUrl(w.src)}')`;
  }

  document.getElementById('viewer-title').textContent = w.name;
  document.getElementById('viewer-cat').textContent   = (w.category || '').toUpperCase();

  const meta   = document.getElementById('viewer-meta');
  const badges = [];
  if (w.author)     badges.push(['Author',     w.author]);
  if (w.resolution) badges.push(['Resolution', w.resolution]);
  if (w.size)       badges.push(['Size',       w.size]);
  if (w.duration)   badges.push(['Duration',   w.duration]);
  if (w.category)   badges.push(['Category',   w.category]);
  meta.innerHTML = badges.map(([l, v]) => `<span class="viewer-meta-badge">${l}: ${v}</span>`).join('');


  const related = shuffle(wallpapers.filter(wp => wp.category === w.category && wp.id !== w.id)).slice(0, 10);
  const relRow  = document.getElementById('viewer-related-row');
  relRow.innerHTML = '';
  related.forEach(rw => {
    const card     = document.createElement('div');
    card.className = 'viewer-related-card';
    if (rw.type === 'still') {
      card.style.backgroundImage    = `url('${srcToUrl(rw.src)}')`;
      card.style.backgroundSize     = 'cover';
      card.style.backgroundPosition = 'center';
    } else {
      card.style.background = catGradient(rw.category);
    }
    card.addEventListener('click', () => openViewer(rw));
    relRow.appendChild(card);
  });

  viewer.scrollTop = 0;
  viewer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeViewer() {
  viewer.classList.remove('open');
  document.body.style.overflow = '';
  viewerSpinner.classList.remove('active');
  setTimeout(() => { viewerVideo.src = ''; viewerVideo.style.display = 'none'; }, 300);
}

viewerBack.addEventListener('click', closeViewer);

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (viewer.classList.contains('open'))                                              closeViewer();
  else if (!document.getElementById('search-overlay').classList.contains('hidden'))  closeSearchOverlay();
  else if (!document.getElementById('settings-modal').classList.contains('hidden'))  closeSettings();
});

viewerDl.addEventListener('click', () => {
  if (!viewerCurrent) return;
  doDownload(viewerCurrent, false);
});

viewerSet.addEventListener('click', () => {
  if (!viewerCurrent) return;
  doDownload(viewerCurrent, true);
});

document.getElementById('viewer-copy-link').addEventListener('click', () => {
  if (!viewerCurrent) return;
  navigator.clipboard.writeText(window.location.href + '#' + viewerCurrent.id)
    .then(() => showToast('Link copied to clipboard!'))
    .catch(() => {});
});

// ─── GLOBAL SEARCH OVERLAY ────────────────────────────────────────
const searchOverlay    = document.getElementById('search-overlay');
const searchInput      = document.getElementById('search-modal-input');
const searchPre        = document.getElementById('search-pre');
const searchResults    = document.getElementById('search-results');
const searchResultHdr  = document.getElementById('search-results-header');
const searchResultList = document.getElementById('search-results-list');

function openSearchOverlay() {
  searchOverlay.classList.remove('hidden');
  searchInput.value    = '';
  searchPre.hidden     = false;
  searchResults.hidden = true;
  setTimeout(() => searchInput.focus(), 40);
  document.body.style.overflow = 'hidden';
}
function closeSearchOverlay() {
  searchOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('searchBtn').addEventListener('click', openSearchOverlay);
document.getElementById('search-modal-close').addEventListener('click', closeSearchOverlay);
searchOverlay.addEventListener('click', e => {
  if (e.target === searchOverlay || e.target.classList.contains('search-overlay-backdrop')) closeSearchOverlay();
});

function buildSearchPreCats() {
  const container = document.getElementById('search-pre-cats');
  if (!container) return;
  container.innerHTML = '';
  ['Space', 'Cars', 'Nature', 'Abstract', 'Minimal', 'Animals', 'Beach'].forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'search-chip';
    btn.textContent = cat;
    btn.addEventListener('click', () => { searchInput.value = cat; runSearchQuery(cat); });
    container.appendChild(btn);
  });
}

document.querySelectorAll('.search-type-chip').forEach(chip => {
  chip.addEventListener('click', () => { searchInput.value = chip.dataset.q; runSearchQuery(chip.dataset.q); });
});

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (!q) { searchPre.hidden = false; searchResults.hidden = true; }
  else     { runSearchQuery(q); }
});

function runSearchQuery(q) {
  const lower = q.toLowerCase();
  searchPre.hidden     = true;
  searchResults.hidden = false;

  const results = wallpapers
    .map(w => {
      let score = 0;
      if (w.name.toLowerCase().includes(lower))             score += 3;
      if ((w.category || '').toLowerCase().includes(lower)) score += 2;
      if ((w.author   || '').toLowerCase().includes(lower)) score += 1;
      return { w, score };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => r.w)
    .slice(0, 30);

  const label = q.charAt(0).toUpperCase() + q.slice(1);
  searchResultHdr.textContent = `${label} — ${results.length} result${results.length !== 1 ? 's' : ''} found`;

  searchResultList.innerHTML = '';
  if (!results.length) {
    searchResultList.innerHTML = `<div class="search-no-results">No wallpapers found for "${q}"</div>`;
    return;
  }

  const escQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  results.forEach(w => {
    const item       = document.createElement('button');
    item.className   = 'search-result-item';
    const thumbStyle = w.type === 'still'
      ? `background-image:url('${srcToUrl(w.src)}');background-size:cover;background-position:center`
      : `background:${catGradient(w.category)}`;
    const highlighted = w.name.replace(new RegExp(`(${escQ})`, 'gi'), '<mark>$1</mark>');
    item.innerHTML = `
      <div class="search-result-thumb" style="${thumbStyle}"></div>
      <div class="search-result-info">
        <div class="search-result-name">${highlighted}</div>
        <div class="search-result-cat">Category: ${w.category}</div>
      </div>
      <div class="search-result-meta">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,80,80,0.8)" stroke="none">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        ${getLikes(w)}
      </div>
    `;
    item.addEventListener('click', () => { closeSearchOverlay(); openViewer(w); });
    searchResultList.appendChild(item);
  });
}

// ─── SETTINGS MODAL ───────────────────────────────────────────────
const settingsModal = document.getElementById('settings-modal');

function openSettings()  { settingsModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeSettings() { settingsModal.classList.add('hidden');    document.body.style.overflow = ''; }

document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettings(); });

const settingAutoplay = document.getElementById('setting-autoplay');
const settingMute     = document.getElementById('setting-mute');
const settingLoop     = document.getElementById('setting-loop');
const settingFilter   = document.getElementById('setting-filter');
const settingInterval = document.getElementById('setting-interval');

settingAutoplay.checked = localStorage.getItem('vw_setting_autoplay') !== 'false';
settingMute.checked     = localStorage.getItem('vw_setting_mute')     !== 'false';
settingLoop.checked     = localStorage.getItem('vw_setting_loop')     !== 'false';
settingFilter.value     = localStorage.getItem('vw_setting_filter')   || 'both';
settingInterval.value   = localStorage.getItem('vw_setting_interval') || '11000';

settingAutoplay.addEventListener('change', () => localStorage.setItem('vw_setting_autoplay', settingAutoplay.checked));
settingMute.addEventListener('change',     () => localStorage.setItem('vw_setting_mute',     settingMute.checked));
settingLoop.addEventListener('change',     () => localStorage.setItem('vw_setting_loop',      settingLoop.checked));
settingFilter.addEventListener('change',   () => {
  localStorage.setItem('vw_setting_filter', settingFilter.value);
  exploreFilter = settingFilter.value;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === exploreFilter));
  renderExploreGrid();
});
settingInterval.addEventListener('change', () => {
  const ms = parseInt(settingInterval.value);
  localStorage.setItem('vw_setting_interval', ms);
  heroIntervalMs = ms;
  resetTimer();
});

// ─── MY MEDIA PAGE ────────────────────────────────────────────────
let mediaFilter = 'all';
let mediaQuery  = '';

document.querySelectorAll('.media-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.media-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mediaFilter = btn.dataset.mf;
    renderMediaTable();
  });
});

document.getElementById('media-search')?.addEventListener('input', e => {
  mediaQuery = e.target.value.toLowerCase();
  renderMediaTable();
});

function getMediaList() {
  let list = [];
  if (mediaFilter === 'all') {
    // History: wallpapers opened, in reverse-view order
    list = viewHistory.map(id => wallpapers.find(w => w.id === id)).filter(Boolean);
  } else if (mediaFilter === 'local') {
    // Downloaded
    list = wallpapers.filter(w => downloadedIds.has(w.id));
  } else if (mediaFilter === 'liked') {
    list = wallpapers.filter(w => likedIds.has(w.id));
  }
  if (mediaQuery) {
    list = list.filter(w =>
      (w.name     || '').toLowerCase().includes(mediaQuery) ||
      (w.category || '').toLowerCase().includes(mediaQuery) ||
      (w.author   || '').toLowerCase().includes(mediaQuery)
    );
  }
  return list;
}

function renderMediaTable() {
  const body  = document.getElementById('media-table-body');
  const empty = document.getElementById('media-empty');
  const count = document.getElementById('media-count');
  if (!body) return;

  const list = getMediaList();
  if (count) count.textContent = `${list.length} wallpaper${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    body.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  body.innerHTML = '';

  list.forEach((w, i) => {
    const row        = document.createElement('div');
    row.className    = 'media-row';
    const thumbStyle = w.type === 'still'
      ? `background-image:url('${srcToUrl(w.src)}');background-size:cover;background-position:center`
      : `background:${catGradient(w.category)}`;
    const isLiked    = likedIds.has(w.id);
    const hFill      = isLiked ? 'rgba(230,60,60,0.9)' : 'none';
    const hStroke    = isLiked ? 'none' : 'currentColor';

    row.innerHTML = `
      <span class="media-row-num">${i + 1}</span>
      <div class="media-row-thumb" style="${thumbStyle}">
        ${w.type === 'live' ? '<span class="live-badge" style="font-size:0.5rem;padding:2px 5px;top:3px;right:3px">LIVE</span>' : ''}
      </div>
      <div class="media-row-title">
        <div class="media-row-name">${w.name}</div>
        <div class="media-row-type">${w.type === 'live' ? 'Live' : 'Still'}</div>
      </div>
      <span class="media-row-cat">${w.category || '—'}</span>
      <span class="media-row-author">${w.author || 'VaultWalls'}</span>
      <span class="media-row-dur">${w.duration || '—'}</span>
      <span class="media-row-res">${w.resolution || '—'}</span>
      <span class="media-row-size">${w.size || '—'}</span>
      <div class="media-row-likes">
        <span>${getLikes(w)}</span>
        <button class="media-like-btn ${isLiked ? 'liked' : ''}" data-id="${w.id}" aria-label="Like">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="${hFill}" stroke="${hStroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
    `;

    row.querySelector('.media-like-btn').addEventListener('click', e => {
      e.stopPropagation();
      const id       = parseInt(e.currentTarget.dataset.id);
      const wasLiked = likedIds.has(id);
      wasLiked ? likedIds.delete(id) : likedIds.add(id);
      adjustLike(id, wasLiked ? -1 : 1);
      saveLiked();
      renderMediaTable();
    });

    row.addEventListener('click', e => {
      if (e.target.closest('.media-like-btn')) return;
      openViewer(w);
    });

    body.appendChild(row);
  });
}

function refreshMediaPage() {
  if (document.getElementById('page-media').classList.contains('active')) renderMediaTable();
}

// ─── INIT ─────────────────────────────────────────────────────────
// Fetches from GitHub so users always get new wallpapers without an app update.
// Falls back to the locally bundled wallpapers.json if offline.
const REMOTE_WALLPAPERS = 'https://raw.githubusercontent.com/VaultWalls/vaultwalls.github.io/main/wallpapers.json';

async function init() {
  try {
    const res = await fetch(REMOTE_WALLPAPERS);
    if (res.ok) {
      wallpapers = await res.json();
    } else {
      throw new Error('remote failed');
    }
  } catch {
    try {
      const res = await fetch('wallpapers.json');
      if (res.ok) wallpapers = await res.json();
    } catch { /* offline with no local fallback */ }
  }

  if (!wallpapers.length) return;

  initLikeCounts();

  // Hero: mix of stills + any live wallpapers, randomized each load
  const heroStills = shuffle(wallpapers.filter(w => w.type === 'still'));
  const heroLives  = shuffle(wallpapers.filter(w => w.type === 'live'));
  heroWallpapers   = shuffle([...heroStills.slice(0, 6), ...heroLives]).slice(0, 8);
  buildDots();
  showHero(0);
  resetTimer();

  // Shelves
  renderShelf('shelf-recommended', shuffle(wallpapers).slice(0, 12));
  renderShelf('shelf-trending',    [...wallpapers].sort((a, b) => getLikes(b) - getLikes(a)).slice(0, 12));
  renderShelf('shelf-recent',      [...wallpapers].sort((a, b) => b.id - a.id).slice(0, 12));

  // Explore
  document.getElementById('explore-greeting').textContent = getGreeting();
  document.getElementById('explore-count').textContent    = wallpapers.length.toLocaleString();
  buildCategories();
  buildSearchPreCats();
  renderExploreGrid();

  // Media
  const mediaCount = document.getElementById('media-count');
  if (mediaCount) {
    const n = viewHistory.length;
    mediaCount.textContent = `${n} wallpaper${n !== 1 ? 's' : ''}`;
  }
}

async function checkForUpdates() {
  if (!window.__TAURI__) return;
  try {
    const update = await window.__TAURI__.updater.check();
    if (!update) return;
    const banner     = document.getElementById('update-banner');
    const verEl      = document.getElementById('update-version');
    const installBtn = document.getElementById('update-install-btn');
    const dismissBtn = document.getElementById('update-dismiss-btn');
    if (!banner) return;
    verEl.textContent = update.version;
    banner.classList.add('visible');
    installBtn.onclick = async () => {
      installBtn.textContent = 'Downloading…';
      installBtn.disabled = true;
      await update.downloadAndInstall();
      await window.__TAURI__.process.relaunch();
    };
    dismissBtn.onclick = () => banner.classList.remove('visible');
  } catch (e) {
    console.warn('Update check:', e);
  }
}

init();
checkForUpdates();
