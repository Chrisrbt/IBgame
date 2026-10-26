// ============================================
// PARTICLES - Ambient effects and bursts
// ============================================

const Particles = {
    list: [],
    MAX: 400,

    clear() {
        this.list.length = 0;
    },

    // x, y in pixels. `glow` particles are drawn additively above the darkness.
    spawn(p) {
        if (this.list.length >= this.MAX) return;
        this.list.push({
            x: p.x, y: p.y,
            vx: p.vx || 0, vy: p.vy || 0,
            ax: p.ax || 0, ay: p.ay || 0,
            life: p.life || 60, max: p.life || 60,
            size: p.size || 2,
            color: p.color || '255,255,255',
            glow: !!p.glow,
            wander: p.wander || 0,
            drag: p.drag === undefined ? 1 : p.drag,
            flicker: !!p.flicker,
        });
    },

    burst(x, y, color, count = 12, speed = 2, opts = {}) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.4 + Math.random() * 0.8);
            this.spawn({
                x, y,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: opts.life || rng(25, 50),
                size: opts.size || rng(2, 3),
                color, glow: opts.glow !== false,
                drag: 0.92, ay: opts.gravity || 0,
            });
        }
    },

    // Called every frame with the current map's ambient style
    ambient(kind) {
        const r = Math.random();
        switch (kind) {
            case 'fireflies':
                if (r < 0.06) {
                    this.spawn({
                        x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H,
                        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
                        life: rng(150, 300), size: 2, color: '200,255,120',
                        glow: true, wander: 0.05, flicker: true,
                    });
                }
                break;
            case 'dust':
                if (r < 0.05) {
                    this.spawn({
                        x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H,
                        vx: (Math.random() - 0.5) * 0.15, vy: 0.08 + Math.random() * 0.1,
                        life: rng(180, 320), size: 1, color: '220,210,190',
                        glow: true, wander: 0.01,
                    });
                }
                break;
            case 'embers':
                if (r < 0.08) {
                    this.spawn({
                        x: Math.random() * CANVAS_W, y: CANVAS_H + 4,
                        vx: (Math.random() - 0.5) * 0.3, vy: -0.3 - Math.random() * 0.5,
                        life: rng(200, 400), size: rng(1, 2),
                        color: Math.random() < 0.5 ? '255,60,40' : '170,60,255',
                        glow: true, wander: 0.03, flicker: true,
                    });
                }
                break;
            case 'spores':
                if (r < 0.05) {
                    this.spawn({
                        x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H,
                        vx: (Math.random() - 0.5) * 0.2, vy: -0.05 - Math.random() * 0.1,
                        life: rng(200, 350), size: 2, color: '80,255,120',
                        glow: true, wander: 0.03, flicker: true,
                    });
                }
                break;
        }
    },

    update() {
        const list = this.list;
        for (let i = list.length - 1; i >= 0; i--) {
            const p = list[i];
            if (p.wander) {
                p.vx += (Math.random() - 0.5) * p.wander;
                p.vy += (Math.random() - 0.5) * p.wander;
            }
            p.vx = (p.vx + p.ax) * p.drag;
            p.vy = (p.vy + p.ay) * p.drag;
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            if (p.life <= 0) list.splice(i, 1);
        }
    },

    draw(ctx, glowLayer) {
        if (glowLayer) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
        }
        for (const p of this.list) {
            if (p.glow !== glowLayer) continue;
            const t = p.life / p.max;
            // Fade in during the first 15% and out during the last 30%
            let a = Math.min(1, (1 - t) / 0.15, t / 0.3);
            if (p.flicker) a *= 0.6 + 0.4 * Math.sin((p.life + p.x) * 0.2);
            if (a <= 0) continue;
            ctx.fillStyle = `rgba(${p.color},${a})`;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
            if (glowLayer && p.size >= 2) {
                ctx.fillStyle = `rgba(${p.color},${a * 0.25})`;
                ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, p.size + 4, p.size + 4);
            }
        }
        if (glowLayer) ctx.restore();
    },
};
