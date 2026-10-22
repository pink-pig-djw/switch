// 《橙子大冒险》像素美术：角色 / 敌人 / 道具用字符画定义，地形图块用程序绘制
import { makeCanvas } from '../../ui.js';

export const PAL = {
  k: '#1b1010',
  H: '#ff8a1c', h: '#c9580b',
  S: '#ffd6b0', s: '#e8a47c',
  E: '#2a1612',
  W: '#ffffff', w: '#cfe0da',
  G: '#2fae8c', g: '#1c7a62',
  B: '#7a4426', b: '#4a2814',
  L: '#3ccf6a', l: '#1f8a42',
  R: '#ff8a8a',
  O: '#ff9a1f', o: '#d96a0a',
  Y: '#ffd84a', y: '#d39b16',
  T: '#86d14a', t: '#4c8f26',
  Q: '#a06cff', q: '#6340cc',
  N: '#a8683a', n: '#6a3a1c',
  X: '#a7adb6', x: '#646b75', Z: '#eef1f4',
  U: '#4aa0ff', u: '#2160c0',
  C: '#fff3dc', c: '#e3c79a',
  M: '#c0392b', m: '#7a1c12',
  P: '#ff6fa8',
  D: '#3a2a4a', d: '#241a30',
};

// 茶叶能力时的配色（裙子变成白绿色）
export const PAL_TEA = { ...PAL, G: '#f4fff8', g: '#6fbf4a', W: '#7bd94f' };

// ———————————————————— 角色：小个子（16×16） ————————————————————
const S_HEAD = [
  '......kkkkk.....',
  '....kkHHHHHkk.k.',
  '...kHHHHHHHHHkLk',
  '..kHHHHHHHHHHHk.',
  '..kHHHHHHHHHHHk.',
  '.khHHHHhHHhHHHk.',
  '.khHHHhSShSShHk.',
  'khhHHhSSSSSSESk.',
  'khkkhSSSSSSSESk.',
  'kk..kSSSSSRSSk..',
  '....kkSSSSSkk...',
];
const S_BODY = {
  stand: [
    '....kWWGGGWWk...',
    '...kSkGGGGGkSk..',
    '...kgGGGGGGgk...',
    '.....kSk.kSk....',
    '....kBBk.kBBk...',
  ],
  walk1: [
    '....kWWGGGWWk...',
    '...kkGGGGGGSk...',
    '...kgGGGGGGgk...',
    '...kSk...kSk....',
    '..kBBk...kBBk...',
  ],
  walk2: [
    '....kWWGGGWWk...',
    '....kSGGGGGk....',
    '...kgGGGGGGgk...',
    '......kSSk......',
    '.....kBBBBk.....',
  ],
  walk3: [
    '....kWWGGGWWk...',
    '...kSGGGGGGkk...',
    '...kgGGGGGGgk...',
    '....kSk..kSk....',
    '...kBBk...kBBk..',
  ],
  jump: [
    '....kWWGGGWWkSk.',
    '...kSkGGGGGkkk..',
    '...kgGGGGGGgk...',
    '...kSk...kSk....',
    '..kBBk....kBBk..',
  ],
  climb: [
    '....kWWGGGWWkSk.',
    '....kGGGGGGkkSk.',
    '...kgGGGGGGgk...',
    '....kSk..kSSk...',
    '...kBBk...kBBk..',
  ],
};

const S_DEAD = [
  '....kkkkkkkk....',
  '..kkHHHHHHHHkk..',
  '.kHHHHHHHHHHHHk.',
  '.kHHHHHHHHHHHHk.',
  'kHHHhHHHHHHhHHHk',
  'kHHhSSSSSSSShHHk',
  'kHhSkSkSSkSkShHk',
  'kHhSSkSSSSkSShHk',
  'khhSkSkSSkSkShhk',
  '.kkkSSSMMSSSkkk.',
  'kSk.kkSSSSkk.kSk',
  'kSkkWWGGGGWWkkSk',
  '.kSkGGGGGGGGkSk.',
  '..kgGGGGGGGGgk..',
  '...kSSk..kSSk...',
  '...kBBk..kBBk...',
];

