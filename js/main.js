// ============================================
// MAIN - Entry point, input handling, game loop
// ============================================

const UI = {
    screens: ['title-screen', 'game-over-screen', 'victory-screen'],

    show(id) {
        for (const s of this.screens) document.getElementById(s).classList.toggle('hidden', s !== id);
        const primary = id && document.querySelector(`#${id} button:not(.hidden)`);
        if (primary) setTimeout(() => primary.focus(), 50);
    },

    hideAll() {
        this.show(null);
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    },

    refreshTitle() {
        const hasSave = !!Storage.get(SAVE_KEY);
        document.getElementById('continue-btn').classList.toggle('hidden', !hasSave);
    },

    refreshMute() {
        const btn = document.getElementById('mute-btn');
        btn.textContent = '♪';
        btn.classList.toggle('off', AudioCtx.muted);
        btn.title = AudioCtx.muted ? 'Attiva audio (M)' : 'Disattiva audio (M)';
    },
};

(function() {
    'use strict';

    const KEY_DIRS = {
        ArrowUp: 'up', w: 'up', W: 'up',
        ArrowDown: 'down', s: 'down', S: 'down',
        ArrowLeft: 'left', a: 'left', A: 'left',
        ArrowRight: 'right', d: 'right', D: 'right',
    };
    const ACTION_KEYS = new Set([' ', 'Enter', 'z', 'Z', 'x', 'X', 'e', 'E']);

    // Most recently pressed direction wins
    const heldDirs = [];
    let touchDir = null;

    function initGame() {
        Renderer.init();
        Dialogue.init();
        setupInput();
        setupUI();
        Game.showTitle();
        UI.refreshTitle();
        UI.refreshMute();
        Game.updateHUD();
        requestAnimationFrame(loop);
    }

    function action() {
        AudioCtx.init();
        if (Dialogue.isActive()) Dialogue.advance();
        else Game.interact();
    }

    // ===== INPUT =====
    function setupInput() {
        document.addEventListener('keydown', (e) => {
            AudioCtx.init();
            const playing = Game.state === 'play';
            const dir = KEY_DIRS[e.key];

            if (e.key === 'm' || e.key === 'M') {
                AudioCtx.toggleMute();
                UI.refreshMute();
                return;
            }
            if (!playing) return; // menus use normal button focus

            if (dir) {
                e.preventDefault();
                if (!heldDirs.includes(dir)) heldDirs.push(dir);
                // Move right away so even a very short tap counts
                if (!e.repeat) Game.tryMove(dir);
                return;
            }
            if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                Game.togglePause();
                return;
            }
            if (ACTION_KEYS.has(e.key)) {
                e.preventDefault();
                if (e.repeat) return;
                action();
            }
        });

        document.addEventListener('keyup', (e) => {
            const dir = KEY_DIRS[e.key];
            if (dir) {
                const i = heldDirs.indexOf(dir);
                if (i >= 0) heldDirs.splice(i, 1);
            }
        });

        window.addEventListener('blur', () => {
            heldDirs.length = 0;
            touchDir = null;
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && Game.state === 'play' && !Game.paused) Game.togglePause();
        });

        // On-screen pad: hold a direction to keep walking
        document.querySelectorAll('.ctrl-btn').forEach(btn => {
            const dir = btn.dataset.dir;
            const press = (e) => {
                e.preventDefault();
                AudioCtx.init();
                btn.classList.add('pressed');
                if (dir === 'action') {
                    action();
                } else {
                    touchDir = dir;
                    Game.tryMove(dir);
                }
            };
            const release = (e) => {
                btn.classList.remove('pressed');
                if (touchDir === dir) touchDir = null;
            };
            btn.addEventListener('pointerdown', press);
            btn.addEventListener('pointerup', release);
            btn.addEventListener('pointercancel', release);
            btn.addEventListener('pointerleave', release);
        });

        // Swipe to move, tap to interact
        let startX = 0, startY = 0, startT = 0;
        const canvas = document.getElementById('game-canvas');
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            AudioCtx.init();
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startT = performance.now();
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (Game.state !== 'play') return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
                if (performance.now() - startT < 400) action();
                return;
            }
            if (Dialogue.isActive()) return;
            if (Math.abs(dx) > Math.abs(dy)) Game.tryMove(dx > 0 ? 'right' : 'left');
            else Game.tryMove(dy > 0 ? 'down' : 'up');
        }, { passive: false });

        canvas.addEventListener('click', () => {
            if (Game.state === 'play' && Game.paused) Game.togglePause();
        });
    }

    function processHeldInput() {
        const dir = heldDirs[heldDirs.length - 1] || touchDir;
        if (dir) Game.tryMove(dir);
    }

    // ===== UI =====
    function setupUI() {
        const on = (id, fn) => document.getElementById(id).addEventListener('click', (e) => {
            AudioCtx.init();
            e.currentTarget.blur();
            fn();
        });

        on('start-btn', () => {
            UI.hideAll();
            Game.newGame();
        });
        on('continue-btn', () => {
            UI.hideAll();
            Game.continueGame();
        });
        on('restart-btn', () => {
            UI.hideAll();
            Game.respawn();
        });
        on('menu-btn', () => {
            Game.showTitle();
            UI.refreshTitle();
            UI.show('title-screen');
        });
        on('again-btn', () => {
            Game.showTitle();
            UI.refreshTitle();
            UI.show('title-screen');
        });
        on('mute-btn', () => {
            AudioCtx.toggleMute();
            UI.refreshMute();
        });
        on('pause-btn', () => Game.togglePause());

        // Title music needs a first gesture before the browser lets audio play
        const unlock = () => {
            AudioCtx.init();
            document.removeEventListener('pointerdown', unlock);
        };
        document.addEventListener('pointerdown', unlock);

        document.addEventListener('contextmenu', (e) => e.preventDefault());
        // Recompute canvas size once fonts and layout settle
        setTimeout(() => Renderer.resize(), 100);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => Renderer.resize());
    }

    // ===== GAME LOOP (fixed 60 Hz simulation, render every frame) =====
    let last = performance.now();
    let acc = 0;

    function loop(now) {
        requestAnimationFrame(loop);
        acc += Math.min(250, now - last);
        last = now;

        let steps = 0;
        while (acc >= STEP_MS && steps < 5) {
            processHeldInput();
            Game.update();
            acc -= STEP_MS;
            steps++;
        }
        if (steps === 5) acc = 0;

        Dialogue.update(now);
        Game.render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGame);
    } else {
        initGame();
    }
})();
