// 新闻：系统公告与小贴士（内容原创）
import { W, H, clamp, damp, text, textW, font, fillRR, strokeRR, rrect, drawHints, Nav, makeCanvas, outlineText } from '../ui.js';
import { lineNews } from '../icons.js';
import { PixelAdventure } from '../games/pixeladventure.js';
import { Blocks } from '../games/blocks.js';
import { Mines } from '../games/mines.js';
import { Pong } from '../games/pong.js';
import { Shooter } from '../games/shooter.js';
import { Breakout } from '../games/breakout.js';
import { Game2048 } from '../games/g2048.js';
import { Snake } from '../games/snake.js';
import { Kart } from '../games/kart.js';
import { Turf } from '../games/turf.js';
import { Brawl } from '../games/brawl.js';
import { Island } from '../games/island.js';

const GAME_LIST = [PixelAdventure, Kart, Turf, Brawl, Island, Blocks, Mines, Pong, Shooter, Breakout, Game2048, Snake];
const tileOf = (id) => GAME_LIST.find((g) => g.meta.id === id);

const ARTICLES = [
  {
    title: '新作上架：《茶杯卡丁车》《泼彩大作战》',
    tag: '新游戏',
    tiles: ['kart', 'turf'],
    color: ['#ff9a3c', '#2bb5d8'],
    body: '《茶杯卡丁车》：三条赛道、六位水果车手。转弯时按住 R 漂移，火花变紫再松开冲得最快；L 使用道具。\n《泼彩大作战》：四对四涂地，两分钟内地盘大的一方赢。按住 B 潜进颜色里游动回墨，R 扔炸弹，X 放必杀。',
  },
  {
    title: '新作上架：《茶室大乱斗》《茶岛生活》',
    tag: '新游戏',
    tiles: ['brawl', 'island'],
    color: ['#5a4fd0', '#4fae55'],
    body: '《茶室大乱斗》：伤害越高飞得越远，把对手打出场外！方向 + A / B 出不同招式，按住 Y 蓄力，ZL / ZR 防御。\n《茶岛生活》：钓鱼、捉虫、摇果树换茶币，还清贷款把帐篷升级成两层茶屋，再把图鉴集满。会自动存档。',
  },
  {
    title: '新作上架：《橙子大冒险》',
    tag: '新游戏',
    tiles: ['orange8'],
    color: ['#79c4ff', '#ffb36b'],
    body: '经典 8-bit 风格的横版闯关来啦！橙发少女要穿过草原、地下、天空和城堡，打倒大团子王，最后回到茶室喝茶。\n· 按住 B 奔跑，跑起来能跳得更远；按住 A 跳得更高\n· 从下面顶道具箱：大橙子让你变大，茶杯让你可以扔茶叶球\n· 站在茶罐管道上按 ↓，也许能钻进隐藏的奖励房间\n· 终点旗杆抓得越高，分数越多',
  },
  {
    title: '三款经典小游戏同时上线',
    tag: '新游戏',
    tiles: ['blocks', 'mines', 'pong'],
    color: ['#3b2a22', '#1d1512'],
    body: '《方块消除》：把下落的方块拼满一整行就能消除，支持暂存、硬降和逐级加速。\n《扫雷》：9×9 / 16×16 两档难度，第一次翻开一定安全，A 翻开、B 插旗。\n《双人乒乓》：把两只 Joy-Con 分给朋友，左手柄对战右手柄；右边没人时由 AI 接管。',
  },
  {
    title: '小贴士：截图与相册',
    tag: '小贴士',
    tiles: ['shooter'],
    color: ['#2f8fff', '#7a5cff'],
    body: '玩到精彩的地方时，按一下左手柄上的截图键（键盘 C），画面会白光一闪并保存到相册。\n回到 HOME 菜单，打开下方的“相册”就能浏览所有截图，在 3D 查看器里还能下载保存。',
  },
  {
    title: '键盘也能玩：按键速查表',
    tag: '小贴士',
    tiles: ['breakout'],
    color: ['#24a88f', '#2b6fb0'],
    body: '左摇杆 W A S D　十字键 ↑↓←→\nA：L / 空格 / 回车　B：K　X：I　Y：J\nL / ZL：Q / E　R / ZR：O / U　+ / −：= / -\nHOME：H　截图：C　电源：P　音量：] / [\n也可以直接用鼠标点 3D 模型上的按键，或者点屏幕（触摸）。',
  },
  {
    title: '茶室 OS 1.0 更新说明',
    tag: '公告',
    tiles: ['2048', 'snake'],
    color: ['#ff9a3c', '#ff7a1a'],
    body: '全新 HOME 菜单、睡眠与锁屏、电源选项、音量浮层、系统设置、手柄测试与触摸操作都已就绪。\n本作是非官方粉丝作品，与任天堂无关；所有游戏、美术与音乐均为原创程序实时生成。',
  },
];

