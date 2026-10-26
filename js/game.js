// ============================================
// GAME - Main game engine
// ============================================

const SAVE_KEY = 'nelbosco_save';

const Game = {
    state: 'title', // title | play | dead | victory
    paused: false,
    player: { x: 0, y: 0, fromX: 0, fromY: 0, rx: 0, ry: 0, dir: 'up', iframes: 0, charges: 0, step: 0 },
    petals: 5,
    maxPetals: 5,
    currentMap: null,
    currentMapName: '',
    currentEntities: [],
    mapCanvas: null,
    inventory: [],
    inventoryNames: {},
    solvedPuzzles: [],
    visited: [],
    flags: {},
    frame: 0,
    moveTimer: 0,
    moveDelay: 9, // frames per tile
    bumpCd: 0,
    transition: null,
    schedules: [],
    checkpoint: null,
    playFrames: 0,
    deaths: 0,
    hurtFlash: 0,
    banner: null,
    endT: 0,

    get gameStarted() {
        return this.state !== 'title';
    },

    // ===== GAME FLOW =====
    showTitle() {
        this.state = 'title';
        this.setPaused(false);
        Boss.reset();
        Dialogue.reset();
        this.loadScenery('forest');
        Music.play('title');
    },

    resetProgress() {
        this.inventory = [];
        this.inventoryNames = {};
        this.solvedPuzzles = [];
        this.visited = [];
        this.flags = {};
        this.petals = this.maxPetals;
        this.playFrames = 0;
        this.deaths = 0;
        this.player.charges = 0;
        Puzzles.reset();
    },

    newGame() {
        Storage.remove(SAVE_KEY);
        this.resetProgress();
        this.startPlaying();
        this.loadMap('forest');
        this.saveCheckpoint();
        this.schedule(40, () => {
            this.say([
                "Devo trovare la casa della nonna... il bosco e' cosi' buio stasera...",
                "Non risponde al telefono da giorni. Da quando il nonno e' scomparso vive da sola.",
                "In tasca ho la rosa che mi ha regalato. Finche' ha i suoi petali, mi sento al sicuro.",
            ]);
        });
    },

    continueGame() {
        const save = Storage.get(SAVE_KEY);
        if (!save || !Maps[save.map]) { this.newGame(); return; }
        this.resetProgress();
        this.restoreCheckpoint(save);
        this.startPlaying();
        this.loadMap(save.map, { x: save.x, y: save.y });
        this.saveCheckpoint();
    },

    respawn() {
        if (!this.checkpoint) { this.newGame(); return; }
        const cp = this.checkpoint;
        const deaths = this.deaths;
        const playFrames = this.playFrames;
        const introSeen = this.flags.bossIntroSeen;
        this.resetProgress();
        this.restoreCheckpoint(cp);
        this.deaths = deaths;
        this.playFrames = playFrames;
        if (introSeen) this.flags.bossIntroSeen = true;
        this.startPlaying();
        this.loadMap(cp.map, { x: cp.x, y: cp.y });
        this.showBanner('Riprova...', 90);
    },

    startPlaying() {
        this.state = 'play';
        this.setPaused(false);
        this.endT = 0;
        this.hurtFlash = 0;
        this.transition = null;
        Dialogue.reset();
        this.updateHUD();
    },

    saveCheckpoint() {
        this.checkpoint = {
            map: this.currentMapName,
            x: this.player.x, y: this.player.y,
            inventory: [...this.inventory],
            inventoryNames: { ...this.inventoryNames },
            solved: [...this.solvedPuzzles],
            leverState: { ...Puzzles.leverState },
            visited: [...this.visited],
            flags: { ...this.flags },
            playFrames: this.playFrames,
            deaths: this.deaths,
        };
        Storage.set(SAVE_KEY, this.checkpoint);
    },

    restoreCheckpoint(cp) {
        this.inventory = [...(cp.inventory || [])];
        this.inventoryNames = { ...(cp.inventoryNames || {}) };
        this.solvedPuzzles = [...(cp.solved || [])];
        Puzzles.leverState = { ...(cp.leverState || {}) };
        this.visited = [...(cp.visited || [])];
        this.flags = { ...(cp.flags || {}) };
        this.playFrames = cp.playFrames || 0;
        this.deaths = cp.deaths || 0;
        this.petals = this.maxPetals;
        this.checkpoint = cp;
    },

    togglePause() {
        if (this.state !== 'play') return;
        this.setPaused(!this.paused);
    },

    setPaused(paused) {
        this.paused = paused;
        if (AudioCtx.ctx) {
            if (paused) AudioCtx.ctx.suspend();
            else AudioCtx.ctx.resume();
        }
    },

    // ===== MAPS =====
    // Title screen backdrop: a map without the player
    loadScenery(name) {
        const map = Maps[name];
        this.currentMap = map;
        this.currentMapName = name;
        this.currentEntities = [];
        Renderer.darkness = map.darkness;
        Renderer.tint = map.tint || null;
        Particles.clear();
        this.buildMapCanvas();
    },

    loadMap(name, pos) {
        const map = Maps[name];
        if (!map) return;
        this.currentMap = map;
        this.currentMapName = name;
        const start = pos || map.playerStart;
        const p = this.player;
        p.x = p.fromX = p.rx = start.x;
        p.y = p.fromY = p.ry = start.y;
        p.iframes = 40; // short grace period when entering a room
        p.charges = 0;
        this.moveTimer = 0;
        this.schedules = [];
        Renderer.darkness = map.darkness || 0;
        Renderer.tint = map.tint || null;
        Boss.reset();
        Particles.clear();
        Music.setTempoScale(1);

        const solved = id => this.solvedPuzzles.includes(id);
        this.currentEntities = map.entities.map(e => {
            const copy = { ...e };
            if (e.patrol) copy.patrol = e.patrol.map(pt => ({ ...pt }));
            if (this.inventory.includes(e.id)) copy.collected = true;
            if (e.type === 'lever') copy.on = !!Puzzles.leverState[e.id];
            if (e.id === 'crystal_blue' && solved('west_levers')) copy.hidden = false;
            if (e.id === 'crystal_red' && solved('east_pattern')) copy.hidden = false;
            if (e.type === 'floor_btn' && solved('east_pattern')) copy.pressed = true;
            if (e.id === 'exit_portal' && this.flags.bossDefeated) copy.hidden = false;
            return copy;
        });
        if (map.entities.some(e => e.type === 'floor_btn') && !solved('east_pattern')) {
            Puzzles.floorBtnSequence = [];
        }

        this.buildMapCanvas();
        Music.play(this.flags.bossDefeated && name === 'otherworld_final' ? 'calm' : map.music);
        this.showBanner(map.title, 150);
        this.updateHUD();
    },

    // Static tiles are drawn once per map into an offscreen canvas
    buildMapCanvas() {
        const map = this.currentMap;
        if (!this.mapCanvas) {
            this.mapCanvas = document.createElement('canvas');
            this.mapCanvas.width = CANVAS_W;
            this.mapCanvas.height = CANVAS_H;
        }
        const ctx = this.mapCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                this.drawMapTile(ctx, map.tiles[y][x], x, y);
            }
        }
        // Soft shadow under walls for depth
        for (let y = 1; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                const above = map.tiles[y - 1][x];
                const here = map.tiles[y][x];
                if ((above === 1 || above === 7) && !SOLID_TILES.has(here)) {
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.fillRect(x * TILE, y * TILE, TILE, 6);
                }
            }
        }
    },

    drawMapTile(ctx, tile, x, y) {
        const map = this.currentMap;
        const other = map.theme === 'other';
        const h = hash2(x, y, this.currentMapName.length);
        const floor = () => {
            if (other) {
                Renderer.drawTile(x, y, h < 0.04 ? TileSprites.voidEye : h < 0.09 ? TileSprites.voidBlood : TileSprites.voidFloor, ctx);
                return;
            }
            const ind = map.indoor;
            if (ind && x >= ind.x1 && x <= ind.x2 && y >= ind.y1 && y <= ind.y2) {
                Renderer.drawTile(x, y, TileSprites.houseFloor, ctx);
                return;
            }
            let t = TileSprites.grass[h < 0.3 ? 1 : 0];
            if (h > 0.97) t = TileSprites.mushroom;
            else if (h > 0.95) t = TileSprites.grassFlowerRed;
            else if (h > 0.93) t = TileSprites.grassFlowerWhite;
            else if (h > 0.915) t = TileSprites.grassFlowerBlue;
            Renderer.drawTile(x, y, t, ctx);
        };

        switch (tile) {
            case 0: case 6: case 9:
                floor();
                break;
            case 1:
                if (other) Renderer.drawTile(x, y, h < 0.72 ? TileSprites.brickWall : TileSprites.fleshWall, ctx);
                else Renderer.drawTile(x, y, TileSprites.stoneWall, ctx);
                break;
            case 2:
                Renderer.drawTile(x, y, TileSprites.grass[1], ctx);
                Renderer.drawTile(x, y, TileSprites.tree, ctx);
                break;
            case 3:
                Renderer.drawTile(x, y, TileSprites.path, ctx);
                break;
            case 4:
                Renderer.drawTile(x, y, other ? TileSprites.darkDoor : TileSprites.door, ctx);
                break;
            case 5:
                Renderer.drawRect(x, y, '#1a3a6b', ctx);
                break;
            case 7:
                Renderer.drawTile(x, y, y <= 2 ? TileSprites.roof : TileSprites.houseWall, ctx);
                break;
            case 8:
                Renderer.drawTile(x, y, TileSprites.houseFloor, ctx);
                Renderer.drawTile(x, y, TileSprites.trapdoor, ctx);
                break;
        }
    },

    // ===== QUERIES =====
    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.currentMap.width && y < this.currentMap.height;
    },

    entityAt(x, y, filter) {
        return this.currentEntities.find(e => e.x === x && e.y === y && (!filter || filter(e)));
    },

    // Empty walkable floor (no doors, no solid things): used for spawning
    isFloor(x, y) {
        if (!this.inBounds(x, y)) return false;
        const t = this.currentMap.tiles[y][x];
        if (SOLID_TILES.has(t) || t === 4 || t === 8) return false;
        return !this.entityAt(x, y, e => Entities.isSolid(e));
    },

    isWalkable(x, y) {
        if (!this.inBounds(x, y)) return false;
        if (SOLID_TILES.has(this.currentMap.tiles[y][x])) return false;
        return !this.entityAt(x, y, e => Entities.isSolid(e));
    },

    canEnemyEnter(x, y, self) {
        if (!this.isFloor(x, y)) return false;
        if (this.currentEntities.some(e => e !== self && e.type === 'shadow' && e.x === x && e.y === y)) return false;
        if (Boss.active && Boss.e && Boss.e !== self && Boss.e.x === x && Boss.e.y === y) return false;
        return true;
    },

    canAct() {
        return this.state === 'play' && !this.paused && !this.transition && !Dialogue.isActive();
    },

    // ===== PLAYER =====
    movePlayer(dir) {
        this.tryMove(dir);
    },

    tryMove(dir) {
        if (!this.canAct() || this.moveTimer > 0) return;
        const d = DIR[dir];
        if (!d) return;
        const p = this.player;
        p.dir = dir;

        const nx = p.x + d.x;
        const ny = p.y + d.y;
        if (!this.isWalkable(nx, ny)) {
            if (this.bumpCd <= 0) {
                Sfx.bump();
                this.bumpCd = 14;
            }
            return;
        }

        p.fromX = p.x;
        p.fromY = p.y;
        p.x = nx;
        p.y = ny;
        p.step++;
        this.moveTimer = this.moveDelay;
        Sfx.step(this.currentMap.theme !== 'forest');

        this.checkInteractions();
        this.checkTransitions();
        this.checkEnemies();
    },

    // Undo the last step with a little bounce animation
    pushBack() {
        const p = this.player;
        const bx = p.x, by = p.y;
        p.x = p.fromX;
        p.y = p.fromY;
        p.fromX = bx;
        p.fromY = by;
        this.moveTimer = this.moveDelay;
    },

    interact() {
        if (!this.canAct()) return;
        if (Boss.active && Boss.tryShoot(this)) return;

        const p = this.player;
        const d = DIR[p.dir];
        // Facing tile first, then where we stand, then the other neighbours
        const positions = [
            { x: p.x + d.x, y: p.y + d.y },
            { x: p.x, y: p.y },
            { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y },
            { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 },
        ];
        for (const pos of positions) {
            const e = this.entityAt(pos.x, pos.y, en => Entities.isInteractable(en));
            if (e) {
                this.interactWith(e);
                return;
            }
        }
    },

    interactWith(entity) {
        const cx = entity.x * TILE + TILE / 2, cy = entity.y * TILE + TILE / 2;
        switch (entity.type) {
            case 'note':
            case 'painting':
                if (entity.text) Dialogue.show(entity.text);
                break;
            case 'key':
                entity.collected = true;
                this.addToInventory(entity.id, entity.name || 'Chiave');
                Sfx.pickup();
                Particles.burst(cx, cy, '255,210,80', 16, 2);
                Dialogue.show(entity.text || "Hai trovato una chiave!");
                break;
            case 'crystal': {
                entity.collected = true;
                const names = { blue: 'Cristallo Blu', red: 'Cristallo Rosso', green: 'Cristallo Verde' };
                this.addToInventory(entity.id, names[entity.color] || 'Cristallo');
                Sfx.crystal();
                Renderer.shake(8, 2);
                Particles.burst(cx, cy, CRYSTAL_RGB[entity.color], 30, 3);
                const lines = [entity.text || "Hai trovato un cristallo!"];
                if (Puzzles.canEnterFinal(this)) {
                    lines.push("Hai tutti e tre i cristalli! La porta del Nord, nella sala principale, ora si aprira'.");
                } else {
                    const n = ['crystal_blue', 'crystal_red', 'crystal_green'].filter(id => this.inventory.includes(id)).length;
                    lines.push(`Cristalli raccolti: ${n} su 3.`);
                }
                this.say(lines);
                this.saveCheckpoint();
                break;
            }
            case 'lever':
                Puzzles.toggleLever(entity, this);
                if (this.solvedPuzzles.includes('west_levers')) this.saveCheckpoint();
                break;
            case 'vase':
                if (this.petals < this.maxPetals) {
                    this.petals = this.maxPetals;
                    this.updateHUD();
                    Sfx.heal();
                    Particles.burst(cx, cy - 8, '255,80,100', 20, 2, { gravity: -0.02 });
                    Dialogue.show("Immergi lo stelo della rosa nell'acqua del vaso... i petali tornano a fiorire!");
                } else {
                    Dialogue.show("Un vaso con dell'acqua fresca. La tua rosa e' gia' in piena salute.");
                }
                break;
            case 'nonna':
                this.talkToNonna(entity);
                break;
        }
    },

    talkToNonna(nonna) {
        if (this.flags.bossDefeated) {
            Dialogue.show("Nonna Maria: \"Il portale e' aperto, tesoro. Andiamo a casa.\"");
            return;
        }
        if (Boss.active) return;
        const lines = this.flags.bossIntroSeen ? [
            "Nonna Maria: \"Nipote mio... attento! Sta tornando!\"",
        ] : [
            "Nonna! Ti ho trovata! Stai bene?",
            "Nonna Maria: \"Nipote mio... sei venuto a cercarmi. Ma non dovevi... questo posto e' una trappola.\"",
            "Nonna Maria: \"Tuo nonno aveva rinchiuso una creatura in un quadro, tanti anni fa. La Dama. Quando lui e' scomparso, lei si e' liberata...\"",
            "Nonna Maria: \"Mi ha trascinata qui sotto per... aspetta. Senti anche tu? Sta arrivando!\"",
        ];
        this.say(lines, () => this.startBossFight(nonna));
    },

    startBossFight(nonna) {
        const first = !this.flags.bossIntroSeen;
        this.flags.bossIntroSeen = true;
        nonna.caged = true;
        Sfx.scary();
        Renderer.shake(45, 6);
        this.hurtFlash = 0;
        Boss.start(this, 10, 6);
        this.schedule(80, () => {
            const lines = ["La Dama: \"Lei e' MIA. E presto lo sarai anche tu... resterai per sempre nei miei quadri.\""];
            if (first) {
                lines.push("Raccogli le sfere di luce camminandoci sopra, poi premi AZIONE (Spazio / Z / il tasto rosso) per lanciarle nella direzione in cui guardi!");
                lines.push("Evita i suoi colpi e le caselle rosse: da li' escono delle mani!");
            }
            this.say(lines);
        });
    },

    onBossDefeated() {
        this.flags.bossDefeated = true;
        const nonna = this.currentEntities.find(e => e.type === 'nonna');
        if (nonna) nonna.caged = false;
        const portal = this.currentEntities.find(e => e.id === 'exit_portal');
        if (portal) portal.hidden = false;
        this.currentEntities = this.currentEntities.filter(e => e.type !== 'shadow');
        this.petals = this.maxPetals;
        this.updateHUD();
        Sfx.portal();
        Music.play('calm');
        this.schedule(40, () => {
            this.say([
                "Nonna Maria: \"Ce l'hai fatta... la Dama e' tornata nel suo quadro. Questa volta per sempre.\"",
                "Nonna Maria: \"Tuo nonno sarebbe fiero di te. Guarda, il portale si e' aperto! Entriamo insieme.\"",
            ]);
        });
    },

    checkInteractions() {
        const p = this.player;
        for (const e of this.currentEntities) {
            if (e.x !== p.x || e.y !== p.y) continue;
            if (e.type === 'floor_btn') {
                Puzzles.stepFloorBtn(e, this);
                if (this.solvedPuzzles.includes('east_pattern')) this.saveCheckpoint();
            }
            if (e.type === 'petal' && !e.collected) {
                e.collected = true;
                this.petals = Math.min(this.maxPetals, this.petals + 2);
                this.updateHUD();
                Sfx.heal();
                Particles.burst(e.x * TILE + 16, e.y * TILE + 16, '255,80,100', 14, 2);
            }
            if (e.type === 'portal' && !e.hidden && this.flags.bossDefeated) {
                this.victory();
            }
        }
    },

    checkTransitions() {
        const transitions = this.currentMap.transitions;
        if (!transitions) return;
        const p = this.player;
        const t = transitions.find(tr => tr.x === p.x && tr.y === p.y);
        if (!t) return;

        if (t.needCrystals && !Puzzles.canEnterFinal(this)) {
            const n = ['crystal_blue', 'crystal_red', 'crystal_green'].filter(id => this.inventory.includes(id)).length;
            Sfx.locked();
            this.pushBack();
            Dialogue.show(`La porta e' sigillata da tre serrature colorate: Rosso, Blu e Verde. (Cristalli: ${n}/3)`);
            return;
        }
        if (t.needItem && !this.inventory.includes(t.needItem)) {
            Sfx.locked();
            this.pushBack();
            Dialogue.show(t.lockedText || "E' chiuso a chiave.");
            return;
        }
        this.startTransition(t);
    },

    checkEnemies() {
        if (this.state !== 'play') return;
        const p = this.player;
        for (const e of this.currentEntities) {
            if (e.type === 'shadow' && e.x === p.x && e.y === p.y && !(e.stun > 0)) {
                if (this.hurt(1)) e.stun = 80;
                return;
            }
        }
    },

    // Returns true when damage was dealt
    hurt(amount) {
        const p = this.player;
        if (this.state !== 'play' || p.iframes > 0) return false;
        this.petals = Math.max(0, this.petals - amount);
        p.iframes = 100;
        this.hurtFlash = 18;
        Sfx.hurt();
        Renderer.shake(14, 4);
        for (let i = 0; i < 8; i++) {
            Particles.spawn({
                x: p.rx * TILE + 16, y: p.ry * TILE + 12,
                vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2,
                ay: 0.08, drag: 0.97, life: 50, size: 3, color: '220,30,50', glow: false,
            });
        }
        this.updateHUD();
        if (this.petals <= 0) this.die();
        return true;
    },

    spawnPetalPickup() {
        const p = this.player;
        const spots = [];
        for (let y = 1; y < this.currentMap.height - 1; y++) {
            for (let x = 1; x < this.currentMap.width - 1; x++) {
                const d = dist({ x, y }, p);
                if (d >= 3 && d <= 7 && this.isFloor(x, y) && !this.entityAt(x, y)) spots.push({ x, y });
            }
        }
        if (!spots.length) return;
        const s = pick(spots);
        this.currentEntities.push({ type: 'petal', x: s.x, y: s.y, id: 'petal_' + this.frame });
        Particles.burst(s.x * TILE + 16, s.y * TILE + 16, '255,80,100', 14, 2);
    },

    // ===== TRANSITIONS =====
    startTransition(t) {
        this.transition = { phase: 'out', alpha: 0, target: t };
        if (t.isTrap) {
            Sfx.scary();
            Renderer.shake(30, 5);
            if (t.dialogue) Dialogue.show(t.dialogue);
        } else {
            Sfx.door();
        }
    },

    updateTransition() {
        const tr = this.transition;
        if (!tr) return;
        if (tr.phase === 'out') {
            tr.alpha += tr.target.isTrap ? 0.025 : 0.06;
            if (tr.alpha >= 1) {
                tr.alpha = 1;
                // A trap's dialogue stays open over the black screen until read
                if (Dialogue.isActive()) return;
                const t = tr.target;
                this.loadMap(t.to, { x: t.toX, y: t.toY });
                this.saveCheckpoint();
                tr.phase = 'in';
                this.showMapIntro(t.to);
            }
        } else {
            tr.alpha -= 0.06;
            if (tr.alpha <= 0) this.transition = null;
        }
    },

    showMapIntro(mapName) {
        if (this.visited.includes(mapName)) return;
        this.visited.push(mapName);
        const intros = {
            house_exterior: [
                "Questa e' la casa della nonna... sembra abbandonata da tempo.",
                "La porta e' aperta. Dentro e' tutto sottosopra. C'e' qualcosa sul pavimento... una botola?",
            ],
            otherworld_hall: [
                "Dove... dove sono?! Questo posto non ha senso!",
                "Le pareti pulsano come se fossero vive. Devo trovare la nonna e uscire da qui!",
                "Se le ombre mi toccano, la mia rosa perdera' un petalo. I vasi d'acqua possono farla rifiorire.",
            ],
            otherworld_west: ["Una stanza piena di leve... ci dev'essere un meccanismo da attivare."],
            otherworld_east: ["Piastrelle colorate sul pavimento... forse devo calpestarle in un ordine preciso."],
            otherworld_secret: ["Un labirinto... non vedo quasi nulla. Meglio procedere con cautela."],
            otherworld_gallery: ["Quadri ovunque... sembrano tutti osservarmi. Almeno qui le ombre non entrano."],
            otherworld_final: ["La nonna! E' li'! Sembra immobile... devo raggiungerla!"],
        };
        if (intros[mapName]) this.schedule(25, () => this.say(intros[mapName]));
    },

    // ===== HELPERS =====
    // Run fn after n frames of active gameplay
    schedule(frames, fn) {
        this.schedules.push({ t: frames, fn });
    },

    say(lines, onDone) {
        const next = i => {
            if (i >= lines.length) { if (onDone) onDone(); return; }
            Dialogue.show(lines[i], () => next(i + 1));
        };
        next(0);
    },

    showDialogue(text, callback) {
        Dialogue.show(text, callback);
    },

    showBanner(text, frames = 120) {
        this.banner = { text, t: frames, max: frames };
    },

    addToInventory(id, name) {
        if (!this.inventory.includes(id)) {
            this.inventory.push(id);
            this.inventoryNames[id] = name;
            this.updateHUD();
        }
    },

    puzzleSolved(puzzleId) {
        if (!this.solvedPuzzles.includes(puzzleId)) this.solvedPuzzles.push(puzzleId);
    },

    updateHUD() {
        const petals = document.getElementById('petals');
        if (petals) {
            petals.innerHTML = '';
            for (let i = 0; i < this.maxPetals; i++) {
                const s = document.createElement('span');
                s.className = 'petal' + (i < this.petals ? '' : ' lost');
                petals.appendChild(s);
            }
            petals.classList.toggle('danger', this.petals <= 1 && this.state === 'play');
        }
        const container = document.getElementById('inventory-items');
        container.innerHTML = '';
        if (!this.inventory.length) {
            const empty = document.createElement('div');
            empty.className = 'inv-empty';
            empty.textContent = 'vuoto';
            container.appendChild(empty);
        }
        for (const id of this.inventory) {
            const div = document.createElement('div');
            div.className = 'inv-item';
            const color = { crystal_blue: '#4080ff', crystal_red: '#ff4040', crystal_green: '#40ff60', house_key: '#daa520' }[id];
            if (color) div.style.setProperty('--dot', color);
            div.title = this.inventoryNames[id] || id;
            const label = document.createElement('span');
            label.textContent = this.inventoryNames[id] || id;
            div.appendChild(label);
            container.appendChild(div);
        }
    },

    // ===== END STATES =====
    die() {
        if (this.state !== 'play') return;
        this.state = 'dead';
        this.endT = 0;
        this.deaths++;
        Dialogue.reset();
        Music.stop(1.5);
        Sfx.scary();
        Renderer.shake(40, 6);
        if (this.checkpoint) {
            this.checkpoint.deaths = this.deaths;
            this.checkpoint.playFrames = this.playFrames;
            Storage.set(SAVE_KEY, this.checkpoint);
        }
    },

    victory() {
        if (this.state !== 'play') return;
        this.state = 'victory';
        this.endT = 0;
        Dialogue.reset();
        Sfx.portal();
        Storage.remove(SAVE_KEY);
    },

    showEndScreen() {
        if (this.state === 'dead') {
            document.getElementById('game-over-text').textContent =
                "L'ultimo petalo della tua rosa cade a terra. Le ombre ti avvolgono...";
            UI.show('game-over-screen');
        } else {
            Music.play('victory');
            document.getElementById('victory-stats').textContent =
                `Tempo: ${formatTime(this.playFrames * STEP_MS)}   ·   Cadute: ${this.deaths}`;
            UI.show('victory-screen');
        }
    },

    // ===== UPDATE =====
    update() {
        this.frame++;
        Particles.ambient(this.currentMap ? this.currentMap.ambient : null);
        Particles.update();
        if (this.state === 'title') return;

        if (this.state === 'dead' || this.state === 'victory') {
            this.endT++;
            if (this.state === 'victory' && this.endT % 3 === 0) {
                const p = this.player;
                Particles.burst(p.rx * TILE + 16, p.ry * TILE + 16, '200,160,255', 3, 3);
            }
            if (this.endT === 90) this.showEndScreen();
            return;
        }
        if (this.paused) return;

        this.playFrames++;
        if (this.bumpCd > 0) this.bumpCd--;
        if (this.hurtFlash > 0) this.hurtFlash--;
        if (this.banner && --this.banner.t <= 0) this.banner = null;
        this.updatePlayerRender();

        if (this.transition) {
            this.updateTransition();
            return;
        }
        if (Dialogue.isActive()) return;

        for (let i = this.schedules.length - 1; i >= 0; i--) {
            const s = this.schedules[i];
            if (--s.t <= 0) {
                this.schedules.splice(i, 1);
                s.fn();
            }
        }
        if (Dialogue.isActive()) return;

        if (this.moveTimer > 0) this.moveTimer--;
        if (this.player.iframes > 0) this.player.iframes--;

        for (const e of this.currentEntities) Entities.update(e, this);
        Boss.update(this);
        this.checkEnemies();
    },

    updatePlayerRender() {
        const p = this.player;
        const t = 1 - this.moveTimer / this.moveDelay;
        p.rx = lerp(p.fromX, p.x, t);
        p.ry = lerp(p.fromY, p.y, t);
    },

    // ===== RENDERING =====
    render() {
        const ctx = Renderer.ctx;
        Renderer.clear();
        if (!this.currentMap) return;
        Renderer.beginFrame();

        ctx.drawImage(this.mapCanvas, 0, 0);

        for (const e of this.currentEntities) Entities.drawFloor(e, this.frame);
        Boss.drawFloor(this.frame);

        // Characters sorted by row
        const actors = this.currentEntities.filter(e => e.type === 'shadow' || e.type === 'nonna')
            .map(e => ({ y: e.ry === undefined ? e.y : e.ry, draw: () => Entities.drawActor(e, this.frame) }));
        if (this.state !== 'title') actors.push({ y: this.player.ry, draw: () => this.drawPlayer() });
        if (Boss.active && Boss.e) actors.push({ y: Boss.e.ry + 0.01, draw: () => Boss.drawActor(this.frame) });
        actors.sort((a, b) => a.y - b.y);
        for (const a of actors) a.draw();

        Boss.drawProjectiles(this.frame);
        Particles.draw(ctx, false);

        // Lighting
        const lights = [];
        const flick = 1 + Math.sin(this.frame * 0.13) * 0.025 + Math.sin(this.frame * 0.31) * 0.015;
        if (this.state === 'title') {
            lights.push({ x: CANVAS_W / 2 + Math.sin(this.frame * 0.01) * 120, y: CANVAS_H / 2 + Math.cos(this.frame * 0.013) * 60, r: 200 * flick });
        } else {
            const p = this.player;
            lights.push({ x: p.rx * TILE + 16, y: p.ry * TILE + 16, r: (this.currentMap.lightRadius || 3) * TILE * flick });
        }
        for (const e of this.currentEntities) Entities.lights(e, this.frame, lights);
        Boss.lights(this.frame, lights);
        const doors = this.state === 'title' ? [] : (this.currentMap.transitions || []);
        for (const t of doors) lights.push({ x: t.x * TILE + 16, y: t.y * TILE + 16, r: 30, strength: 0.55 });
        Renderer.applyLighting(lights);

        // Doors pulse faintly so exits can be found in the dark
        for (const t of doors) {
            const rgb = t.needCrystals ? '200,120,255' : '255,190,120';
            Renderer.glow(t.x * TILE + 16, t.y * TILE + 16, 22, rgb, 0.12 + Math.sin(this.frame * 0.05 + t.x) * 0.05);
        }
        for (const e of this.currentEntities) Entities.drawGlow(e, this.frame);
        Boss.drawGlow(this.frame);
        Particles.draw(ctx, true);

        Renderer.applyTint();
        Renderer.applyVignette();

        if (this.hurtFlash > 0) Renderer.fadeRect(this.hurtFlash / 18 * 0.35, '200,0,20');
        if (this.state === 'play' && this.petals === 1) {
            Renderer.fadeRect(0.06 + Math.sin(this.frame * 0.12) * 0.04, '160,0,0');
        }

        Renderer.endFrame();

        // Overlays that should not shake
        if (this.transition) Renderer.fadeRect(this.transition.alpha);
        if (this.state === 'dead') Renderer.fadeRect(Math.min(0.85, this.endT / 80), '40,0,0');
        if (this.state === 'victory') Renderer.fadeRect(Math.min(1, this.endT / 80), '255,255,255');
        if (this.state === 'play') {
            Boss.drawHUD(this, this.frame);
            this.drawBanner();
            if (this.paused) this.drawPause();
        }
    },

    drawPlayer() {
        const p = this.player;
        const ctx = Renderer.ctx;
        const px = p.rx * TILE, py = p.ry * TILE;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(px + 16, py + 29, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        if (p.iframes > 0 && this.canAct() && Math.floor(this.frame / 4) % 2) return;
        const walking = this.moveTimer > this.moveDelay / 2;
        const frames = PlayerSprites[p.dir] || PlayerSprites.down;
        Renderer.drawData(frames[walking && p.step % 2 ? 1 : 0], px, py + (walking ? -1 : 0));
    },

    drawBanner() {
        const b = this.banner;
        if (!b) return;
        const k = b.t / b.max;
        const a = Math.min(1, (1 - k) / 0.15, k / 0.3);
        const ctx = Renderer.ctx;
        const y = Boss.active ? 92 : 64;
        ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
        ctx.fillRect(0, y - 28, CANVAS_W, 40);
        Renderer.drawText(CANVAS_W / 2, y, b.text, `rgba(230,200,210,${a})`, 30, 'center');
    },

    drawPause() {
        Renderer.fadeRect(0.6);
        Renderer.drawText(CANVAS_W / 2, CANVAS_H / 2 - 10, 'PAUSA', '#d33', 52, 'center');
        Renderer.drawText(CANVAS_W / 2, CANVAS_H / 2 + 26, 'P / Esc o tocca per continuare', '#999', 22, 'center');
    },
};
