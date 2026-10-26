// ============================================
// UTILS - Helper functions
// ============================================

const TILE = 32;
const COLS = 20;
const ROWS = 15;
const CANVAS_W = COLS * TILE;
const CANVAS_H = ROWS * TILE;
const STEP_MS = 1000 / 60; // fixed simulation step

const DIR = {
    up:    { x: 0, y: -1 },
    down:  { x: 0, y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1, y: 0 }
};

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Manhattan distance on the grid
function dist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function rng(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Deterministic pseudo-random value in [0,1) for a tile, so decorations never flicker
function hash2(x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

// Build a pixel sprite from strings: each char is a palette key, '.' is transparent
function spriteFromStrings(rows, palette) {
    return rows.map(row => [...row].map(ch => (ch === '.' || ch === ' ') ? null : (palette[ch] || null)));
}

// Same sprite with every visible pixel replaced by one color (hit flashes, silhouettes)
function spriteSilhouette(data, color) {
    return data.map(row => row.map(c => (c && c !== '.') ? color : null));
}

function mirrorSprite(data) {
    return data.map(row => [...row].reverse());
}

function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// localStorage can throw (private mode, blocked storage): never let it break the game
const Storage = {
    get(key, fallback = null) {
        try {
            const v = localStorage.getItem(key);
            return v === null ? fallback : JSON.parse(v);
        } catch (e) {
            return fallback;
        }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    remove(key) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
};
