// ============================================
// BOSS - "La Dama nel Quadro", the final fight
// ============================================
// The player can't touch her. Light orbs spawn around the arena: walk over one
// to pick it up, then press AZIONE to throw it in the facing direction.
// Coordinates are in tiles (floats for projectiles).

const Boss = {
    NAME: 'LA DAMA NEL QUADRO',
    MAX_HP: 12,
    MAX_CHARGES: 3,
    active: false,
    e: null,
    projectiles: [],
    bolts: [],
    hazards: [],
    orbs: [],
    queue: [],
    orbCd: 0,
    lastAttack: null,
    summonCount: 0,

    reset() {
        this.active = false;
        this.e = null;
        this.projectiles = [];
        this.bolts = [];
        this.hazards = [];
        this.orbs = [];
        this.queue = [];
        this.lastAttack = null;
    },

    start(game, x, y) {
        this.reset();
        this.active = true;
        this.e = {
            x, y, rx: x, ry: y,
            hp: this.MAX_HP, phase: 1,
            moveCd: 60, atkCd: 110, stun: 0, flash: 0, dying: 0,
            appear: 70, face: 1,
        };
        this.orbCd = 40;
        game.player.charges = 0;
        Music.play('boss');
        Sfx.roar();
        Particles.burst((x + 0.5) * TILE, (y + 0.5) * TILE, '160,40,200', 40, 3.5, { life: 60 });
    },

    phaseFor(hp) {
        return hp > 8 ? 1 : hp > 4 ? 2 : 3;
    },

    // ===== UPDATE =====
    update(game) {
        const e = this.e;
        if (!this.active || !e) return;

        e.rx += (e.x - e.rx) * 0.15;
        e.ry += (e.y - e.ry) * 0.15;
        if (e.flash > 0) e.flash--;

        this.updateBolts(game);
        this.updateProjectiles(game);
        this.updateHazards(game);
        this.updateOrbs(game);

        if (e.dying > 0) {
            e.dying--;
            if (e.dying % 6 === 0) {
                Particles.burst((e.rx + 0.5) * TILE + rng(-16, 16), (e.ry + 0.2) * TILE + rng(-20, 10),
                    pick(['255,255,255', '200,30,50', '120,0,160']), 10, 3);
                Renderer.shake(6, 3);
            }
            if (e.dying === 0) {
                Particles.burst((e.rx + 0.5) * TILE, (e.ry + 0.3) * TILE, '255,255,255', 60, 5, { life: 80 });
                this.active = false;
                game.onBossDefeated();
            }
            return;
        }

        if (e.appear > 0) {
            e.appear--;
            return;
        }

        this.runQueue(game);

        if (e.stun > 0) {
            e.stun--;
        } else {
            if (--e.moveCd <= 0) {
                const oldX = e.x;
                Entities.stepToward(e, game.player.x, game.player.y, game);
                if (e.x !== oldX) e.face = Math.sign(e.x - oldX);
                e.moveCd = [42, 32, 24][e.phase - 1];
            }
            if (--e.atkCd <= 0) this.attack(game);
        }

        // Touching her hurts
        const p = game.player;
        if (Math.abs(e.rx - p.rx) < 0.6 && Math.abs(e.ry - p.ry) < 0.6) game.hurt(1);
    },

    runQueue(game) {
        if (!this.queue.length) return;
        const q = this.queue[0];
        if (--q.delay <= 0) {
            this.queue.shift();
            q.fn(game);
        }
    },

    attack(game) {
        const e = this.e;
        const options = [
            ['ring4', 'aimed', 'hands'],
            ['ring8', 'aimed', 'hands', 'spiral'],
            ['ring8', 'aimed', 'hands', 'spiral', 'summon'],
        ][e.phase - 1];
        let a = pick(options);
        if (a === this.lastAttack) a = pick(options);
        if (a === 'summon' && game.currentEntities.filter(s => s.type === 'shadow').length >= 2) a = 'hands';
        this.lastAttack = a;

        const speed = [0.07, 0.085, 0.1][e.phase - 1];
        switch (a) {
            case 'ring4':
                for (let i = 0; i < 4; i++) this.fire(i * Math.PI / 2, speed);
                Sfx.bossShot();
                break;
            case 'ring8': {
                const off = e.phase === 3 && Math.random() < 0.5 ? Math.PI / 8 : 0;
                for (let i = 0; i < 8; i++) this.fire(off + i * Math.PI / 4, speed);
                Sfx.bossShot();
                break;
            }
            case 'aimed':
                for (let i = 0; i < 2 + e.phase; i++) {
                    this.queue.push({ delay: 10, fn: g => {
                        const p = g.player;
                        this.fire(Math.atan2(p.ry - this.e.ry, p.rx - this.e.rx), speed * 1.25);
                        Sfx.bossShot();
                    }});
                }
                break;
            case 'spiral': {
                const base = Math.random() * Math.PI * 2;
                const n = e.phase === 3 ? 16 : 10;
                for (let i = 0; i < n; i++) {
                    this.queue.push({ delay: 5, fn: () => {
                        this.fire(base + i * 0.55, speed);
                        this.fire(base + i * 0.55 + Math.PI, speed);
                        if (i % 2 === 0) Sfx.bossShot();
                    }});
                }
                break;
            }
            case 'hands':
                this.spawnHands(game, 2 + e.phase);
                break;
            case 'summon':
                this.summon(game);
                break;
        }
        e.atkCd = [150, 115, 88][e.phase - 1];
    },

    fire(angle, speed) {
        const e = this.e;
        this.projectiles.push({
            x: e.x, y: e.y,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        });
    },

    spawnHands(game, count) {
        const p = game.player;
        const targets = [{ x: p.x, y: p.y }];
        const candidates = [];
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const x = p.x + dx, y = p.y + dy;
                if ((dx || dy) && Math.abs(dx) + Math.abs(dy) <= 2 && game.isFloor(x, y)) candidates.push({ x, y });
            }
        }
        targets.push(...shuffle(candidates).slice(0, count - 1));
        for (const t of targets) this.hazards.push({ x: t.x, y: t.y, t: 0, warn: 55, active: 18 });
        Sfx.warn();
    },

    summon(game) {
        const corners = [{ x: 1, y: 1 }, { x: 18, y: 1 }, { x: 1, y: 13 }, { x: 18, y: 13 }];
        const p = game.player;
        corners.sort((a, b) => dist(b, p) - dist(a, p));
        for (const c of corners.slice(0, 2)) {
            if (game.currentEntities.some(s => s.x === c.x && s.y === c.y)) continue;
            game.currentEntities.push({
                type: 'shadow', x: c.x, y: c.y, id: 'summon_' + (this.summonCount++),
                sight: 40, chaseDelay: 26, summoned: true, cd: 30,
            });
            Particles.burst((c.x + 0.5) * TILE, (c.y + 0.5) * TILE, '120,0,160', 20, 2.5);
        }
        Sfx.roar();
    },

    updateProjectiles(game) {
        const p = game.player;
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const pr = this.projectiles[i];
            pr.x += pr.vx;
            pr.y += pr.vy;
            const tx = Math.floor(pr.x + 0.5), ty = Math.floor(pr.y + 0.5);
            if (!game.inBounds(tx, ty) || SOLID_TILES.has(game.currentMap.tiles[ty][tx])) {
                Particles.burst((pr.x + 0.5) * TILE, (pr.y + 0.5) * TILE, '140,40,200', 4, 1, { life: 15, size: 1 });
                this.projectiles.splice(i, 1);
                continue;
            }
            if (Math.abs(pr.x - p.rx) < 0.5 && Math.abs(pr.y - p.ry) < 0.5) {
                if (game.hurt(1)) this.projectiles.splice(i, 1);
            }
        }
    },

    updateHazards(game) {
        const p = game.player;
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const h = this.hazards[i];
            h.t++;
            if (h.t === h.warn) {
                Sfx.erupt();
                Renderer.shake(5, 2);
                Particles.burst((h.x + 0.5) * TILE, (h.y + 0.8) * TILE, '60,0,30', 6, 1.5, { life: 20, glow: false });
            }
            if (h.t >= h.warn && h.t < h.warn + h.active && p.x === h.x && p.y === h.y) game.hurt(1);
            if (h.t > h.warn + h.active + 12) this.hazards.splice(i, 1);
        }
    },

    updateOrbs(game) {
        const p = game.player;
        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const o = this.orbs[i];
            o.t++;
            if (o.x === p.x && o.y === p.y && p.charges < this.MAX_CHARGES) {
                p.charges++;
                Sfx.orb();
                Particles.burst((o.x + 0.5) * TILE, (o.y + 0.5) * TILE, '255,240,160', 16, 2);
                this.orbs.splice(i, 1);
            }
        }
        if (!this.e || this.e.dying || this.e.appear) return;
        if (--this.orbCd > 0) return;
        this.orbCd = 170;
        if (this.orbs.length >= 2 || p.charges + this.orbs.length >= this.MAX_CHARGES) return;

        const e = this.e;
        const spots = [];
        for (let y = 1; y < game.currentMap.height - 1; y++) {
            for (let x = 1; x < game.currentMap.width - 1; x++) {
                if (!game.isFloor(x, y)) continue;
                if (dist({ x, y }, e) < 4 || (x === p.x && y === p.y)) continue;
                if (this.orbs.some(o => o.x === x && o.y === y)) continue;
                spots.push({ x, y });
            }
        }
        if (spots.length) {
            const s = pick(spots);
            this.orbs.push({ x: s.x, y: s.y, t: 0 });
            Particles.burst((s.x + 0.5) * TILE, (s.y + 0.5) * TILE, '255,240,160', 10, 1.5);
        }
    },

    // Called on AZIONE. Returns true when a bolt was thrown.
    tryShoot(game) {
        const p = game.player;
        if (!this.active || !this.e || this.e.dying || p.charges <= 0) return false;
        const d = DIR[p.dir];
        p.charges--;
        this.bolts.push({ x: p.x, y: p.y, vx: d.x * 0.3, vy: d.y * 0.3, life: 90 });
        Sfx.shoot();
        return true;
    },

    updateBolts(game) {
        const e = this.e;
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const b = this.bolts[i];
            // Gentle homing when she is roughly ahead, so aiming on a grid isn't frustrating
            if (e && !e.dying) {
                const tx = e.rx - b.x, ty = e.ry - b.y;
                const len = Math.hypot(tx, ty) || 1;
                if ((tx * b.vx + ty * b.vy) / (len * 0.3) > 0.3) {
                    b.vx += (tx / len) * 0.03;
                    b.vy += (ty / len) * 0.03;
                    const v = Math.hypot(b.vx, b.vy) || 1;
                    b.vx = b.vx / v * 0.3;
                    b.vy = b.vy / v * 0.3;
                }
            }
            b.x += b.vx;
            b.y += b.vy;
            b.life--;
            if (game.frame % 2 === 0) {
                Particles.spawn({ x: (b.x + 0.5) * TILE, y: (b.y + 0.5) * TILE, life: 16, size: 2, color: '255,240,180', glow: true });
            }

            const tx = Math.floor(b.x + 0.5), ty = Math.floor(b.y + 0.5);
            if (b.life <= 0 || !game.inBounds(tx, ty) || SOLID_TILES.has(game.currentMap.tiles[ty][tx])) {
                Particles.burst((b.x + 0.5) * TILE, (b.y + 0.5) * TILE, '255,240,180', 8, 1.5);
                this.bolts.splice(i, 1);
                continue;
            }
            // Light erases her shots
            for (let j = this.projectiles.length - 1; j >= 0; j--) {
                const pr = this.projectiles[j];
                if (Math.abs(pr.x - b.x) < 0.5 && Math.abs(pr.y - b.y) < 0.5) this.projectiles.splice(j, 1);
            }
            // ...and banishes summoned shadows
            const shadow = game.currentEntities.find(s => s.type === 'shadow' && Math.abs((s.rx ?? s.x) - b.x) < 0.6 && Math.abs((s.ry ?? s.y) - b.y) < 0.6);
            if (shadow) {
                Particles.burst(((shadow.rx ?? shadow.x) + 0.5) * TILE, ((shadow.ry ?? shadow.y) + 0.5) * TILE, '80,0,120', 16, 2);
                game.currentEntities.splice(game.currentEntities.indexOf(shadow), 1);
                Sfx.erupt();
                this.bolts.splice(i, 1);
                continue;
            }
            if (e && !e.dying && !e.appear && Math.abs(b.x - e.rx) < 0.75 && Math.abs(b.y - e.ry) < 0.75) {
                this.bolts.splice(i, 1);
                this.damage(game, b);
            }
        }
    },

    damage(game, bolt) {
        const e = this.e;
        e.hp--;
        e.flash = 12;
        e.stun = 28;
        Sfx.bossHit();
        Renderer.shake(10, 4);
        Particles.burst((e.rx + 0.5) * TILE, (e.ry + 0.3) * TILE, '255,255,255', 18, 3);
        Particles.burst((e.rx + 0.5) * TILE, (e.ry + 0.3) * TILE, '200,20,40', 12, 2.5);

        // Knocked back one tile, away from the bolt
        const kx = Math.sign(bolt.vx), ky = Math.sign(bolt.vy);
        const mx = Math.abs(bolt.vx) > Math.abs(bolt.vy) ? kx : 0;
        const my = mx ? 0 : ky;
        if (game.canEnemyEnter(e.x + mx, e.y + my, e)) { e.x += mx; e.y += my; }

        if (e.hp <= 0) {
            e.dying = 170;
            this.projectiles = [];
            this.hazards = [];
            this.queue = [];
            this.orbs = [];
            game.currentEntities = game.currentEntities.filter(s => !s.summoned);
            Sfx.bossDie();
            Music.stop(2);
            game.showBanner('La Dama si dissolve...', 160);
            return;
        }

        const phase = this.phaseFor(e.hp);
        if (phase > e.phase) {
            e.phase = phase;
            e.stun = 70;
            e.atkCd = 90;
            this.projectiles = [];
            this.queue = [];
            Sfx.roar();
            Renderer.shake(35, 6);
            game.showBanner(phase === 2 ? 'La Dama si infuria!' : 'La Dama e\' disperata!', 120);
            if (phase === 3) Music.setTempoScale(1.15);
            game.spawnPetalPickup();
        }
    },

    // ===== DRAW =====
    drawFloor(frame) {
        const ctx = Renderer.ctx;
        for (const h of this.hazards) {
            const px = h.x * TILE, py = h.y * TILE;
            if (h.t < h.warn) {
                const k = h.t / h.warn;
                const pulse = 0.25 + 0.35 * k + Math.sin(h.t * 0.5) * 0.1;
                ctx.fillStyle = `rgba(200,0,30,${pulse})`;
                ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
                ctx.strokeStyle = `rgba(255,60,60,${0.5 + k * 0.5})`;
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
            } else {
                const t = h.t - h.warn;
                const rise = Math.min(1, t / 5);
                const fade = t > h.active ? 1 - (t - h.active) / 12 : 1;
                ctx.fillStyle = `rgba(10,0,5,${0.8 * fade})`;
                ctx.fillRect(px + 4, py + TILE - 8, TILE - 8, 6);
                ctx.save();
                ctx.beginPath();
                ctx.rect(px, py - TILE, TILE, TILE * 2 - 4);
                ctx.clip();
                Renderer.drawData(TileSprites.hand, px, py + TILE * (1 - rise) - 6, TILE, { alpha: fade });
                ctx.restore();
            }
        }
        for (const o of this.orbs) {
            const cx = (o.x + 0.5) * TILE, cy = (o.y + 0.5) * TILE + Math.sin((frame + o.x * 9) * 0.1) * 3;
            ctx.fillStyle = '#fff8d0';
            ctx.beginPath();
            ctx.arc(cx, cy, 5 + Math.sin(frame * 0.2) * 1, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawActor(frame) {
        const e = this.e;
        if (!this.active || !e) return;
        const ctx = Renderer.ctx;
        const size = 52;
        const hover = Math.sin(frame * 0.06) * 3;
        let px = (e.rx + 0.5) * TILE - size / 2;
        let py = (e.ry + 1) * TILE - size - 4 + hover;
        let alpha = 1;
        if (e.appear > 0) {
            alpha = 1 - e.appear / 70;
            py += e.appear * 0.4;
        }
        if (e.dying > 0) {
            alpha = Math.min(1, e.dying / 120);
            px += rng(-3, 3);
        }

        // Shadow on the floor
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.ellipse((e.rx + 0.5) * TILE, (e.ry + 1) * TILE - 4, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        const sprite = e.flash > 0 && e.flash % 4 < 2 ? BossSprites.hurt : BossSprites.frames[Math.floor(frame / 18) % 2];
        Renderer.drawData(sprite, px, py, size, { alpha, flip: e.face < 0 });
    },

    drawProjectiles(frame) {
        const ctx = Renderer.ctx;
        for (const pr of this.projectiles) {
            const cx = (pr.x + 0.5) * TILE, cy = (pr.y + 0.5) * TILE;
            ctx.fillStyle = '#1a0020';
            ctx.beginPath();
            ctx.arc(cx, cy, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#c02060';
            ctx.beginPath();
            ctx.arc(cx, cy, 3 + Math.sin(frame * 0.4) * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const b of this.bolts) {
            const cx = (b.x + 0.5) * TILE, cy = (b.y + 0.5) * TILE;
            ctx.fillStyle = '#fffbe8';
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    lights(frame, out) {
        for (const o of this.orbs) out.push({ x: (o.x + 0.5) * TILE, y: (o.y + 0.5) * TILE, r: 50 });
        for (const b of this.bolts) out.push({ x: (b.x + 0.5) * TILE, y: (b.y + 0.5) * TILE, r: 70 });
        for (const pr of this.projectiles) out.push({ x: (pr.x + 0.5) * TILE, y: (pr.y + 0.5) * TILE, r: 24, strength: 0.5 });
        for (const h of this.hazards) out.push({ x: (h.x + 0.5) * TILE, y: (h.y + 0.5) * TILE, r: 26, strength: 0.6 });
        if (this.active && this.e) out.push({ x: (this.e.rx + 0.5) * TILE, y: this.e.ry * TILE, r: 60, strength: 0.5 });
    },

    drawGlow(frame) {
        for (const o of this.orbs) {
            const cx = (o.x + 0.5) * TILE, cy = (o.y + 0.5) * TILE;
            Renderer.glow(cx, cy, 26, '255,230,140', 0.5 + Math.sin(frame * 0.15) * 0.15);
        }
        for (const b of this.bolts) Renderer.glow((b.x + 0.5) * TILE, (b.y + 0.5) * TILE, 30, '255,240,180', 0.7);
        for (const pr of this.projectiles) Renderer.glow((pr.x + 0.5) * TILE, (pr.y + 0.5) * TILE, 16, '200,30,120', 0.4);
        for (const h of this.hazards) {
            if (h.t < h.warn) Renderer.glow((h.x + 0.5) * TILE, (h.y + 0.5) * TILE, 20, '255,0,30', 0.15 + 0.25 * h.t / h.warn);
        }
        const e = this.e;
        if (this.active && e && !e.dying) {
            const eyeY = (e.ry + 1) * TILE - 52 - 4 + 13 + Math.sin(frame * 0.06) * 3;
            const a = e.phase === 3 ? 0.6 : 0.3;
            Renderer.glow((e.rx + 0.5) * TILE, eyeY, 26, '255,20,40', a + Math.sin(frame * 0.2) * 0.1);
        }
    },

    // Health bar and light charges, drawn last
    drawHUD(game, frame) {
        if (!this.active || !this.e) return;
        const ctx = Renderer.ctx;
        const e = this.e;
        const w = 360, x = (CANVAS_W - w) / 2, y = 26;
        Renderer.drawText(CANVAS_W / 2, 20, this.NAME, '#ff6a7a', 20, 'center');
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x - 3, y - 3, w + 6, 14);
        ctx.fillStyle = '#300';
        ctx.fillRect(x, y, w, 8);
        const k = Math.max(0, e.hp) / this.MAX_HP;
        ctx.fillStyle = e.flash > 0 ? '#fff' : (e.phase === 3 ? '#ff2040' : '#b0102a');
        ctx.fillRect(x, y, w * k, 8);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        for (const t of [4, 8]) ctx.fillRect(x + w * t / this.MAX_HP - 1, y, 2, 8);

        const p = game.player;
        const bx = 14, by = CANVAS_H - 20;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx - 6, by - 18, 132, 28);
        Renderer.drawText(bx, by, 'LUCE', '#ffe9a0', 20);
        for (let i = 0; i < this.MAX_CHARGES; i++) {
            const cx = bx + 62 + i * 20, cy = by - 6;
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fillStyle = i < p.charges ? '#fff6c8' : '#333';
            ctx.fill();
            ctx.strokeStyle = '#a89060';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    },
};
