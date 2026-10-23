// 软件清单：HOME 菜单上的游戏磁贴顺序 + 系统小程序
import { PixelAdventure } from './games/pixeladventure.js';
import { Shooter } from './games/shooter.js';
import { Breakout } from './games/breakout.js';
import { Snake } from './games/snake.js';
import { Game2048 } from './games/g2048.js';
import { Blocks } from './games/blocks.js';
import { Mines } from './games/mines.js';
import { Pong } from './games/pong.js';
import { Kart } from './games/kart.js';
import { Turf } from './games/turf.js';
import { Brawl } from './games/brawl.js';
import { Island } from './games/island.js';
import { Album } from './apps/album.js';
import { Settings } from './apps/settings.js';
import { Tester } from './apps/tester.js';
import { News } from './apps/news.js';

// HOME 菜单上的磁贴（第一个是《橙子大冒险》，后面紧跟四款新作）
export const GAMES = [PixelAdventure, Kart, Turf, Brawl, Island, Blocks, Shooter, Pong, Breakout, Mines, Snake, Game2048];
export const SYSTEM_APPS = { news: News, album: Album, settings: Settings, tester: Tester };
