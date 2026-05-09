/**
 * VaultWalls — wallpapers.json generator
 * Run: npm run generate
 *
 * Scans every folder inside "All wallpapers/", finds every image/video,
 * extracts size, resolution, and duration, then writes wallpapers.json.
 */

const fs   = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────────────
const GITHUB_REPO    = 'VaultWalls/vaultwalls.github.io';
const GITHUB_BRANCH  = 'main';
const RAW_BASE       = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/`;
const WALLPAPERS_DIR = path.join(__dirname, 'All wallpapers');
const OUTPUT_FILE    = path.join(__dirname, 'wallpapers.json');

const CATEGORY_MAP = {
  'space':          'Space',
  'abstract':       'Abstract',
  'animals':        'Animals',
  'beach and ocean':'Beach',
  'cars':           'Cars',
  'live cars':      'Cars',
  'live nature':    'Nature',
  'minimal':        'Minimal',
  'nature':         'Nature',
};

const STILL_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const LIVE_EXTS  = new Set(['.mp4', '.webm', '.mov']);
// ─────────────────────────────────────────────────────────────────

function toRawUrl(relativePath) {
  return RAW_BASE + relativePath.split('/').map(encodeURIComponent).join('/');
}

function nameFromFile(filename) {
  return path.basename(filename, path.extname(filename));
}

// Format bytes → "12.4 MB" or "340 KB"
function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

// Format seconds → "1:23"
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Read PNG dimensions from binary header (pure Node.js, no deps)
function getPngDimensions(buf) {
  if (buf.length < 24) return null;
  // PNG signature: 8 bytes, then IHDR chunk: 4 len + 4 "IHDR" + 4 width + 4 height
  const sig = buf.slice(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return `${w}×${h}`;
}

// Read JPEG dimensions by scanning for SOF markers (pure Node.js, no deps)
function getJpegDimensions(buf) {
  let i = 2;
  while (i + 4 < buf.length) {
    if (buf[i] !== 0xFF) break;
    const marker = buf[i + 1];
    if (marker === 0xD9 || marker === 0xDA) break;
    if (i + 3 >= buf.length) break;
    const segLen = buf.readUInt16BE(i + 2);
    if (segLen < 2) break;
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
    const isSOF = (marker >= 0xC0 && marker <= 0xC3) ||
                  (marker >= 0xC5 && marker <= 0xC7) ||
                  (marker >= 0xC9 && marker <= 0xCB) ||
                  (marker >= 0xCD && marker <= 0xCF);
    if (isSOF && i + 9 < buf.length) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      return `${w}×${h}`;
    }
    i += 2 + segLen;
  }
  return null;
}

// Get image dimensions from buffer based on extension
function getImageDimensions(buf, ext) {
  try {
    if (ext === '.png')              return getPngDimensions(buf);
    if (ext === '.jpg' || ext === '.jpeg') return getJpegDimensions(buf);
  } catch {}
  return null;
}

// Read MP4/MOV duration from binary (pure Node.js, no deps)
// ISO 14496-12 mvhd box layout (offsets relative to the 4-byte box name position):
//   version (1 byte) + flags (3 bytes) = 4 bytes after name
//   version 0: creation(4) modification(4) timescale(4) duration(4) → timescale at +16, dur at +20
//   version 1: creation(8) modification(8) timescale(4) duration(8) → timescale at +24, dur at +28
function getVideoInfo(buf) {
  for (let i = 4; i < buf.length - 32; i++) {
    if (buf[i]   !== 0x6D || buf[i+1] !== 0x76 ||
        buf[i+2] !== 0x68 || buf[i+3] !== 0x64) continue; // 'mvhd'
    try {
      const version = buf[i + 4]; // byte right after 'mvhd'
      let timescale, durationSec;
      if (version === 0) {
        timescale    = buf.readUInt32BE(i + 16);
        const dur    = buf.readUInt32BE(i + 20);
        durationSec  = timescale > 0 ? dur / timescale : 0;
      } else if (version === 1) {
        timescale    = buf.readUInt32BE(i + 24);
        // duration is uint64 — use only lower 32 bits (fine for <13 hours)
        const dur    = buf.readUInt32BE(i + 32);
        durationSec  = timescale > 0 ? dur / timescale : 0;
      } else { continue; }

      if (durationSec > 0) return { duration: formatDuration(durationSec) };
    } catch {}
  }
  return {};
}

// ─── SCAN ─────────────────────────────────────────────────────────
if (!fs.existsSync(WALLPAPERS_DIR)) {
  console.error(`❌  Folder not found: ${WALLPAPERS_DIR}`);
  process.exit(1);
}

const folders = fs.readdirSync(WALLPAPERS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name).sort();

let id = 1, stillCnt = 0, liveCnt = 0;
const wallpapers = [];

for (const folder of folders) {
  const folderPath = path.join(WALLPAPERS_DIR, folder);
  const files = fs.readdirSync(folderPath, { withFileTypes: true })
    .filter(f => f.isFile()).map(f => f.name).sort();

  const category = CATEGORY_MAP[folder.toLowerCase()] || folder;

  for (const file of files) {
    const ext  = path.extname(file).toLowerCase();
    let   type = null;
    if (STILL_EXTS.has(ext))      type = 'still';
    else if (LIVE_EXTS.has(ext))  type = 'live';
    else continue;

    const filePath = path.join(folderPath, file);
    let   size = null, resolution = null, duration = null;

    try {
      const stat = fs.statSync(filePath);
      size = formatSize(stat.size);

      // Read file bytes for metadata
      const buf = fs.readFileSync(filePath);

      if (type === 'still') {
        resolution = getImageDimensions(buf, ext);
      } else {
        const info = getVideoInfo(buf);
        duration   = info.duration;
        resolution = info.resolution;
      }
    } catch (err) {
      // metadata extraction failed — fields will be null (shown as "—" in the app)
    }

    const relativePath = `All wallpapers/${folder}/${file}`;
    const entry = {
      id: id++,
      name: nameFromFile(file),
      category,
      author: 'VaultWalls',
      type,
      src: toRawUrl(relativePath),
    };
    if (size)       entry.size       = size;
    if (resolution) entry.resolution = resolution;
    if (duration)   entry.duration   = duration;

    wallpapers.push(entry);
    type === 'live' ? liveCnt++ : stillCnt++;
  }
}

// ─── WRITE ────────────────────────────────────────────────────────
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(wallpapers, null, 2), 'utf8');

console.log('');
console.log('✅  wallpapers.json generated successfully!');
console.log(`    📁  Folders scanned  : ${folders.length}`);
console.log(`    🖼   Still wallpapers : ${stillCnt}`);
console.log(`    🎞   Live wallpapers  : ${liveCnt}`);
console.log(`    📄  Total entries    : ${wallpapers.length}`);
console.log(`    💾  Saved to         : ${OUTPUT_FILE}`);
console.log('');
console.log('Next steps:');
console.log('  1. git add wallpapers.json && git commit -m "update wallpapers" && git push');
console.log('  2. Your site will load the new wallpapers and metadata automatically');
console.log('');
