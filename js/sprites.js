// ============================================
// SPRITES - All pixel art (tiles, characters, items)
// ============================================
// Every sprite is built once at load time so the renderer can cache it.

const TILE_COLORS = {
    grass: '#2d5a1e', grassDark: '#1e4015',
    path: '#6b5a3e', pathEdge: '#5a4a30',
    wallExt: '#4a4040', floor: '#4a3a2a', floorTile: '#3a2a1a',
    doorWood: '#6a4a20',
    void: '#0a0010', eyeFloor: '#1a1020',
    brickDark: '#2a1a2a', brickLight: '#3a2a3a',
    fleshWall: '#4a1a1a',
};

function grassTile(dark, flower) {
    const b = dark ? TILE_COLORS.grassDark : TILE_COLORS.grass;
    const g = dark ? '#1a3510' : '#3a6a2e';
    const f = flower;
    const rows = [
        'bbbgbbbb',
        'bbbbbbgb',
        'bgbbbbbb',
        'bbbbgbbb',
        'bbbbbbbg',
        'gbbbbbbb',
        'bbgbbgbb',
        'bbbbbbbb',
    ];
    if (f) {
        rows[2] = 'bgbbbfbb';
        rows[5] = 'gbfbbbbb';
    }
    return spriteFromStrings(rows, { b, g, f: f || b });
}

function voidTile(variant) {
    const pal = { v: TILE_COLORS.void, e: TILE_COLORS.eyeFloor, r: '#3a0010', w: '#d8d0c0', k: '#000', R: '#5a0818' };
    if (variant === 'eye') {
        return spriteFromStrings([
            'vvvvvvvv',
            'vvveevvv',
            'vvewwevv',
            'vewkkwev',
            'vvewwevv',
            'vvveevvv',
            'vvvvvvvv',
            'vvvvvvvv',
        ], pal);
    }
    if (variant === 'blood') {
        return spriteFromStrings([
            'vvvevvvv',
            'vvvvvvvv',
            'vvRrrvvv',
            'vRrrrrvv',
            'vvrrRrvv',
            'vvvrrvve',
            'evvvvvvv',
            'vvvvvvvv',
        ], pal);
    }
    return spriteFromStrings([
        'vvvevvvv',
        'vevvvvvv',
        'vvvvvevv',
        'vvvvvvvv',
        'vvevvvve',
        'vvvvvvvv',
        'evvvvevv',
        'vvvvvvvv',
    ], pal);
}

function crystalSprite(color) {
    const c = { blue: '#4080ff', red: '#ff4040', green: '#40ff60' }[color];
    const d = { blue: '#2050aa', red: '#aa2020', green: '#20aa30' }[color];
    const l = { blue: '#b0d0ff', red: '#ffa0a0', green: '#b0ffb0' }[color];
    return spriteFromStrings([
        '...l....',
        '..lcl...',
        '..ccc...',
        '.lcdcl..',
        '.cdddc..',
        '.ccdcc..',
        '..ccc...',
        '...d....',
    ], { c, d, l });
}

function leverSprite(on) {
    const rows = on ? [
        '........',
        '....hh..',
        '...hh...',
        '...bb...',
        '...bb...',
        '..bbbb..',
        '.bbbbbb.',
        '........',
    ] : [
        '........',
        '..hh....',
        '...hh...',
        '...bb...',
        '...bb...',
        '..bbbb..',
        '.bbbbbb.',
        '........',
    ];
    return spriteFromStrings(rows, { b: '#666', h: on ? '#5c5' : '#c55' });
}

function paintingSprite(kind) {
    const pal = { y: '#a07a20', Y: '#d4a83a', a: '#1a1a24' };
    const inner = {
        forest: { rows: ['aaggaa', 'agggga', 'aggggg', 'aattaa', 'ddddtd', 'dddddd'], p: { g: '#1a4a20', t: '#3a2010', d: '#0f200f' } },
        family: { rows: ['ssaass', 'skaask', 'ssaass', 'bbacbb', 'bbaccb', 'bbaccb'], p: { s: '#d8b8a0', k: '#000', b: '#40305a', c: '#555' } },
        lady:   { rows: ['ahhhha', 'hhaahh', 'haaaah', 'arrrra', 'rrrrrr', 'rrxxrr'], p: { h: '#000', r: '#8a0f1a', x: '#d8d0c0' } },
        eye:    { rows: ['aaaaaa', 'awwwwa', 'wwkkww', 'wwkkww', 'awwwwa', 'aaaaaa'], p: { w: '#d8d0c0', k: '#600' } },
        grandpa:{ rows: ['aawwaa', 'awssaa', 'aassal', 'abbbbl', 'abbbba', 'abaaba'], p: { w: '#ccc', s: '#d8b8a0', b: '#3a3a50', l: '#ffcc40' } },
    }[kind];
    const rows = ['yYyyyyYy'];
    for (const r of inner.rows) rows.push('y' + r + 'y');
    rows.push('yyYyyYyy');
    return spriteFromStrings(rows, { ...pal, ...inner.p });
}