// ———————————————————— 角色：大个子（16×32） ————————————————————
const B_HEAD = [
  '......kkkkk.....',
  '....kkHHHHHkk...',
  '...kHHHHHHHHHkLk',
  '..kHHHHHHHHHHkLL',
  '..kHHHHHHHHHHHk.',
  '.kHHHHHHHHHHHHk.',
  '.kHHHHHHhHHhHHk.',
  'khHHHHhSShSShHk.',
  'khHHHhSSSSSSSHk.',
  'khHHhSSSSSSEShk.',
  'khhHhSSSSSSESSk.',
  'khkkhSSSSSSSSSk.',
  'kk..kSSSSSRSSk..',
  '.k...kSSSSSSk...',
  '......kkSSkk....',
];
const B_TORSO = [
  '.....kWWWWWWk...',
  '....kSWGGGGWSk..',
  '...kSSkGGGGkSSk.',
  '...kSkGGGGGGkSk.',
  '...kSkGGGGGGkSk.',
  '....kkGGGGGGkk..',
  '....kGGGGGGGGk..',
  '...kgGGGGGGGGgk.',
  '...kgGGgGGgGGgk.',
  '...kkkkkkkkkkkk.',
];
const B_LEGS = {
  stand: [
    '.....kSSk.kSSk..',
    '.....kSSk.kSSk..',
    '.....kSSk.kSSk..',
    '.....kssk.kssk..',
    '....kBBBk.kBBBk.',
    '....kbbbk.kbbbk.',
    '................',
  ],
  walk1: [
    '....kSSk...kSSk.',
    '...kSSk....kSSk.',
    '...kSSk.....kSk.',
    '..kssk......kSk.',
    '.kBBBk.....kBBBk',
    '.kbbbk.....kbbbk',
    '................',
  ],
  walk2: [
    '......kSSSk.....',
    '......kSSSk.....',
    '......kSSk......',
    '......kssk......',
    '.....kBBBBk.....',
    '.....kbbbbk.....',
    '................',
  ],
  walk3: [
    '.....kSSk.kSSk..',
    '....kSSk...kSSk.',
    '....kSSk...kSk..',
    '...kssk....kSk..',
    '..kBBBk...kBBBk.',
    '..kbbbk...kbbbk.',
    '................',
  ],
  jump: [
    '....kSSk..kSSk..',
    '...kSSk....kSSk.',
    '..kSSk......kSk.',
    '..kssk.....kSk..',
    '.kBBBk....kBBBk.',
    '.kbbbk....kbbbk.',
    '................',
  ],
};
const B_TORSO_JUMP = [
  '.....kWWWWWWkSSk',
  '....kSWGGGGWkSk.',
  '...kSSkGGGGkkk..',
  '...kSkGGGGGGk...',
  '...kSkGGGGGGk...',
  '....kkGGGGGGk...',
  '....kGGGGGGGGk..',
  '...kgGGGGGGGGgk.',
  '...kgGGgGGgGGgk.',
  '...kkkkkkkkkkkk.',
];
const B_TORSO_THROW = [
  '.....kWWWWWWk...',
  '....kSWGGGGWkkkk',
  '...kSSkGGGGkSSSk',
  '...kSkGGGGGGkkk.',
  '...kSkGGGGGGk...',
  '....kkGGGGGGk...',
  '....kGGGGGGGGk..',
  '...kgGGGGGGGGgk.',
  '...kgGGgGGgGGgk.',
  '...kkkkkkkkkkkk.',
];

// ———————————————————— 敌人（朝左画，向右走时自动镜像） ————————————————————
const SLIME1 = [
  '................',
  '................',
  '................',
  '................',
  '......kkkk......',
  '....kkTTTTkk....',
  '...kTTTTTTTTk...',
  '..kTZZTTTTTTTk..',
  '..kTZTTTTTTTTk..',
  '.kTTWWTTTWWTTTk.',
  '.kTTkWTTTkWTTTk.',
  'kTTTTTTTTTTTTTTk',
  'kTTTTTkkkkTTTTTk',
  'kTTTTTTTTTTTTTTk',
  '.ktTTTTTTTTTTtk.',
  '..kkkkkkkkkkkk..',
];
const SLIME2 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkTTTTTTkk...',
  '..kTZZTTTTTTTk..',
  '.kTZTTTTTTTTTTk.',
  '.kTTWWTTTTWWTTk.',
  'kTTTkWTTTTkWTTTk',
  'kTTTTTTTTTTTTTTk',
  'kTTTTTTkkkkTTTTk',
  'kTTTTTTTTTTTTTTk',
  'ktTTTTTTTTTTTTtk',
  '.kkkkkkkkkkkkkk.',
];
const SLIME_FLAT = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...kkkkkkkkkk...',
  '.kkTTkkTTTkkTTk.',
  'kTTTTTTTTTTTTTTk',
  'kkkkkkkkkkkkkkkk',
];
const SNAIL1 = [
  '................',
  '..k...k.........',
  '..Yk..Yk........',
  '...k...k........',
  '...kkkkk..kkkk..',
  '..kCCCCCkkQQQQk.',
  '..kCkCCkkQQqqQQk',
  '..kCCCCkQQqQQqQk',
  '...kCCCkQqQqqQqk',
  '...kCCCkQqQQQqQk',
  '...kCCCkQQqqqQQk',
  '..kCCCCCkQQQQQk.',
  '.kCCCCCCCkkkkkCk',
  'kCCcCCcCCCcCCCck',
  'kccccccccccccck.',
  '.kkkkkkkkkkkkk..',
];
const SNAIL2 = [
  '................',
  '...k...k........',
  '...Yk..Yk.......',
  '....k...k.......',
  '....kkkkk.kkkk..',
  '...kCCCCCkQQQQk.',
  '...kCkCCkQQqqQQk',
  '...kCCCCkQqQQqQk',
  '...kCCCkQQqQqqQk',
  '...kCCCkQqQQQqQk',
  '...kCCCkQQqqqQQk',
  '..kCCCCCkQQQQQk.',
  '.kCCCCCCCkkkkkCk',
  'kCCcCCcCCCcCCCck',
  '.kccccccccccccck',
  '..kkkkkkkkkkkkk.',
];
const SHELL = [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkQQQQQQkk...',
  '..kQQQqqqqQQQk..',
  '.kQQqqQQQQqqQQk.',
  '.kQqQQqqqqQQqQk.',
  'kQqQqQQQQqQQqQQk',
  'kQqQqQqqQqQQqQQk',
  'kQqQqQQqQqQqQQQk',
  'kQQqQqqqQQqQQQQk',
  '.kQQqQQQqqQQQQk.',
  '.kQQQqqqQQQQQQk.',
  '..kkQQQQQQQQkk..',
  '....kkkkkkkk....',
];
const HEDGE1 = [
  '................',
  '................',
  '.....k.k.k......',
  '....kNkNkNk.k...',
  '...kNNNNNNNkNk..',
  '..kkNnNnNnNNNNk.',
  '.kCkNNNNNNNNNnNk',
  'kCCCkNnNnNnNNNNk',
  'kCECCkNNNNNNNnNk',
  'kCCCCCkNnNnNNNNk',
  'kkCCCCCkNNNNNNk.',
  '.kCCCCCCkkkkkk..',
  '..kCCCCCCCCCCk..',
  '...kkCCCCCCkk...',
  '...kBk....kBk...',
  '...kk......kk...',
];
const HEDGE2 = [
  '................',
  '................',
  '......k.k.k.....',
  '.....kNkNkNk.k..',
  '...kkNNNNNNNkNk.',
  '..kCkNnNnNnNNNNk',
  '.kCCCkNNNNNNNnNk',
  'kCCCCkNnNnNnNNNk',
  'kCECCCkNNNNNNnNk',
  'kCCCCCCkNnNnNNk.',
  'kkCCCCCCkNNNNk..',
  '.kCCCCCCCkkkk...',
  '..kCCCCCCCCCCk..',
  '...kkCCCCCCkk...',
  '....kBk..kBk....',
  '....kk....kk....',
];
const BEE1 = [
  '................',
  '......kkk..kkk..',
  '.....kWWWkkWWWk.',
  '.....kWwWkWWwWk.',
  '......kWWkWWWk..',
  '....kkkkkkkkk...',
  '...kYYkYYkYYYk..',
  '..kYEYkYYkYYYYk.',
  '..kYYYkYYkYYYYkk',
  '..kYYYkYYkYYYYkk',
  '...kYYkYYkYYYk..',
  '....kkkkkkkkk...',
  '................',
  '................',
  '................',
  '................',
];
const BEE2 = [
  '................',
  '................',
  '................',
  '......kkkkkkkk..',
  '.....kWwWWwWWWk.',
  '....kkkkkkkkkk..',
  '...kYYkYYkYYYk..',
  '..kYEYkYYkYYYYk.',
  '..kYYYkYYkYYYYkk',
  '..kYYYkYYkYYYYkk',
  '...kYYkYYkYYYk..',
  '....kkkkkkkkk...',
  '................',
  '................',
  '................',
  '................',
];

