// 《橙子大冒险》原创 8-bit 配乐（旋律均为原创），格式：音名:16分音符个数，“-” 为休止，k/s/h 为鼓
import { parseTrack } from '../../audio.js';

const T = (str) => parseTrack(str.replace(/\|/g, ' '));
const rep = (str, n) => Array(n).fill(str).join(' ');

// 低音：根音-五音-八度-五音
const bassBar = (r, f, o) => `${r}:2 ${f}:2 ${o}:2 ${f}:2 ${r}:2 ${f}:2 ${o}:2 ${f}:2`;
const CH = {
  C: ['C3', 'G3', 'C4'], F: ['F2', 'C3', 'F3'], G: ['G2', 'D3', 'G3'], Am: ['A2', 'E3', 'A3'], Em: ['E2', 'B2', 'E3'],
  D: ['D3', 'A3', 'D4'], Bm: ['B2', 'F#3', 'B3'], A: ['A2', 'E3', 'A3'], E: ['E2', 'B2', 'E3'],
};
const bassLine = (chords) => chords.map((c) => bassBar(...CH[c])).join(' ');

// 1-1 草原：轻快的进行曲
export const SONG_FIELD = {
  bpm: 150,
  tracks: [
    {
      wave: 'p25', vol: 0.13, notes: T(`
        G4:2 C5:2 E5:2 G5:4 E5:2 C5:2 D5:2 | E5:2 D5:2 C5:2 A4:2 G4:6 -:2 |
        A4:2 C5:2 F5:2 A5:4 G5:2 F5:2 E5:2 | D5:2 E5:2 F5:2 D5:2 G5:6 -:2 |
        G4:2 C5:2 E5:2 G5:4 A5:2 G5:2 E5:2 | F5:2 E5:2 D5:2 C5:2 A4:4 C5:4 |
        D5:3 E5:1 F5:2 E5:2 D5:2 B4:2 G4:4 | C5:4 G4:2 E4:2 C4:4 -:4 |
        E5:4 F5:2 G5:2 A5:4 G5:4 | F5:2 E5:2 D5:2 E5:2 C5:8 |
        D5:4 E5:2 F5:2 G5:4 F5:4 | E5:2 D5:2 C5:2 D5:2 B4:8 |
        C5:2 E5:2 G5:2 C6:4 B5:2 A5:2 G5:2 | A5:2 G5:2 F5:2 E5:2 D5:4 G4:4 |
        C5:2 D5:2 E5:2 F5:2 G5:2 A5:2 B5:2 C6:2 | C6:4 G5:4 C5:4 -:4`),
    },
    { wave: 'triangle', vol: 0.26, gate: 0.7, notes: T(bassLine(['C', 'Am', 'F', 'G', 'C', 'F', 'G', 'C', 'C', 'F', 'G', 'Em', 'C', 'F', 'G', 'C'])) },
    { wave: 'noise', vol: 0.07, notes: T(rep('k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2', 16)) },
  ],
};

// 1-2 地下：低沉的小调
export const SONG_CAVE = {
  bpm: 118,
  tracks: [
    {
      wave: 'p12', vol: 0.12, notes: T(`
        A4:4 C5:2 E5:2 D5:4 C5:4 | B4:4 D5:2 G5:2 F5:4 E5:4 |
        A4:4 C5:2 F5:2 E5:4 D5:4 | E5:6 D5:2 C5:4 B4:4 |
        -:8 E5:2 F5:2 E5:4 | D5:2 C5:2 B4:4 G4:8 |
        F4:2 A4:2 C5:2 F5:2 E5:4 C5:4 | B4:4 G#4:4 E4:8`),
    },
    {
      wave: 'triangle', vol: 0.3, gate: 0.6, notes: T(rep(`
        A2:2 -:2 A2:2 C3:2 E3:2 -:2 D3:2 C3:2 | G2:2 -:2 G2:2 B2:2 D3:2 -:2 C3:2 B2:2 |
        F2:2 -:2 F2:2 A2:2 C3:2 -:2 B2:2 A2:2 | E2:2 -:2 E2:2 G#2:2 B2:4 E3:4`, 2)),
    },
    { wave: 'noise', vol: 0.06, notes: T(rep('h:4 s:4 h:4 s:4', 8)) },
  ],
};