function wrap(c, str, maxW, size, weight = 500) {
  c.font = font(size, weight);
  const out = [];
  for (const para of str.split('\n')) {
    let line = '';
    for (const ch of para) {
      // 避免标点出现在行首
      if (c.measureText(line + ch).width > maxW && line && !'，。、！？；：）」』…'.includes(ch)) {
        out.push(line);
        line = ch;
      } else line += ch;
    }
    out.push(line);
  }
  return out;
}

function banner(a, w, h) {
  const cv = makeCanvas(w, h);
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, a.color[0]);
  g.addColorStop(1, a.color[1]);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    c.arc((i * 137) % w, (i * 71) % h, 30 + (i % 3) * 30, 0, Math.PI * 2);
    c.fill();
  }
  const n = a.tiles.length;
  const ts = Math.min(h - 30, (w - 40 - (n - 1) * 16) / n);
  const x0 = w - 20 - n * ts - (n - 1) * 16;
  a.tiles.forEach((id, i) => {
    const cls = tileOf(id);
    if (!cls) return;
    const t = makeCanvas(256, 256);
    cls.meta.tile(t.getContext('2d'), 256);
    const x = x0 + i * (ts + 16), y = (h - ts) / 2;
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(x + 3, y + 6, ts, ts);
    c.save();
    rrect(c, x, y, ts, ts, 6);
    c.clip();
    c.drawImage(t, x, y, ts, ts);
    c.restore();
  });
  return cv;
}

export class News {
  static meta = { id: 'news', name: '新闻', kind: 'system' };

  constructor(os) {
    this.os = os;
    this.sel = 0;
    this.selY = 0;
    this.nav = new Nav();
    this.t = 0;
    this.banners = ARTICLES.map((a) => banner(a, 740, 250));
    this.thumbs = this.banners.map((b) => {
      const t = makeCanvas(120, 72);
      const tc = t.getContext('2d');
      tc.drawImage(b, 740 - 417, 0, 417, 250, 0, 0, 120, 72);
      return t;
    });
  }

  update(dt, pad) {
    this.t += dt;
    const d = this.nav.update(dt, pad);
    if (d === 'up' && this.sel > 0) { this.sel--; this.os.sfx.play('tick'); }
    if (d === 'down' && this.sel < ARTICLES.length - 1) { this.sel++; this.os.sfx.play('tick'); }
    if (pad.pressed.B) { this.os.sfx.play('back'); this.os.exitApp(); }
    this.selY = damp(this.selY, this.sel, 18, dt);
  }

  tap(x, y) {
    for (let i = 0; i < ARTICLES.length; i++) {
      const ly = 122 + i * 102;
      if (x >= 30 && x <= 450 && y >= ly && y <= ly + 92) {
        if (this.sel !== i) { this.sel = i; this.os.sfx.play('tick'); }
        return true;
      }
    }
    return false;
  }

  draw(c) {
    const th = this.os.theme;
    c.fillStyle = th.bg;
    c.fillRect(0, 0, W, H);
    lineNews(c, 62, 58, 46, '#e8453c');
    text(c, '新闻', 96, 58, 30, th.text, 'left', 700);
    c.fillStyle = th.line;
    c.fillRect(30, 100, W - 60, 1.5);
    // 左侧列表
    for (let i = 0; i < ARTICLES.length; i++) {
      const a = ARTICLES[i];
      const y = 122 + i * 102;
      const sel = i === this.sel;
      fillRR(c, 30, y, 420, 92, 8, sel ? th.selBg : th.card);
      c.save();
      rrect(c, 40, y + 10, 120, 72, 4);
      c.clip();
      c.drawImage(this.thumbs[i], 40, y + 10, 120, 72);
      c.restore();
      const lines = wrap(c, a.title, 260, 19, 600);
      lines.slice(0, 2).forEach((ln, k) => text(c, ln, 176, y + 30 + k * 26, 19, sel ? th.selText : th.text, 'left', 600));
      text(c, a.tag, 176, y + 76, 14, th.sub, 'left', 500);
      if (sel) {
        fillRR(c, 30, y + 12, 5, 68, 3, th.sel);
        strokeRR(c, 28, y - 2, 424, 96, 10, th.sel, 3);
      }
    }
    // 右侧文章
    const a = ARTICLES[this.sel];
    const px = 480, pw = 770;
    fillRR(c, px, 118, pw, 508, 10, th.card);
    c.save();
    rrect(c, px + 15, 133, 740, 250, 6);
    c.clip();
    c.drawImage(this.banners[this.sel], px + 15, 133);
    c.restore();
    text(c, a.title, px + 24, 412, 26, th.text, 'left', 700);
    const body = wrap(c, a.body, pw - 50, 18, 500);
    body.slice(0, 7).forEach((ln, k) => text(c, ln, px + 24, 452 + k * 27, 18, th.sub, 'left', 500));
    c.fillStyle = th.line;
    c.fillRect(30, 640, W - 60, 1.5);
    drawHints(c, [['DPAD', '选择'], ['B', '返回']], th);
  }
}