// ———————————————————— 道具 ————————————————————
const COIN = [
  [
    '................',
    '.....kkkkkk.....',
    '....kYYYYYYk....',
    '...kYOOOOOOYk...',
    '..kYOOOLLOOOYk..',
    '..kYOOOLOOOOYk..',
    '..kYOOOOOOOOYk..',
    '..kYOWOOOOOOYk..',
    '..kYOWOOOOOOYk..',
    '..kYOOOOOOOOYk..',
    '..kYOOOOOOOoYk..',
    '..kYoOOOOOooYk..',
    '...kYooooooYk...',
    '....kYYYYYYk....',
    '.....kkkkkk.....',
    '................',
  ],
  [
    '................',
    '......kkkk......',
    '.....kYYYYk.....',
    '....kYOOOOYk....',
    '....kYOLOOYk....',
    '....kYOOOOYk....',
    '....kYWOOOYk....',
    '....kYWOOOYk....',
    '....kYOOOOYk....',
    '....kYOOOOYk....',
    '....kYOOOoYk....',
    '....kYoOooYk....',
    '....kYooooYk....',
    '.....kYYYYk.....',
    '......kkkk......',
    '................',
  ],
  [
    '................',
    '.......kk.......',
    '......kYYk......',
    '......kYYk......',
    '......kYOk......',
    '......kYOk......',
    '......kWOk......',
    '......kWOk......',
    '......kYOk......',
    '......kYOk......',
    '......kYok......',
    '......kYok......',
    '......kYYk......',
    '......kYYk......',
    '.......kk.......',
    '................',
  ],
];
const BIG_ORANGE = [
  '.......kk.......',
  '......knnk.kkk..',
  '......knkkLLLLk.',
  '....kkkkLLLLlk..',
  '...kOOOOkkkkk...',
  '..kOWWOOOOOOOk..',
  '.kOWWOOOOOOOOOk.',
  '.kOWOOOOOOOOOOk.',
  'kOOOOOOOOOOOOOOk',
  'kOOOOOOOOOOOOOok',
  'kOOOOOOOOOOOOOok',
  'kOOOOOOOOOOOOook',
  '.kOOOOOOOOOOOok.',
  '.koOOOOOOOOooook',
  '..kooooooooook..',
  '...kkkkkkkkkk...',
];
const TEACUP = [
  '.....W...W......',
  '......W...W.....',
  '.....W...W......',
  '......W...W.....',
  '................',
  '.kkkkkkkkkkkk...',
  'kWWWWWWWWWWWWk..',
  'kWTTTTTTTTTTWkkk',
  'kWWTTTTTTTTWWkWk',
  '.kWWWWWWWWWWkkWk',
  '.kWWWLLWWWWWkWk.',
  '..kWWLWWWWWkkk..',
  '..kwWWWWWWwk....',
  '...kwwwwwwk.....',
  '.kkkkkkkkkkkk...',
  'kcccccccccccck..',
];
const LEAF_1UP = [
  '................',
  '..........kkkk..',
  '........kkLLLLk.',
  '......kkLLLLLLk.',
  '.....kLLLLLLLLk.',
  '....kLLLLLLLLLk.',
  '...kLLLLLLlLLk..',
  '...kLLLLLlLLLk..',
  '..kLLLLLlLLLk...',
  '..kLLLLlLLLLk...',
  '..kLLLlLLLLk....',
  '..kLLlLLLLk.....',
  '..kLlLLLkk......',
  '.kllkkkk........',
  'kll.............',
  'kk..............',
];
const TEABALL = [
  ['..kkkk..', '.kLLLLk.', 'kLWLLLlk', 'kLLLLLlk', 'kLLLLLlk', 'kLLLLllk', '.kllllk.', '..kkkk..'],
  ['..kkkk..', '.kLLLLk.', 'kLLLLWLk', 'kLLLLLLk', 'klLLLLLk', 'kllLLLLk', '.kllllk.', '..kkkk..'],
];
const PUFF = [
  [
    '................',
    '................',
    '.....ZZ..ZZ.....',
    '....ZZZZZZZZ....',
    '...ZZZWWWWZZZ...',
    '..ZZWWWWWWWWZZ..',
    '..ZWWWWWWWWWWZ..',
    '...ZWWWWWWWWZ...',
    '..ZZWWWWWWWWZZ..',
    '..ZWWWWWWWWWWZ..',
    '...ZZWWWWWWZZ...',
    '....ZZZZZZZZ....',
    '.....ZZ..ZZ.....',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '..ZZ........ZZ..',
    '.ZWWZ......ZWWZ.',
    '.ZWWZ..ZZ..ZWWZ.',
    '..ZZ..ZWWZ..ZZ..',
    '......ZWWZ......',
    '.......ZZ.......',
    '..ZZ........ZZ..',
    '.ZWWZ......ZWWZ.',
    '.ZWWZ..ZZ..ZWWZ.',
    '..ZZ..ZWWZ..ZZ..',
    '......ZWWZ......',
    '.......ZZ.......',
    '................',
    '................',
    '................',
  ],
];
const FLAG = [
  'kkkkkkkkkkkkkk..',
  'kOOOOOOOOOOOOOk.',
  'kOOOOOOOOOOOOk..',
  'kOOOOLLLLOOOk...',
  'kOOOLLLLLLOk....',
  'kOOLLLLlLLk.....',
  'kOOOLLlLLLOk....',
  'kOOOOLLLLOOOk...',
  'kOOOOOOOOOOOOk..',
  'kOOOOOOOOOOOOOk.',
  'kkkkkkkkkkkkkk..',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const BOSS = [
  '..........k....k........k.......',
  '.........kYk..kYk......kYk......',
  '........kYYYkkYYYk....kYYYk.....',
  '........kYYYYYYYYYkkkkYYYYk.....',
  '........kYyYYyYYyYYYYYYyYYk.....',
  '.........kkkkkkkkkkkkkkkkk......',
  '.......kkDDDDDDDDDDDDDDDDDkk....',
  '.....kkDDDDDDDDDDDDDDDDDDDDDkk..',
  '....kDDDDDDDDDDDDDDDDDDDDDDDDDk.',
  '...kDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  '..kDDDDkkkkDDDDDDDDDDkkkkDDDDDDk',
  '..kDDDkWWWWkDDDDDDDDkWWWWkDDDDDk',
  '.kDDDDkWWWkkDDDDDDDDkkWWWkDDDDDk',
  '.kDDDDkWWkEkDDDDDDDDkEkWWkDDDDDk',
  '.kDDDDDkkkkDDDDDDDDDDkkkkDDDDDDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDDDDDDDDkkkkkkkkkkkkkkDDDDDDDDk',
  'kDDDDDDDkMMWMMWMMWMMWMMkDDDDDDDk',
  'kDDDDDDDkMMMMMMMMMMMMMMkDDDDDDDk',
  'kDDDDDDDDkkMMMMMMMMMMkkDDDDDDDDk',
  'kdDDDDDDDDDkkkkkkkkkkDDDDDDDDDdk',
  'kdDDDDDDDDDDDDDDDDDDDDDDDDDDDDdk',
  '.kdDDDDDDDDDDDDDDDDDDDDDDDDDDdk.',
  '.kddDDDDDDDDDDDDDDDDDDDDDDDDddk.',
  '..kddDDDDDDDDDDDDDDDDDDDDDDddk..',
  '...kdddDDDDDDDDDDDDDDDDDDdddk...',
  '....kkdddddddddddddddddddkk.....',
  '....kBBBkkkkkkkkkkkkkkkBBBk.....',
  '...kBBBBBk...........kBBBBBk....',
  '...kbbbbbk...........kbbbbbk....',
  '....kkkkk.............kkkkk.....',
];

// ———————————————————— 构建 ————————————————————
function paint(rows, pal, flip = false) {
  const h = rows.length, w = rows[0].length;
  const cv = makeCanvas(w, h);
  const c = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (!ch || ch === '.' || ch === ' ') continue;
      const col = pal[ch];
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  }
  return cv;
}