// 1-3 天空：空灵的大调
export const SONG_SKY = {
  bpm: 132,
  tracks: [
    {
      wave: 'triangle', vol: 0.24, notes: T(`
        D5:4 F#5:4 A5:4 F#5:4 | G5:4 B5:2 A5:2 G5:4 F#5:4 |
        E5:4 G5:4 B5:2 A5:2 G5:4 | F#5:6 E5:2 D5:8 |
        B4:4 D5:4 F#5:4 D5:4 | E5:4 G5:2 F#5:2 E5:4 D5:4 |
        C#5:4 E5:4 A5:4 G5:2 E5:2 | D5:12 -:4`),
    },
    {
      wave: 'p25', vol: 0.06, gate: 0.5, notes: T(rep(`
        A4:2 D5:2 F#5:2 D5:2 A4:2 D5:2 F#5:2 D5:2 | B4:2 D5:2 G5:2 D5:2 B4:2 D5:2 G5:2 D5:2 |
        B4:2 E5:2 G5:2 E5:2 C#5:2 E5:2 A5:2 E5:2 | A4:2 D5:2 F#5:2 D5:2 A4:2 D5:2 F#5:2 D5:2`, 2)),
    },
    { wave: 'triangle', vol: 0.2, gate: 0.8, notes: T(`D3:8 A2:8 | G2:8 D3:8 | E3:8 A2:8 | D3:8 A2:8 | B2:8 F#3:8 | E3:8 B2:8 | A2:8 E3:8 | D3:16`) },
    { wave: 'noise', vol: 0.05, notes: T(rep('h:4 h:4 s:4 h:4', 8)) },
  ],
};

// 1-4 城堡：紧张的半音低音
export const SONG_CASTLE = {
  bpm: 140,
  tracks: [
    {
      wave: 'p25', vol: 0.11, notes: T(`
        E5:2 -:2 E5:2 F5:2 E5:2 -:2 D#5:2 E5:2 | G5:4 F#5:4 E5:4 B4:4 |
        E5:2 -:2 E5:2 F5:2 E5:2 -:2 D#5:2 E5:2 | C5:4 B4:4 A4:4 B4:4 |
        A4:2 C5:2 E5:2 A5:2 G5:4 E5:4 | F#5:2 E5:2 D#5:2 E5:2 B4:8 |
        C5:2 E5:2 G5:2 C6:2 B5:4 G5:4 | A5:4 F#5:4 D#5:4 B4:4`),
    },
    { wave: 'triangle', vol: 0.3, gate: 0.5, notes: T(rep('E2:2 E2:2 F2:2 E2:2 E2:2 F2:2 E2:2 D#2:2', 8)) },
    { wave: 'noise', vol: 0.07, notes: T(rep('k:2 h:2 k:2 s:2 k:2 h:2 s:2 s:2', 8)) },
  ],
};

// 过关
export const JINGLE_CLEAR = {
  bpm: 160,
  tracks: [
    { wave: 'p25', vol: 0.14, notes: T('G4:2 C5:2 E5:2 G5:2 C6:4 G5:2 C6:10 -:4') },
    { wave: 'p25', vol: 0.08, notes: T('E4:2 G4:2 C5:2 E5:2 G5:4 E5:2 G5:10 -:4') },
    { wave: 'triangle', vol: 0.28, notes: T('C3:4 G3:4 C4:4 G3:2 C3:10 -:4') },
  ],
};

// 失误
export const JINGLE_DIE = {
  bpm: 140,
  tracks: [
    { wave: 'p25', vol: 0.14, notes: T('C5:2 B4:2 A#4:2 A4:4 -:2 F4:2 E4:2 D4:2 C4:8') },
    { wave: 'triangle', vol: 0.26, notes: T('C3:6 -:2 F2:4 -:2 G2:4 C2:8') },
  ],
};

// 游戏结束
export const JINGLE_OVER = {
  bpm: 100,
  tracks: [
    { wave: 'p25', vol: 0.13, notes: T('E4:4 C4:4 A3:4 G3:8 -:4 F3:4 E3:8') },
    { wave: 'triangle', vol: 0.26, notes: T('C3:4 A2:4 F2:4 E2:8 -:4 D2:4 C2:8') },
  ],
};

// 全部通关
export const JINGLE_ENDING = {
  bpm: 120,
  tracks: [
    { wave: 'p25', vol: 0.13, notes: T('C5:4 E5:4 G5:4 C6:4 | B5:4 G5:4 A5:8 | F5:4 A5:4 C6:4 F6:4 | E6:8 C6:8 | D6:4 B5:4 G5:4 B5:4 | C6:16') },
    { wave: 'triangle', vol: 0.26, notes: T('C3:8 G3:8 | E3:8 A2:8 | F2:8 C3:8 | C3:8 A2:8 | G2:8 G3:8 | C3:16') },
  ],
};