const TileSprites = {
    grass: [grassTile(false), grassTile(true)],
    grassFlowerRed: grassTile(false, '#a33'),
    grassFlowerBlue: grassTile(false, '#55c'),
    grassFlowerWhite: grassTile(false, '#ccc'),
    mushroom: spriteFromStrings([
        'bbbgbbbb',
        'bbbbbbgb',
        'bgbrrbbb',
        'bbrwrrbb',
        'bbbssbbg',
        'gbbssbbb',
        'bbgbbgbb',
        'bbbbbbbb',
    ], { b: TILE_COLORS.grass, g: '#3a6a2e', r: '#b02020', w: '#eee', s: '#ddc' }),
    tree: spriteFromStrings([
        '..dlld..',
        '.dllLld.',
        'dllddlLd',
        'dldllldd',
        '.dllldd.',
        '..dttd..',
        '...tt...',
        '..tttt..',
    ], { l: '#1a5a10', L: '#2a7a1a', d: '#0a3a00', t: '#4a2800' }),
    path: spriteFromStrings([
        'ppepppep',
        'ppppsppp',
        'eppppppe',
        'ppsppppp',
        'pppppspp',
        'pepppppp',
        'ppppppep',
        'pppspppp',
    ], { p: TILE_COLORS.path, e: TILE_COLORS.pathEdge, s: '#7a6a4e' }),
    houseWall: spriteFromStrings([
        'wwwwwwww',
        'wwwdwwww',
        'wdwwwwdw',
        'wwwwwwww',
        'wwwwdwww',
        'wwdwwwww',
        'wwwwwwwd',
        'wwwwwwww',
    ], { w: TILE_COLORS.wallExt, d: '#3a3030' }),
    roof: spriteFromStrings([
        'rrrrrrrr',
        'dddddddd',
        'rrrrrrrr',
        'rrrdrrrr',
        'dddddddd',
        'rrrrrrrr',
        'rrrrrdrr',
        'dddddddd',
    ], { r: '#5a2020', d: '#3a1010' }),
    houseFloor: spriteFromStrings([
        'fffftfff',
        'ffffffff',
        'tttttttt',
        'ffffffff',
        'ftffffff',
        'ffffffff',
        'tttttttt',
        'fffffftf',
    ], { f: TILE_COLORS.floor, t: TILE_COLORS.floorTile }),
    trapdoor: spriteFromStrings([
        'wwwwwwww',
        'wddddddw',
        'wdhddhdw',
        'wddkkddw',
        'wddkkddw',
        'wdhddhdw',
        'wddddddw',
        'wwwwwwww',
    ], { w: '#4a3020', d: '#5a4030', h: '#3a2010', k: '#888' }),
    voidFloor: voidTile(),
    voidEye: voidTile('eye'),
    voidBlood: voidTile('blood'),
    brickWall: spriteFromStrings([
        'llldllll',
        'llldllll',
        'dddddddd',
        'llllldll',
        'llllldll',
        'dddddddd',
        'lldlllll',
        'lldlllll',
    ], { d: TILE_COLORS.brickDark, l: TILE_COLORS.brickLight }),
    fleshWall: spriteFromStrings([
        'ffdfffvf',
        'fdffvfff',
        'fffvffdf',
        'dffffdff',
        'ffvffffd',
        'ffffdfff',
        'fdffffvf',
        'fffdffff',
    ], { f: TILE_COLORS.fleshWall, d: '#3a0a0a', v: '#5a1a2a' }),
    stoneWall: spriteFromStrings([
        'ssssdsss',
        'ssssdsss',
        'dddddddd',
        'sdssssss',
        'sdssssss',
        'dddddddd',
        'sssssdss',
        'sssssdss',
    ], { s: '#333', d: '#222' }),
    door: spriteFromStrings([
        'dddddddd',
        'dhhddhhd',
        'dhhddhhd',
        'dddddddd',
        'ddddkddd',
        'dddddddd',
        'dhhddhhd',
        'dddddddd',
    ], { d: TILE_COLORS.doorWood, h: '#8a6a30', k: '#ccc' }),
    darkDoor: spriteFromStrings([
        'kkkkkkkk',
        'krrkkrrk',
        'krrkkrrk',
        'kkkkkkkk',
        'kkkkykkk',
        'kkkkkkkk',
        'krrkkrrk',
        'kkkkkkkk',
    ], { k: '#200810', r: '#4a1020', y: '#a08030' }),
    crystal: { blue: crystalSprite('blue'), red: crystalSprite('red'), green: crystalSprite('green') },
    key: spriteFromStrings([
        '..kkk...',
        '.k...k..',
        '.k...k..',
        '..kkk...',
        '...k....',
        '...kk...',
        '...k....',
        '...kk...',
    ], { k: '#daa520' }),
    note: spriteFromStrings([
        '........',
        '.pppppp.',
        '.pttttp.',
        '.pppppp.',
        '.pttppp.',
        '.pppppp.',
        '.ptttpp.',
        '.pppppp.',
    ], { p: '#ddd', t: '#666' }),
    lever: { on: leverSprite(true), off: leverSprite(false) },
    vase: spriteFromStrings([
        '...rr...',
        '..rrrr..',
        '...rg...',
        '..cccc..',
        '.ccwccc.',
        '.cwcccc.',
        '.cccccc.',
        '..cccc..',
    ], { r: '#d02a3a', g: '#3a3', c: '#3a5a9a', w: '#8ab' }),
    petal: spriteFromStrings([
        '........',
        '..rrr...',
        '.rrRrr..',
        '.rRrRr..',
        '..rrr...',
        '...g....',
        '..gg....',
        '...g....',
    ], { r: '#d02a3a', R: '#ff6070', g: '#3a3' }),
    hand: spriteFromStrings([
        '.k.k.k..',
        '.k.k.k..',
        '.kkkkk.k',
        '.kkkkkkk',
        '.kkkkkk.',
        '..kkkk..',
        '..kkkk..',
        '..kkkk..',
    ], { k: '#120008' }),
    painting: {
        forest: paintingSprite('forest'),
        family: paintingSprite('family'),
        lady: paintingSprite('lady'),
        eye: paintingSprite('eye'),
        grandpa: paintingSprite('grandpa'),
    },
};