function check(name, rows, w, h) {
  if (rows.length !== h) console.warn(`[pixel] ${name}: ${rows.length} 行，应为 ${h}`);
  rows.forEach((r, i) => { if (r.length !== w) console.warn(`[pixel] ${name} 第 ${i} 行宽 ${r.length}，应为 ${w}`); });
}

export function buildSprites() {
  const out = {};
  const add = (name, rows, w, h, pal = PAL) => {
    check(name, rows, w, h);
    out[name] = { r: paint(rows, pal, false), l: paint(rows, pal, true), w, h };
  };
  for (const [pal, pre] of [[PAL, ''], [PAL_TEA, 'tea_']]) {
    for (const k of Object.keys(S_BODY)) add(`${pre}s_${k}`, [...S_HEAD, ...S_BODY[k]], 16, 16, pal);
    add(`${pre}s_dead`, S_DEAD, 16, 16, pal);
    for (const k of Object.keys(B_LEGS)) {
      const torso = k === 'jump' ? B_TORSO_JUMP : B_TORSO;
      add(`${pre}b_${k}`, [...B_HEAD, ...torso, ...B_LEGS[k]], 16, 32, pal);
    }
    add(`${pre}b_throw`, [...B_HEAD, ...B_TORSO_THROW, ...B_LEGS.stand], 16, 32, pal);
    add(`${pre}b_climb`, [...B_HEAD, ...B_TORSO_JUMP, ...B_LEGS.walk3], 16, 32, pal);
  }
  add('slime1', SLIME1, 16, 16);
  add('slime2', SLIME2, 16, 16);
  add('slime_flat', SLIME_FLAT, 16, 16);
  add('snail1', SNAIL1, 16, 16);
  add('snail2', SNAIL2, 16, 16);
  add('shell', SHELL, 16, 16);
  add('hedge1', HEDGE1, 16, 16);
  add('hedge2', HEDGE2, 16, 16);
  add('bee1', BEE1, 16, 16);
  add('bee2', BEE2, 16, 16);
  COIN.forEach((rows, i) => add(`coin${i}`, rows, 16, 16));
  add('bigorange', BIG_ORANGE, 16, 16);
  add('teacup', TEACUP, 16, 16);
  add('leaf1up', LEAF_1UP, 16, 16);
  TEABALL.forEach((rows, i) => add(`teaball${i}`, rows, 8, 8));
  PUFF.forEach((rows, i) => add(`puff${i}`, rows, 16, 16));
  add('flag', FLAG, 16, 16);
  add('boss', BOSS, 32, 32);
  return out;
}

