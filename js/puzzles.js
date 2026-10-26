// ============================================
// PUZZLES - Puzzle logic for each room
// ============================================

const Puzzles = {
    leverState: {},
    floorBtnSequence: [],
    floorBtnExpected: [1, 2, 3, 4], // red, green, blue, yellow
    leverSolution: { lever1: true, lever2: false, lever3: true, lever4: false },

    reset() {
        this.leverState = {};
        this.floorBtnSequence = [];
    },

    toggleLever(entity, game) {
        if (game.solvedPuzzles.includes('west_levers')) {
            game.showDialogue("Le leve sono bloccate. Il meccanismo ha gia' fatto il suo lavoro.");
            return;
        }
        entity.on = !entity.on;
        this.leverState[entity.id] = entity.on;
        Sfx.lever(entity.on);
        Particles.burst(entity.x * TILE + 16, entity.y * TILE + 10, '200,200,200', 5, 1.2, { life: 15, size: 1 });

        const solved = Object.keys(this.leverSolution)
            .every(id => (this.leverState[id] || false) === this.leverSolution[id]);

        if (solved) {
            game.puzzleSolved('west_levers');
            Sfx.puzzle();
            Renderer.shake(12, 2);
            const crystal = game.currentEntities.find(e => e.id === 'crystal_blue');
            if (crystal) {
                crystal.hidden = false;
                Particles.burst(crystal.x * TILE + 16, crystal.y * TILE + 16, CRYSTAL_RGB.blue, 24, 2.5);
            }
            game.showDialogue("Le leve scattano all'unisono... un rumore sordo. Qualcosa e' apparso al centro della stanza!");
        }
    },

    stepFloorBtn(entity, game) {
        if (entity.pressed || game.solvedPuzzles.includes('east_pattern')) return;

        entity.pressed = true;
        this.floorBtnSequence.push(entity.order);
        Sfx.tile(entity.order);
        Particles.burst(entity.x * TILE + 16, entity.y * TILE + 16, hexToRgb(entity.color), 10, 1.5);

        const wrong = this.floorBtnSequence.some((v, i) => v !== this.floorBtnExpected[i]);
        if (wrong) {
            Sfx.error();
            Renderer.shake(8, 2);
            this.floorBtnSequence = [];
            game.currentEntities.forEach(e => {
                if (e.type === 'floor_btn') e.pressed = false;
            });
            game.showDialogue("Le piastrelle si spengono con un sibilo... devi ricominciare la sequenza.");
            return;
        }

        if (this.floorBtnSequence.length === this.floorBtnExpected.length) {
            game.puzzleSolved('east_pattern');
            Sfx.puzzle();
            Renderer.shake(12, 2);
            const crystal = game.currentEntities.find(e => e.id === 'crystal_red');
            if (crystal) {
                crystal.hidden = false;
                Particles.burst(crystal.x * TILE + 16, crystal.y * TILE + 16, CRYSTAL_RGB.red, 24, 2.5);
            }
            game.showDialogue("Le piastrelle brillano tutte insieme! Un cristallo rosso emerge dal pavimento!");
        }
    },

    canEnterFinal(game) {
        return ['crystal_blue', 'crystal_red', 'crystal_green'].every(id => game.inventory.includes(id));
    },
};
