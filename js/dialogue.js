// ============================================
// DIALOGUE - Text display system
// ============================================

const SPEAKER_COLORS = {
    'Nonna Maria': '#c9a0ff',
    'La Dama': '#ff4a5a',
};

const Dialogue = {
    box: null,
    textEl: null,
    nameEl: null,
    active: false,
    queue: [],
    currentText: '',
    charIndex: 0,
    typeSpeed: 28, // ms per character
    lastCharTime: 0,
    callback: null,
    openedAt: 0,

    init() {
        this.box = document.getElementById('dialogue-box');
        this.textEl = document.getElementById('dialogue-text');
        this.nameEl = document.getElementById('dialogue-name');

        this.box.addEventListener('click', () => this.advance());
        this.box.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.advance();
        }, { passive: false });
    },

    reset() {
        this.active = false;
        this.queue = [];
        this.callback = null;
        this.box.classList.add('hidden');
    },

    show(text, callback) {
        if (this.active) {
            this.queue.push({ text, callback });
            return;
        }
        // "Speaker: text" puts the name in its own label
        const m = /^([A-Z][A-Za-z' ]{1,20}): (.*)$/s.exec(text);
        if (m && SPEAKER_COLORS[m[1]]) {
            this.nameEl.textContent = m[1];
            this.nameEl.style.color = SPEAKER_COLORS[m[1]];
            this.nameEl.classList.remove('hidden');
            text = m[2].replace(/^"(.*)"$/s, '$1');
        } else {
            this.nameEl.classList.add('hidden');
        }

        this.active = true;
        this.currentText = text;
        this.charIndex = 0;
        this.callback = callback || null;
        this.textEl.textContent = '';
        // Keep the box away from the player
        const p = typeof Game !== 'undefined' ? Game.player : null;
        this.box.classList.toggle('top', !!p && p.ry > ROWS / 2);
        this.box.classList.remove('hidden');
        this.box.classList.remove('done');
        this.lastCharTime = 0;
        this.openedAt = performance.now();
    },

    advance() {
        if (!this.active) return;
        // Ignore the tap that opened the box
        if (performance.now() - this.openedAt < 150) return;

        if (this.charIndex < this.currentText.length) {
            this.charIndex = this.currentText.length;
            this.textEl.textContent = this.currentText;
            this.box.classList.add('done');
        } else {
            this.close();
        }
    },

    close() {
        this.active = false;
        this.box.classList.add('hidden');
        const cb = this.callback;
        this.callback = null;
        if (cb) cb();
        // A callback may already have opened the next line
        if (!this.active && this.queue.length > 0) {
            const next = this.queue.shift();
            this.show(next.text, next.callback);
        }
    },

    update(time) {
        if (!this.active) return;
        if (this.charIndex >= this.currentText.length) return;

        if (time - this.lastCharTime > this.typeSpeed) {
            this.charIndex++;
            this.textEl.textContent = this.currentText.substring(0, this.charIndex);
            this.lastCharTime = time;
            if (this.charIndex % 3 === 0 && this.currentText[this.charIndex - 1] !== ' ') Sfx.blip();
            if (this.charIndex >= this.currentText.length) this.box.classList.add('done');
        }
    },

    isActive() {
        return this.active;
    }
};