// ———————————————————— 地形图块（程序绘制，16×16） ————————————————————
export const THEMES = {
  field: {
    sky: '#86c8ff', ground: ['#c77a3e', '#8f4f22', '#e7a46a'], grass: ['#62c83f', '#3f8f2b', '#9be06a'],
    brick: ['#d06a2c', '#5e2a10', '#f2a466'], hard: ['#c9804a', '#6a3a1a', '#f1b98a'],
  },
  cave: {
    sky: '#0d1020', ground: ['#3d6fb8', '#1d3768', '#7aa6e8'], grass: null,
    brick: ['#3d7fc0', '#16345e', '#8ec0f0'], hard: ['#5f7fa8', '#24344c', '#a9c3e0'],
  },
  sky: {
    sky: '#ffb27a', ground: ['#d9a56a', '#8f5f2f', '#f5d3a0'], grass: ['#f4f4f8', '#b9c4d8', '#ffffff'],
    brick: ['#d97a3c', '#6a3010', '#f8b47a'], hard: ['#d08a52', '#6a3a1a', '#f6c79a'],
  },
  castle: {
    sky: '#1a0f14', ground: ['#8a8f9a', '#3c3f48', '#c3c8d2'], grass: null,
    brick: ['#80858f', '#34363d', '#bfc4cc'], hard: ['#9097a3', '#3a3d46', '#cfd4dc'],
  },
};

