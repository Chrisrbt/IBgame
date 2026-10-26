// ============================================
// RENDERER - Pixel art drawing engine
// ============================================

const Renderer = {
    canvas: null,
    ctx: null,
    shakeTimer: 0,
    shakeMag: 3,
    shaking: false,
    darkness: 0, // 0 = full light, 1 = pitch dark
    tint: null,  // {r,g,b,a} color overlay
    lightCanvas: null,
    lightCtx: null,
    vignette: null,
    spriteCache: new WeakMap(),

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CANVAS_W;
        this.canvas.height = CANVAS_H;
        this.ctx.imageSmoothingEnabled = false;

        this.lightCanvas = document.createElement('canvas');
        this.lightCanvas.width = CANVAS_W;
        this.lightCanvas.height = CANVAS_H;
        this.lightCtx = this.lightCanvas.getContext('2d');

        this.vignette = this.buildVignette();

        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    },

    // Fit the canvas between the HUD and the touch controls, keeping the aspect ratio
    resize() {
        const hud = document.getElementById('hud');
        const controls = document.getElementById('mobile-controls');
        const hudH = hud ? hud.offsetHeight : 0;
        const ctrlH = (controls && getComputedStyle(controls).display !== 'none') ? controls.offsetHeight : 0;
        const maxW = window.innerWidth - 16;
        const maxH = window.innerHeight - hudH - ctrlH - 28;
        const scale = Math.max(0.3, Math.min(maxW / CANVAS_W, maxH / CANVAS_H));
        this.canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
        this.canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
    },

    buildVignette() {
        const c = document.createElement('canvas');
        c.width = CANVAS_W;
        c.height = CANVAS_H;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(
            CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.35,
            CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.65)');
        g.fillStyle = grad;
        g.fillRect(0, 0, CANVAS_W, CANVAS_H);
        return c;
    },

    clear() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    },

    shake(frames, mag = 3) {
        this.shakeTimer = Math.max(this.shakeTimer, frames);
        this.shakeMag = mag;
    },

    // Shake is always paired: beginFrame saves, endFrame restores
    beginFrame() {
        this.ctx.save();
        if (this.shakeTimer > 0) {
            const s = this.shakeMag * Math.min(1, this.shakeTimer / 10);
            this.ctx.translate(Math.round((Math.random() * 2 - 1) * s), Math.round((Math.random() * 2 - 1) * s));
            this.shakeTimer--;
        }
    },

    endFrame() {
        this.ctx.restore();
    },

    // Turn a pixel array into a tiny canvas once, then blit it scaled
    toCanvas(data) {
        let c = this.spriteCache.get(data);
        if (c) return c;
        const h = data.length;
        const w = data[0].length;
        c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        for (let r = 0; r < h; r++) {
            for (let col = 0; col < w; col++) {
                const color = data[r][col];
                if (color && color !== '.') {
                    g.fillStyle = color;
                    g.fillRect(col, r, 1, 1);
                }
            }
        }
        this.spriteCache.set(data, c);
        return c;
    },

    // Draw pixel data at a pixel position. `size` is the drawn width.
    drawData(data, px, py, size = TILE, { flip = false, alpha = 1, ctx = this.ctx } = {}) {
        const c = this.toCanvas(data);
        const h = size * c.height / c.width;
        if (alpha !== 1) ctx.globalAlpha = alpha;
        if (flip) {
            ctx.save();
            ctx.translate(Math.round(px + size), Math.round(py));
            ctx.scale(-1, 1);
            ctx.drawImage(c, 0, 0, size, h);
            ctx.restore();
        } else {
            ctx.drawImage(c, Math.round(px), Math.round(py), size, h);
        }
        if (alpha !== 1) ctx.globalAlpha = 1;
    },

    drawTile(x, y, data, ctx = this.ctx) {
        this.drawData(data, x * TILE, y * TILE, TILE, { ctx });
    },

    drawRect(x, y, color, ctx = this.ctx) {
        ctx.fillStyle = color;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
    },

    drawText(x, y, text, color = '#fff', size = 12, align = 'left') {
        this.ctx.fillStyle = color;
        this.ctx.font = `${size}px "VT323", "Courier New", monospace`;
        this.ctx.textAlign = align;
        this.ctx.fillText(text, x, y);
        this.ctx.textAlign = 'left';
    },

    // Soft round glow, additive
    glow(px, py, radius, rgb, alpha) {
        const ctx = this.ctx;
        const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
        g.addColorStop(0, `rgba(${rgb},${alpha})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
        ctx.restore();
    },

    // Darkness with holes cut out for every light source: [{x, y, r}] in pixels
    applyLighting(lights) {
        if (this.darkness <= 0) return;
        const l = this.lightCtx;
        l.globalCompositeOperation = 'source-over';
        l.clearRect(0, 0, CANVAS_W, CANVAS_H);
        l.fillStyle = `rgba(0,0,0,${this.darkness})`;
        l.fillRect(0, 0, CANVAS_W, CANVAS_H);
        l.globalCompositeOperation = 'destination-out';
        for (const light of lights) {
            const g = l.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
            const s = light.strength === undefined ? 1 : light.strength;
            g.addColorStop(0, `rgba(0,0,0,${s})`);
            g.addColorStop(0.55, `rgba(0,0,0,${s * 0.75})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            l.fillStyle = g;
            l.fillRect(light.x - light.r, light.y - light.r, light.r * 2, light.r * 2);
        }
        this.ctx.drawImage(this.lightCanvas, 0, 0);
    },

    applyTint() {
        if (!this.tint) return;
        this.ctx.fillStyle = `rgba(${this.tint.r},${this.tint.g},${this.tint.b},${this.tint.a})`;
        this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    },

    applyVignette() {
        this.ctx.drawImage(this.vignette, 0, 0);
    },

    fadeRect(alpha, color = '0,0,0') {
        if (alpha <= 0) return;
        this.ctx.fillStyle = `rgba(${color},${alpha})`;
        this.ctx.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40);
    },
};
