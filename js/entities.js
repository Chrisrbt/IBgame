// ============================================
// ENTITIES - NPCs, enemies, items
// ============================================

const CRYSTAL_RGB = { blue: '64,128,255', red: '255,64,64', green: '64,255,96' };

const Entities = {
    SOLID_TYPES: new Set(['nonna', 'vase', 'lever', 'painting']),

    isSolid(e) {
        return this.SOLID_TYPES.has(e.type) && !e.hidden;
    },

    // Things the player can press AZIONE on
    isInteractable(e) {
        if (e.hidden || e.collected) return false;
        return ['note', 'key', 'crystal', 'lever', 'nonna', 'vase', 'painting'].includes(e.type);
    },

    // ===== DRAWING =====
    // Items lying on the floor, drawn before characters
    drawFloor(e, frame) {
        const ctx = Renderer.ctx;
        const px = e.x * TILE, py = e.y * TILE;
        const bob = Math.round(Math.sin(frame * 0.08 + e.x) * 2);
        switch (e.type) {
            case 'note':
                Renderer.drawData(TileSprites.note, px + 4, py + 4, 24);
                break;
            case 'key':
                if (!e.collected) Renderer.drawData(TileSprites.key, px, py + bob);
                break;
            case 'crystal':
                if (!e.collected && !e.hidden) Renderer.drawData(TileSprites.crystal[e.color], px, py + bob - 2);
                break;
            case 'petal':
                if (!e.collected) Renderer.drawData(TileSprites.petal, px, py + bob);
                break;
            case 'lever':
                Renderer.drawData(e.on ? TileSprites.lever.on : TileSprites.lever.off, px, py);
                break;
            case 'vase':
                Renderer.drawData(TileSprites.vase, px, py);
                break;
            case 'painting':
                Renderer.drawData(TileSprites.painting[e.art], px + 2, py + 2, 28);
                break;
            case 'floor_btn': {
                ctx.fillStyle = '#111';
                ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
                ctx.globalAlpha = e.pressed ? 1 : 0.35 + Math.sin(frame * 0.05 + e.order) * 0.05;
                ctx.fillStyle = e.color;
                ctx.fillRect(px + 5, py + 5, TILE - 10, TILE - 10);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = e.pressed ? '#fff' : '#666';
                ctx.lineWidth = 1;
                ctx.strokeRect(px + 4.5, py + 4.5, TILE - 9, TILE - 9);
                break;
            }
            case 'portal':
                if (!e.hidden) this.drawPortal(px + TILE / 2, py + TILE / 2, frame);
                break;
        }
    },

    drawPortal(cx, cy, frame) {
        const ctx = Renderer.ctx;
        ctx.save();
        for (let i = 0; i < 4; i++) {
            const r = 6 + i * 4 + Math.sin(frame * 0.1 + i) * 1.5;
            ctx.strokeStyle = ['#c9a0ff', '#9a5cff', '#6a30dd', '#40209a'][i];
            ctx.lineWidth = 2;
            ctx.beginPath();
            const start = frame * 0.05 * (i % 2 ? -1 : 1) + i;
            ctx.arc(cx, cy, r, start, start + Math.PI * 1.4);
            ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
        ctx.restore();
    },

    // Characters, drawn sorted by row so they overlap naturally
    drawActor(e, frame) {
        if (e.hidden) return;
        switch (e.type) {
            case 'shadow': {
                const rx = e.rx === undefined ? e.x : e.rx;
                const ry = e.ry === undefined ? e.y : e.ry;
                const hover = Math.sin(frame * 0.1 + e.x * 3) * 2;
                const alpha = e.stun > 0 ? 0.45 : 0.92;
                Renderer.drawData(ShadowSprite.frames[Math.floor(frame / 12) % 2],
                    rx * TILE, ry * TILE + hover, TILE, { alpha, flip: e.face < 0 });
                if (e.alertT > 0) {
                    Renderer.drawText(rx * TILE + TILE / 2, ry * TILE - 4 + hover, '!', '#ff3030', 22, 'center');
                }
                break;
            }
            case 'nonna': {
                Renderer.drawData(NonnaSprite, e.x * TILE, e.y * TILE);
                if (e.caged) {
                    const ctx = Renderer.ctx;
                    ctx.fillStyle = 'rgba(20,0,20,0.85)';
                    for (let i = 0; i < 5; i++) {
                        const wob = Math.sin(frame * 0.1 + i) * 1;
                        ctx.fillRect(e.x * TILE + 2 + i * 7 + wob, e.y * TILE - 6, 3, TILE + 8);
                    }
                    ctx.fillRect(e.x * TILE - 2, e.y * TILE - 8, TILE + 4, 4);
                    ctx.fillRect(e.x * TILE - 2, e.y * TILE + TILE, TILE + 4, 4);
                }
                break;
            }
        }
    },

    // Light holes cut into the darkness
    lights(e, frame, out) {
        if (e.hidden || e.collected) return;
        const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2;
        switch (e.type) {
            case 'crystal': out.push({ x: cx, y: cy, r: 56 + Math.sin(frame * 0.1) * 6 }); break;
            case 'portal': out.push({ x: cx, y: cy, r: 110 }); break;
            case 'key': out.push({ x: cx, y: cy, r: 30, strength: 0.6 }); break;
            case 'vase': out.push({ x: cx, y: cy, r: 34, strength: 0.6 }); break;
            case 'floor_btn': if (e.pressed) out.push({ x: cx, y: cy, r: 40, strength: 0.8 }); break;
            case 'nonna': if (!e.caged) out.push({ x: cx, y: cy, r: 48, strength: 0.7 }); break;
            case 'note': out.push({ x: cx, y: cy, r: 22, strength: 0.4 }); break;
        }
    },

    // Additive glows drawn above the darkness
    drawGlow(e, frame) {
        if (e.hidden || e.collected) return;
        const cx = e.x * TILE + TILE / 2, cy = e.y * TILE + TILE / 2;
        switch (e.type) {
            case 'crystal':
                Renderer.glow(cx, cy, 34, CRYSTAL_RGB[e.color], 0.35 + Math.sin(frame * 0.1) * 0.1);
                if (frame % 20 === 0) {
                    Particles.spawn({ x: cx + rng(-8, 8), y: cy + rng(-6, 6), vy: -0.4, life: 40, size: 2, color: CRYSTAL_RGB[e.color], glow: true });
                }
                break;
            case 'portal':
                Renderer.glow(cx, cy, 60, '140,80,255', 0.35 + Math.sin(frame * 0.08) * 0.1);
                if (frame % 4 === 0) {
                    const a = Math.random() * Math.PI * 2;
                    Particles.spawn({ x: cx + Math.cos(a) * 30, y: cy + Math.sin(a) * 30,
                        vx: -Math.cos(a) * 0.8, vy: -Math.sin(a) * 0.8, life: 36, size: 2, color: '200,160,255', glow: true });
                }
                break;
            case 'key':
                Renderer.glow(cx, cy, 18, '255,200,60', 0.25);
                break;
            case 'floor_btn':
                if (e.pressed) Renderer.glow(cx, cy, 26, hexToRgb(e.color), 0.35);
                break;
            case 'shadow': {
                const rx = (e.rx === undefined ? e.x : e.rx) * TILE + TILE / 2;
                const ry = (e.ry === undefined ? e.y : e.ry) * TILE + TILE / 2;
                Renderer.glow(rx, ry - 4, 22, '255,0,0', 0.12 + Math.sin(frame * 0.15) * 0.05);
                break;
            }
            case 'vase':
                Renderer.glow(cx, cy - 8, 14, '255,60,80', 0.15);
                break;
        }
    },

    // ===== AI =====
    update(e, game) {
        if (e.type === 'shadow') this.updateShadow(e, game);
    },

    updateShadow(e, game) {
        if (e.rx === undefined) { e.rx = e.x; e.ry = e.y; }
        e.rx += (e.x - e.rx) * 0.18;
        e.ry += (e.y - e.ry) * 0.18;
        if (e.alertT > 0) e.alertT--;

        if (e.stun > 0) { e.stun--; return; }
        if (e.cd > 0) { e.cd--; return; }

        const p = game.player;
        const sight = e.sight || 4;
        const chasing = dist(e, p) <= sight && p.iframes === 0;

        if (chasing) {
            if (!e.chasing) {
                e.alertT = 40;
                Sfx.warn();
            }
            e.chasing = true;
            this.stepToward(e, p.x, p.y, game);
            e.cd = e.chaseDelay || 20;
            return;
        }
        e.chasing = false;

        if (e.patrol && e.patrol.length) {
            if (!e.patrolIdx) e.patrolIdx = 0;
            const target = e.patrol[e.patrolIdx];
            if (e.x === target.x && e.y === target.y) {
                e.patrolIdx = (e.patrolIdx + 1) % e.patrol.length;
            } else if (!this.stepToward(e, target.x, target.y, game)) {
                e.stuck = (e.stuck || 0) + 1;
                if (e.stuck > 3) {
                    e.stuck = 0;
                    e.patrolIdx = (e.patrolIdx + 1) % e.patrol.length;
                }
            }
        }
        e.cd = e.patrolDelay || 30;
    },

    // One grid step toward a target, sliding along walls when the direct way is blocked
    stepToward(e, tx, ty, game) {
        const dx = tx - e.x, dy = ty - e.y;
        const sx = Math.sign(dx), sy = Math.sign(dy);
        const moves = [];
        if (Math.abs(dx) >= Math.abs(dy)) {
            if (sx) moves.push([sx, 0]);
            if (sy) moves.push([0, sy]);
        } else {
            if (sy) moves.push([0, sy]);
            if (sx) moves.push([sx, 0]);
        }
        for (const [mx, my] of moves) {
            if (game.canEnemyEnter(e.x + mx, e.y + my, e)) {
                e.x += mx;
                e.y += my;
                if (mx) e.face = mx;
                return true;
            }
        }
        return false;
    },
};

function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