function px(c, x, y, w, h, col) {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

export function buildTiles(themeName) {
  const th = THEMES[themeName];
  const T = {};
  const tile = (name, fn, w = 16, h = 16) => {
    const cv = makeCanvas(w, h);
    fn(cv.getContext('2d'));
    T[name] = cv;
  };
  const [g0, g1, g2] = th.ground;
  // 地面
  tile('ground', (c) => {
    px(c, 0, 0, 16, 16, g0);
    if (th.grass) {
      const [q0, q1, q2] = th.grass;
      px(c, 0, 0, 16, 5, q0);
      px(c, 0, 5, 16, 1, q1);
      for (const x of [1, 5, 9, 13]) px(c, x, 0, 2, 1, q2);
      for (const x of [3, 11]) px(c, x, 5, 2, 2, q1);
      for (const [x, y] of [[2, 9], [9, 8], [6, 12], [13, 13], [1, 14]]) px(c, x, y, 2, 2, g1);
      for (const [x, y] of [[5, 9], [12, 10], [3, 12]]) px(c, x, y, 1, 1, g2);
    } else {
      // 地下/城堡：石块纹理
      px(c, 0, 0, 16, 1, g2);
      px(c, 0, 0, 1, 16, g2);
      px(c, 0, 15, 16, 1, g1);
      px(c, 15, 0, 1, 16, g1);
      px(c, 7, 1, 1, 7, g1);
      px(c, 1, 7, 14, 1, g1);
      px(c, 11, 8, 1, 7, g1);
      px(c, 3, 9, 2, 2, g2);
    }
  });
  tile('dirt', (c) => {
    px(c, 0, 0, 16, 16, g0);
    if (th.grass) {
      for (const [x, y] of [[2, 2], [9, 1], [6, 6], [13, 5], [1, 10], [10, 11], [5, 14]]) px(c, x, y, 2, 2, g1);
      for (const [x, y] of [[12, 2], [4, 9], [14, 13]]) px(c, x, y, 1, 1, g2);
    } else {
      px(c, 0, 0, 16, 1, g2);
      px(c, 0, 0, 1, 16, g2);
      px(c, 0, 15, 16, 1, g1);
      px(c, 15, 0, 1, 16, g1);
      px(c, 7, 1, 1, 7, g1);
      px(c, 1, 7, 14, 1, g1);
      px(c, 11, 8, 1, 7, g1);
    }
  });
  // 砖块
  const [b0, b1, b2] = th.brick;
  tile('brick', (c) => {
    px(c, 0, 0, 16, 16, b0);
    px(c, 0, 0, 16, 1, b1);
    px(c, 0, 7, 16, 1, b1);
    px(c, 0, 15, 16, 1, b1);
    px(c, 7, 1, 1, 6, b1);
    px(c, 15, 1, 1, 6, b1);
    px(c, 3, 8, 1, 7, b1);
    px(c, 11, 8, 1, 7, b1);
    px(c, 0, 1, 7, 1, b2);
    px(c, 8, 1, 7, 1, b2);
    px(c, 4, 8, 7, 1, b2);
    px(c, 12, 8, 4, 1, b2);
    px(c, 0, 8, 3, 1, b2);
  });
  // 硬块（台阶）
  const [h0, h1, h2] = th.hard;
  tile('hard', (c) => {
    px(c, 0, 0, 16, 16, h0);
    px(c, 0, 0, 16, 2, h2);
    px(c, 0, 0, 2, 16, h2);
    px(c, 0, 14, 16, 2, h1);
    px(c, 14, 0, 2, 16, h1);
    px(c, 4, 4, 8, 8, h0);
    px(c, 4, 4, 8, 1, h1);
    px(c, 4, 4, 1, 8, h1);
    px(c, 4, 11, 8, 1, h2);
    px(c, 11, 4, 1, 8, h2);
  });
  // 道具箱（橙子图案，4 帧闪光）
  const boxCols = ['#f2b630', '#ffd35c', '#ffe28a', '#ffd35c'];
  boxCols.forEach((bc, i) => tile(`box${i}`, (c) => {
    px(c, 0, 0, 16, 16, '#7a4a10');
    px(c, 1, 1, 14, 14, bc);
    px(c, 1, 1, 14, 1, '#fff2c0');
    px(c, 1, 14, 14, 1, '#c98a18');
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, x, y, 1, 1, '#7a4a10');
    // 橙子图标
    px(c, 5, 6, 6, 6, '#ff8a1c');
    px(c, 6, 5, 4, 8, '#ff8a1c');
    px(c, 4, 7, 8, 4, '#ff8a1c');
    px(c, 6, 6, 2, 2, '#ffd2a0');
    px(c, 7, 3, 1, 2, '#6a3a1a');
    px(c, 8, 3, 3, 2, '#3fae4a');
    px(c, 9, 10, 2, 2, '#d0600c');
  }));
  tile('used', (c) => {
    px(c, 0, 0, 16, 16, '#4a2a14');
    px(c, 1, 1, 14, 14, '#9a6234');
    px(c, 1, 14, 14, 1, '#6a3e1e');
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) px(c, x, y, 1, 1, '#4a2a14');
  });
  // 茶罐管道
  const canTop = (c, left) => {
    px(c, 0, 0, 16, 16, '#1f7a5c');
    px(c, left ? 1 : 0, 1, 15, 13, '#2fae8c');
    if (left) { px(c, 2, 2, 3, 11, '#8fe8c8'); px(c, 6, 2, 1, 11, '#58cfa8'); }
    else { px(c, 10, 2, 3, 11, '#1f8a6a'); px(c, 14, 1, 1, 13, '#1f7a5c'); }
    px(c, 0, 0, 16, 1, '#0f4a38');
    px(c, 0, 14, 16, 2, '#0f4a38');
    px(c, 0, 9, 16, 2, '#ffd23f');
    px(c, 0, 9, 16, 1, '#fff0a0');
  };
  tile('pipeTL', (c) => canTop(c, true));
  tile('pipeTR', (c) => canTop(c, false));
  const canBody = (c, left) => {
    px(c, 0, 0, 16, 16, '#1f7a5c');
    if (left) {
      px(c, 2, 0, 14, 16, '#2fae8c');
      px(c, 4, 0, 3, 16, '#8fe8c8');
      px(c, 8, 0, 1, 16, '#58cfa8');
      px(c, 2, 0, 1, 16, '#0f4a38');
    } else {
      px(c, 0, 0, 14, 16, '#2fae8c');
      px(c, 9, 0, 3, 16, '#1f8a6a');
      px(c, 13, 0, 1, 16, '#0f4a38');
    }
  };
  tile('pipeL', (c) => canBody(c, true));
  tile('pipeR', (c) => canBody(c, false));
  // 横向管道（右侧入口用）
  tile('pipeHT', (c) => {
    px(c, 0, 0, 16, 16, '#0f4a38');
    px(c, 1, 0, 13, 16, '#2fae8c');
    px(c, 1, 2, 13, 3, '#8fe8c8');
    px(c, 9, 0, 2, 16, '#ffd23f');
  });
  tile('pipeHB', (c) => {
    px(c, 0, 0, 16, 16, '#0f4a38');
    px(c, 1, 0, 13, 15, '#2fae8c');
    px(c, 1, 10, 13, 3, '#1f8a6a');
    px(c, 9, 0, 2, 15, '#ffd23f');
  });
  tile('pipeHL', (c) => {
    px(c, 0, 0, 16, 16, '#1f7a5c');
    px(c, 0, 2, 16, 12, '#2fae8c');
    px(c, 0, 3, 16, 3, '#8fe8c8');
    px(c, 0, 1, 16, 1, '#0f4a38');
    px(c, 0, 14, 16, 1, '#0f4a38');
  });
  // 云朵平台（可从下方穿过）
  tile('cloud', (c) => {
    px(c, 0, 3, 16, 8, '#ffffff');
    px(c, 2, 1, 5, 3, '#ffffff');
    px(c, 9, 0, 5, 4, '#ffffff');
    px(c, 0, 10, 16, 2, '#cfd8ea');
    px(c, 3, 2, 2, 1, '#f0f4ff');
  });
  // 木桥
  tile('bridge', (c) => {
    px(c, 0, 0, 16, 6, '#b8803f');
    px(c, 0, 0, 16, 1, '#f0c27a');
    px(c, 0, 5, 16, 1, '#6a4320');
    px(c, 7, 0, 1, 6, '#6a4320');
    px(c, 2, 6, 2, 4, '#6a4320');
    px(c, 12, 6, 2, 4, '#6a4320');
  });
  // 尖刺
  tile('spike', (c) => {
    for (let i = 0; i < 4; i++) {
      const x0 = i * 4;
      for (let r = 0; r < 8; r++) {
        const half = Math.floor(r / 4);
        px(c, x0 + 1 - half, 8 + r, 2 + half * 2, 1, r < 2 ? '#ffffff' : '#a7adb6');
      }
      px(c, x0 + 1, 6, 2, 2, '#eef1f4');
    }
    px(c, 0, 15, 16, 1, '#646b75');
  });
  // 岩浆（2 帧）
  for (let f = 0; f < 2; f++) tile(`lava${f}`, (c) => {
    px(c, 0, 0, 16, 16, '#d8300c');
    px(c, 0, 0, 16, 3, '#ff8a1c');
    for (let x = 0; x < 16; x += 4) px(c, (x + f * 2) % 16, 1, 2, 2, '#ffd84a');
    px(c, 3 + f * 5, 8, 3, 2, '#ff6a1a');
    px(c, 10 - f * 4, 12, 2, 2, '#ff6a1a');
  });
  // 旗杆
  tile('pole', (c) => {
    px(c, 7, 0, 2, 16, '#e8f4e8');
    px(c, 8, 0, 1, 16, '#9ec89e');
  });
  tile('poleTop', (c) => {
    px(c, 7, 6, 2, 10, '#e8f4e8');
    px(c, 5, 1, 6, 6, '#3fae4a');
    px(c, 4, 2, 8, 4, '#3fae4a');
    px(c, 6, 2, 2, 2, '#b8f0b8');
  });
  // 存档点灯笼（2 帧：灭 / 亮）
  for (let f = 0; f < 2; f++) tile(`check${f}`, (c) => {
    px(c, 3, 2, 2, 14, '#6a4320');
    px(c, 3, 2, 8, 1, '#6a4320');
    px(c, 9, 3, 1, 2, '#333333');
    px(c, 7, 5, 5, 7, f ? '#ff5a3a' : '#8a8f9a');
    px(c, 8, 4, 3, 9, f ? '#ff5a3a' : '#8a8f9a');
    px(c, 8, 6, 1, 5, f ? '#ffd0a0' : '#b0b4bc');
    px(c, 7, 4, 5, 1, '#333333');
    px(c, 7, 12, 5, 1, '#333333');
  });
  return T;
}

