// 《茶杯卡丁车》原创配乐（旋律、和声都是原创），格式：音名:16分音符个数，“-” 休止，k/s/h 鼓
import { parseTrack } from '../../audio.js';

const T = (str) => parseTrack(str.replace(/\|/g, ' '));
const rep = (str, n) => Array(n).fill(str).join(' ');
const CH = {
  D: ['D3', 'A3', 'D4'], A: ['A2', 'E3', 'A3'], Bm: ['B2', 'F#3', 'B3'], G: ['G2', 'D3', 'G3'], 'F#m': ['F#2', 'C#3', 'F#3'],
  Am: ['A2', 'E3', 'A3'], F: ['F2', 'C3', 'F3'], C: ['C3', 'G3', 'C4'], E: ['E2', 'B2', 'E3'], Dm: ['D3', 'A3', 'D4'],
  Bb: ['Bb2', 'F3', 'Bb3'], Gs: ['G2', 'D3', 'G3'],
};
const bass = (chords) => chords.map((c) => { const [r, f, o] = CH[c]; return `${r}:2 ${f}:2 ${o}:2 ${f}:2 ${r}:2 ${f}:2 ${o}:2 ${f}:2`; }).join(' ');
const pump = (chords) => chords.map((c) => { const [r, , o] = CH[c]; return `${r}:2 ${r}:2 ${o}:2 ${r}:2 ${r}:2 ${o}:2 ${r}:2 ${o}:2`; }).join(' ');

// 茶园环道：明亮的大调进行曲
export const SONG_GARDEN = {
  bpm: 164,
  tracks: [
    {
      wave: 'p25', vol: 0.11, notes: T(`
        D5:2 F#5:2 A5:3 F#5:1 E5:2 D5:2 E5:2 F#5:2 | E5:2 C#5:2 A4:4 -:2 A4:2 B4:2 C#5:2 |
        D5:2 B4:2 F#5:3 D5:1 B4:2 A4:2 B4:2 D5:2 | G5:3 F#5:1 E5:2 D5:2 E5:6 -:2 |
        D5:2 F#5:2 A5:3 B5:1 A5:2 F#5:2 D5:2 F#5:2 | E5:2 A5:2 C#6:4 B5:2 A5:2 G5:2 E5:2 |
        F#5:2 D5:2 B4:2 D5:2 G5:4 F#5:2 E5:2 | D5:4 A4:2 D5:2 D5:6 -:2 |
        B5:2 A5:2 G5:2 D5:2 G5:2 A5:2 B5:4 | C#6:2 B5:2 A5:2 E5:2 A5:4 -:2 C#6:2 |
        A5:2 F#5:2 C#5:2 F#5:2 A5:3 G5:1 F#5:2 E5:2 | F#5:2 D5:2 B4:2 D5:2 F#5:4 E5:4 |
        G5:2 B5:2 D6:2 B5:2 G5:2 D5:2 G5:2 B5:2 | A5:2 C#6:2 E6:2 C#6:2 A5:2 E5:2 A5:2 C#6:2 |
        D6:3 C#6:1 B5:2 A5:2 F#5:2 A5:2 D6:4 | D6:4 A5:4 D5:4 -:4`),
    },
    { wave: 'triangle', vol: 0.24, gate: 0.62, notes: T(bass(['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'])) },
    { wave: 'noise', vol: 0.07, notes: T(rep('k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2', 16)) },
  ],
};

// 橙子海滩：轻快的热带节奏
export const SONG_BEACH = {
  bpm: 150,
  tracks: [
    {
      wave: 'p25', vol: 0.11, notes: T(`
        F5:2 A5:2 C6:2 A5:2 F5:2 G5:2 A5:4 | G5:2 E5:2 C5:2 E5:2 G5:4 -:4 |
        A5:2 F5:2 D5:2 F5:2 A5:3 G5:1 F5:2 D5:2 | Bb5:4 A5:2 G5:2 F5:4 D5:4 |
        F5:2 A5:2 C6:2 D6:2 C6:2 A5:2 F5:4 | E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 |
        D5:2 F5:2 Bb5:4 A5:2 F5:2 D5:4 | C5:2 E5:2 G5:2 Bb5:2 A5:4 G5:4`),
    },
    { wave: 'triangle', vol: 0.25, gate: 0.6, notes: T(bass(['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C'])) },
    { wave: 'p12', vol: 0.045, gate: 0.5, notes: T(rep('-:2 A4:2 -:2 C5:2 -:2 A4:2 -:2 C5:2', 8)) },
    { wave: 'noise', vol: 0.07, notes: T(rep('k:3 h:1 s:2 k:2 k:2 h:2 s:2 h:2', 8)) },
  ],
};

// 夜市霓虹：小调合成器
export const SONG_NIGHT = {
  bpm: 136,
  tracks: [
    {
      wave: 'p12', vol: 0.11, notes: T(`
        A4:2 C5:2 E5:2 A5:4 G5:2 E5:2 C5:2 | F5:4 E5:2 C5:2 A4:6 -:2 |
        G4:2 C5:2 E5:2 G5:4 F5:2 E5:2 D5:2 | D5:4 B4:2 G4:2 B4:6 -:2 |
        A4:2 C5:2 E5:2 A5:3 B5:1 C6:2 B5:2 A5:2 | F5:2 A5:2 C6:4 A5:2 F5:2 C5:4 |
        G5:3 F5:1 E5:2 D5:2 G5:4 B4:4 | E5:4 G#4:4 B4:4 E5:4`),
    },
    { wave: 'sawtooth', vol: 0.09, gate: 0.5, notes: T(pump(['Am', 'F', 'C', 'Gs', 'Am', 'F', 'Gs', 'E'])) },
    { wave: 'noise', vol: 0.08, notes: T(rep('k:4 s:4 k:2 k:2 s:4', 8)) },
    { wave: 'noise', vol: 0.04, notes: T(rep('h:2', 64)) },
  ],
};

export const SONGS = { garden: SONG_GARDEN, beach: SONG_BEACH, night: SONG_NIGHT };

export const JINGLE_WIN = {
  bpm: 150,
  tracks: [
    { wave: 'p25', vol: 0.13, notes: T('C5:2 E5:2 G5:2 C6:4 -:2 G5:2 C6:2 | E6:8 D6:2 E6:2 C6:8 -:4') },
    { wave: 'triangle', vol: 0.25, notes: T('C3:4 G3:4 C4:4 G3:4 | C3:8 G2:8 C3:8') },
  ],
};
export const JINGLE_LOSE = {
  bpm: 130,
  tracks: [
    { wave: 'p25', vol: 0.12, notes: T('E5:3 D5:3 C5:4 -:2 D5:2 E5:2 | C5:6 G4:6 C5:8') },
    { wave: 'triangle', vol: 0.22, notes: T('C3:8 G2:8 | A2:8 F2:4 C3:8') },
  ],
};