// ===== CHARACTERS =====
const PLAYER_PAL = { h: '#654', s: '#fdb', e: '#345', b: '#36a', B: '#258', o: '#543' };

const PlayerSprites = (() => {
    const down = [
        ['...hh...', '..hssh..', '..sees..', '...ss...', '.bbBBbb.', '...bb...', '..b..b..', '..o..o..'],
        ['...hh...', '..hssh..', '..sees..', '...ss...', '.bbBBbb.', '...bb...', '.b....b.', '.o....o.'],
    ];
    const up = [
        ['...hh...', '..hhhh..', '..hhhh..', '...ss...', '.bbbbbb.', '...bb...', '..b..b..', '..o..o..'],
        ['...hh...', '..hhhh..', '..hhhh..', '...ss...', '.bbbbbb.', '...bb...', '.b....b.', '.o....o.'],
    ];
    const right = [
        ['...hhh..', '..hhhss.', '..hhses.', '...sss..', '..bbBb..', '..bbbbs.', '...bb...', '...o.o..'],
        ['...hhh..', '..hhhss.', '..hhses.', '...sss..', '..bbBb..', '..bbbb..', '..b..b..', '.o....o.'],
    ];
    const build = frames => frames.map(f => spriteFromStrings(f, PLAYER_PAL));
    const r = build(right);
    return { down: build(down), up: build(up), right: r, left: r.map(mirrorSprite) };
})();

// Backwards compatible single sprite
const PlayerSprite = { frames: PlayerSprites.down };

const ShadowSprite = {
    frames: [
        spriteFromStrings([
            '..kkkk..',
            '.kkkkkk.',
            '.krkkrk.',
            '.kkkkkk.',
            'kkkkkkkk',
            '.kkkkkk.',
            'kk.kk.kk',
            'k..k..k.',
        ], { k: '#08080e', r: '#ff2a2a' }),
        spriteFromStrings([
            '..kkkk..',
            '.kkkkkk.',
            '.krkkrk.',
            '.kkkkkk.',
            'kkkkkkkk',
            '.kkkkkk.',
            '.kk.kk.k',
            '..k..k..',
        ], { k: '#08080e', r: '#ff2a2a' }),
    ],
};

const NonnaSprite = spriteFromStrings([
    '..hhhh..',
    '.hhhhhh.',
    '.hssssh.',
    '..sksk..',
    '..ssss..',
    '.dddddd.',
    '.dDddDd.',
    '..d..d..',
], { h: '#bbb', s: '#dab', k: '#000', d: '#604080', D: '#806aa0' });

// The final boss: "La Dama nel Quadro", 16x16
const BOSS_PAL = { h: '#0a0a0a', p: '#e8dcd0', k: '#000', r: '#8a0f1a', d: '#5a0810', w: '#d8d0c0' };
const BossSprites = (() => {
    const base = [
        '.....hhhhhh.....',
        '....hhhhhhhh....',
        '...hhhppppphh...',
        '...hhpkppkphh...',
        '...hhpkppkphh...',
        '...hhpppppphh...',
        '...hhpprrpphh...',
        '..hhhhppppphhh..',
        '..hhrrrrrrrrhh..',
        '.hhrrdrrrrdrrhh.',
        '.hwrrrrrrrrrrwh.',
        '.hw.rrdrrdrr.wh.',
        '.w.rrrrrrrrrr.w.',
        '..rrrrdrrdrrrr..',
        '.rrrrrrrrrrrrrr.',
        'rr.rr.rr.rr.rr.r',
    ];
    const alt = [...base];
    alt[11] = 'hw..rrdrrdrr..wh';
    alt[12] = 'w..rrrrrrrrrr..w';
    alt[15] = '.rr.rr.rr.rr.rr.';
    const f0 = spriteFromStrings(base, BOSS_PAL);
    const f1 = spriteFromStrings(alt, BOSS_PAL);
    return { frames: [f0, f1], hurt: spriteSilhouette(f0, '#ffffff') };
})();