// 背景装饰：小山 / 灌木 / 云朵（像素风）
export function buildDecor(themeName) {
  const D = {};
  const mk = (name, w, h, fn) => {
    const cv = makeCanvas(w, h);
    fn(cv.getContext('2d'));
    D[name] = cv;
  };
  mk('hill', 80, 40, (c) => {
    for (let y = 0; y < 40; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((40 - y) / 40, 2))) * 40);
      px(c, 40 - half, y, half * 2, 1, '#5cb84a');
    }
    for (let y = 2; y < 40; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((40 - y) / 40, 2))) * 40);
      px(c, 40 - half, y, 2, 1, '#2f7a2a');
      px(c, 40 + half - 2, y, 2, 1, '#2f7a2a');
    }
    for (const [x, y] of [[30, 16], [48, 22], [38, 30], [56, 32], [22, 30]]) {
      px(c, x, y, 3, 6, '#2f7a2a');
    }
  });
  mk('bush', 48, 16, (c) => {
    for (const [cx, r] of [[10, 9], [24, 11], [38, 9]]) {
      for (let y = 0; y < 16; y++) {
        const dy = 16 - y;
        if (dy > r) continue;
        const half = Math.round(Math.sqrt(r * r - dy * dy));
        px(c, cx - half, y, half * 2, 1, '#4fb83c');
      }
    }
    px(c, 0, 15, 48, 1, '#2f7a2a');
    for (const [x, y] of [[8, 9], [22, 6], [36, 9]]) px(c, x, y, 3, 2, '#86e06a');
  });
  mk('cloud', 48, 24, (c) => {
    const col = themeName === 'sky' ? '#fff4ec' : '#ffffff';
    const sh = themeName === 'sky' ? '#f6c9b0' : '#cfe3ff';
    for (const [cx, cy, r] of [[12, 15, 8], [24, 10, 10], [36, 15, 8]]) {
      for (let y = -r; y <= r; y++) {
        const half = Math.round(Math.sqrt(r * r - y * y));
        px(c, cx - half, cy + y, half * 2, 1, col);
      }
    }
    px(c, 4, 20, 40, 3, col);
    px(c, 4, 22, 40, 1, sh);
  });
  mk('teabush', 32, 16, (c) => {
    for (let y = 4; y < 16; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, 144 - Math.pow(16 - y, 2))) * 1.3);
      px(c, 16 - half, y, half * 2, 1, '#2f8f4a');
    }
    for (const [x, y] of [[8, 8], [14, 6], [20, 9], [25, 11], [5, 12]]) px(c, x, y, 2, 2, '#6fd08a');
  });
  mk('fence', 16, 16, (c) => {
    px(c, 2, 4, 3, 12, '#f0e0c0');
    px(c, 11, 4, 3, 12, '#f0e0c0');
    px(c, 0, 7, 16, 2, '#e0c8a0');
    px(c, 0, 12, 16, 2, '#e0c8a0');
  });
  mk('lantern', 16, 32, (c) => {
    px(c, 7, 0, 2, 32, '#5a3a20');
    px(c, 3, 6, 10, 12, '#ff6a3a');
    px(c, 4, 5, 8, 14, '#ff6a3a');
    px(c, 6, 7, 2, 9, '#ffd0a0');
    px(c, 3, 5, 10, 1, '#2a2a2a');
    px(c, 3, 18, 10, 1, '#2a2a2a');
  });
  return D;
}

// 终点茶室（像素画，80×80）
export function buildTeaHouse() {
  const cv = makeCanvas(80, 80);
  const c = cv.getContext('2d');
  // 台基
  px(c, 2, 74, 76, 6, '#9a9fa8');
  px(c, 2, 74, 76, 1, '#d0d4da');
  // 墙
  px(c, 8, 38, 64, 36, '#d9a36a');
  px(c, 8, 38, 64, 2, '#b07440');
  for (const x of [8, 30, 48, 70]) px(c, x, 38, 2, 36, '#8a5a30');
  // 窗
  for (const x of [13, 53]) {
    px(c, x, 46, 14, 14, '#fff3dc');
    px(c, x, 46, 14, 1, '#6a4320');
    px(c, x, 59, 14, 1, '#6a4320');
    px(c, x, 46, 1, 14, '#6a4320');
    px(c, x + 13, 46, 1, 14, '#6a4320');
    px(c, x + 7, 46, 1, 14, '#6a4320');
    px(c, x, 53, 14, 1, '#6a4320');
    px(c, x + 1, 47, 6, 6, '#ffd9a0');
  }
  // 门 + 门帘
  px(c, 32, 50, 16, 24, '#3a2418');
  px(c, 31, 48, 18, 10, '#2fae8c');
  px(c, 39, 48, 2, 10, '#1c7a62');
  px(c, 31, 48, 18, 1, '#8fe8c8');
  // 叶子徽记
  px(c, 35, 52, 3, 2, '#ffffff');
  px(c, 43, 52, 3, 2, '#ffffff');
  // 屋顶
  for (let y = 0; y < 14; y++) {
    const inset = Math.max(0, 14 - y) * 1.2;
    px(c, Math.round(10 + inset), 24 + y, Math.round(60 - inset * 2), 1, y % 3 === 0 ? '#3f4458' : '#525870');
  }
  px(c, 0, 36, 80, 3, '#3f4458');
  px(c, 0, 35, 4, 2, '#3f4458');
  px(c, 76, 35, 4, 2, '#3f4458');
  px(c, 0, 34, 2, 2, '#3f4458');
  px(c, 78, 34, 2, 2, '#3f4458');
  // 上层小屋顶
  px(c, 22, 14, 36, 10, '#d9a36a');
  for (let y = 0; y < 10; y++) {
    const inset = Math.max(0, 10 - y) * 1.4;
    px(c, Math.round(18 + inset), 4 + y, Math.round(44 - inset * 2), 1, y % 3 === 0 ? '#3f4458' : '#525870');
  }
  px(c, 14, 13, 52, 2, '#3f4458');
  // 牌匾
  px(c, 32, 16, 16, 7, '#b8322a');
  px(c, 33, 17, 14, 5, '#d8463a');
  px(c, 36, 18, 2, 3, '#ffe08a');
  px(c, 42, 18, 2, 3, '#ffe08a');
  px(c, 38, 19, 4, 1, '#ffe08a');
  // 灯笼
  for (const x of [4, 72]) {
    px(c, x + 1, 39, 1, 3, '#2a2a2a');
    px(c, x - 1, 42, 6, 8, '#ff5a3a');
    px(c, x, 41, 4, 10, '#ff5a3a');
    px(c, x + 1, 43, 1, 6, '#ffd0a0');
  }
  return cv;
}

// 远景视差层（可横向平铺，320×180）
export function buildParallax(themeName) {
  const far = makeCanvas(320, 180);
  const c = far.getContext('2d');
  if (themeName === 'field') {
    for (let x = 0; x < 320; x++) {
      const h = 60 + Math.round(18 * Math.sin((x / 320) * Math.PI * 4 + 0.6) + 10 * Math.sin((x / 320) * Math.PI * 10));
      px(c, x, 180 - h, 1, h, '#a8d8ff');
    }
    for (let x = 0; x < 320; x++) {
      const h = 38 + Math.round(12 * Math.sin((x / 320) * Math.PI * 6 + 1.7) + 6 * Math.sin((x / 320) * Math.PI * 14));
      px(c, x, 180 - h, 1, h, '#9fd8a0');
    }
  } else if (themeName === 'cave') {
    for (let i = 0; i < 60; i++) {
      const x = (i * 53) % 320, y = 20 + ((i * 97) % 150);
      px(c, x, y, 2, 2, i % 3 ? '#1a2240' : '#24305a');
    }
    for (let x = 0; x < 320; x++) {
      const h = 18 + Math.round(8 * Math.sin((x / 320) * Math.PI * 8));
      px(c, x, 0, 1, h, '#161c34');
      px(c, x, 180 - h, 1, h, '#161c34');
    }
  } else if (themeName === 'sky') {
    const bands = ['#ffd8a8', '#ffc894', '#ffb882', '#ff9f78', '#f88a7a', '#e2788a'];
    bands.forEach((col, i) => px(c, 0, 60 + i * 22, 320, 22, col));
    for (let x = 0; x < 320; x++) {
      const h = 24 + Math.round(10 * Math.sin((x / 320) * Math.PI * 6 + 0.3) + 5 * Math.sin((x / 320) * Math.PI * 16));
      px(c, x, 180 - h, 1, h, '#fff0e6');
    }
  } else {
    for (let y = 0; y < 180; y += 16) for (let x = 0; x < 320; x += 32) {
      px(c, x + (y / 16 % 2) * 16, y, 31, 15, '#241820');
    }
  }
  return far;
}
