// 《茶岛生活》数据：鱼、虫、水果、家具、商店、岛民台词、原创配乐（旋律与和声均为原创）
import { parseTrack } from '../../audio.js';

// —— 鱼 ——
// where：river 河 / pond 池塘 / sea 海（岸边和码头都行）/ deep 深海（只能在码头尽头钓）
// size：S M L XL；hours：[开始, 结束) 小时，可以跨午夜；rain：'only' 只在雨天 / 'more' 雨天更多
// shape：画图鉴图标用；w：出现权重（越小越稀有）
export const FISH = [
  { id: 'bitterling', name: '鳑鲏', where: 'river', size: 'S', price: 90, w: 10, hours: [0, 24], body: '#b9c7d6', belly: '#eef3f8', pat: 'line', patC: '#ff8fb1',
    quip: '小小的、亮晶晶，像一片会游泳的指甲盖。' },
  { id: 'crucian', name: '鲫鱼', where: 'river', size: 'M', price: 160, w: 10, hours: [0, 24], body: '#8d9a6e', belly: '#d9d6b5',
    quip: '河里最常见的老朋友，今天也很有精神。' },
  { id: 'ayu', name: '香鱼', where: 'river', size: 'M', price: 900, w: 4, hours: [6, 18], body: '#9fb08a', belly: '#f1ecd2', pat: 'dot', patC: '#ffd24a',
    quip: '凑近闻一闻……真的有一股西瓜一样的清香！' },
  { id: 'catfish', name: '鲶鱼', where: 'river', size: 'L', price: 800, w: 4, hours: [16, 9], body: '#5d5a52', belly: '#9c958a', shape: 'catfish',
    quip: '胡子比壶爷爷的还要长，还在一翘一翘的。' },
  { id: 'trout', name: '虹鳟', where: 'river', size: 'L', price: 1500, w: 1.6, hours: [4, 20], rain: 'more', body: '#7f9a86', belly: '#e6e8dc', pat: 'rainbow', patC: '#ff7fa0',
    quip: '身上挂着一道彩虹，雨天特别活泼！' },
  { id: 'medaka', name: '青鳉', where: 'pond', size: 'S', price: 120, w: 10, hours: [0, 24], body: '#c9c08a', belly: '#f2eed4',
    quip: '眼睛大大的，正一脸好奇地看着你。' },
  { id: 'crayfish', name: '小龙虾', where: 'pond', size: 'S', price: 200, w: 7, hours: [0, 24], body: '#d9432b', belly: '#f08a5a', shape: 'crayfish',
    quip: '钳子举得高高的，看起来很不服气。' },
  { id: 'goldfish', name: '金鱼', where: 'pond', size: 'S', price: 1300, w: 1.2, hours: [0, 24], body: '#ff7a2a', belly: '#ffd08a', shape: 'goldfish',
    quip: '尾巴像一条小纱裙，居然藏在池塘里！' },
  { id: 'koi', name: '锦鲤', where: 'pond', size: 'L', price: 1600, w: 2, hours: [6, 20], body: '#fbf6ee', belly: '#ffffff', pat: 'koi', patC: '#e8432c',
    quip: '据说钓到它的人，今天一整天都会走运。' },
  { id: 'sardine', name: '沙丁鱼', where: 'sea', size: 'S', price: 100, w: 10, hours: [0, 24], body: '#5f87a8', belly: '#e8eef3', pat: 'dot', patC: '#28405a',
    quip: '一大群里最勇敢、跑得最快的那一条。' },
  { id: 'aji', name: '竹荚鱼', where: 'sea', size: 'M', price: 180, w: 8, hours: [0, 24], body: '#6f8f8a', belly: '#e9efe9', pat: 'line', patC: '#c8b26a',
    quip: '侧边有一条小小的“拉链”，拉开会是什么呢？' },
  { id: 'clown', name: '小丑鱼', where: 'sea', size: 'S', price: 650, w: 3, hours: [6, 18], body: '#ff7a1a', belly: '#ff9a3a', pat: 'bands', patC: '#ffffff',
    quip: '橙白相间，和茶岛的配色简直一模一样！' },
  { id: 'puffer', name: '河豚', where: 'sea', size: 'M', price: 450, w: 3, hours: [17, 5], body: '#c9b57a', belly: '#f7efd8', shape: 'puffer',
    quip: '一紧张就鼓成了一颗球……别怕别怕。' },
  { id: 'bream', name: '鲷鱼', where: 'sea', size: 'L', price: 1100, w: 3, hours: [0, 24], body: '#ff6f7d', belly: '#ffd5d0', pat: 'dot', patC: '#7fd3ff',
    quip: '红彤彤的，看起来就很喜庆！' },
  { id: 'tuna', name: '金枪鱼', where: 'deep', size: 'XL', price: 5000, w: 1.4, hours: [0, 24], body: '#24406e', belly: '#d9e2ec', shape: 'tuna',
    quip: '好大一条！钓上来的时候手都在发抖！' },
  { id: 'shark', name: '鲨鱼', where: 'deep', size: 'XL', price: 8000, w: 0.6, hours: [16, 4], rain: 'more', body: '#6f7f8f', belly: '#e3e8ec', shape: 'shark', fin: true,
    quip: '背鳍露出水面的那一刻，心跳都停了半拍！' },
  { id: 'oarfish', name: '皇带鱼', where: 'deep', size: 'XL', price: 9000, w: 0.35, hours: [0, 24], rain: 'only', body: '#c9d3dc', belly: '#f3f6f8', shape: 'oarfish',
    quip: '传说中的深海飘带……居然真的存在！' },
];
// 钓上来的不是鱼（不算进图鉴）
export const JUNK = [
  { id: 'can', name: '空罐头', price: 10, shape: 'can', quip: '……是谁乱扔垃圾！' },
  { id: 'slipper', name: '旧拖鞋', price: 10, shape: 'slipper', quip: '只有一只。另一只在哪里呢？' },
];

// —— 虫 ——
// where：flower 花上 / fly 花丛上空 / tree 树干 / grass 草地 / water 水边 / beach 沙滩 / lamp 路灯 / rock 石头
export const BUGS = [
  { id: 'white', name: '粉蝶', where: 'fly', price: 100, w: 10, hours: [5, 19], rain: 'no', fly: true, quip: '翅膀白白的，像一张会飞的小纸片。' },
  { id: 'swallowtail', name: '凤蝶', where: 'fly', price: 400, w: 4, hours: [6, 18], rain: 'no', fly: true, shy: true, quip: '翅膀后面拖着两条漂亮的小尾巴！' },
  { id: 'bee', name: '蜜蜂', where: 'fly', price: 250, w: 5, hours: [7, 17], rain: 'no', fly: true, shy: true, quip: '嗡嗡嗡——别生气嘛，就看一眼。' },
  { id: 'ladybug', name: '七星瓢虫', where: 'flower', price: 200, w: 6, hours: [6, 18], quip: '背上真的有七颗小黑点，刚刚数过了。' },
  { id: 'mantis', name: '螳螂', where: 'flower', price: 430, w: 3, hours: [8, 17], rain: 'no', quip: '举着两把小镰刀，一脸认真地看着你。' },
  { id: 'dragonfly', name: '蜻蜓', where: 'water', price: 230, w: 6, hours: [7, 18], rain: 'no', fly: true, shy: true, quip: '眼睛大得像两颗玻璃珠，转来转去。' },
  { id: 'firefly', name: '萤火虫', where: 'water', price: 600, w: 5, hours: [19, 4], rain: 'no', fly: true, glow: true, quip: '一闪一闪的，像从天上掉下来的小星星。' },
  { id: 'cicada', name: '蝉', where: 'tree', price: 300, w: 7, hours: [7, 17], rain: 'no', shy: true, quip: '知了——知了——它到底知道了什么呢？' },
  { id: 'stag', name: '锹形虫', where: 'tree', price: 2500, w: 1.5, hours: [19, 5], quip: '大钳子闪闪发亮，森林里的小骑士！' },
  { id: 'rhino', name: '独角仙', where: 'tree', price: 2000, w: 2, hours: [18, 5], quip: '角上大概能挂一颗小橙子。' },
  { id: 'cricket', name: '蟋蟀', where: 'grass', price: 160, w: 8, hours: [16, 6], hop: true, quip: '唧唧唧——原来一直是你在唱歌呀。' },
  { id: 'snail', name: '蜗牛', where: 'rock', price: 250, w: 8, hours: [0, 24], rain: 'only', quip: '只在下雨天出门散步的慢慢先生。' },
  { id: 'hermit', name: '寄居蟹', where: 'beach', price: 800, w: 4, hours: [0, 24], hop: true, quip: '背着房子到处走——它的房贷一定还清了吧。' },
  { id: 'moth', name: '飞蛾', where: 'lamp', price: 130, w: 8, hours: [19, 4], fly: true, quip: '绕着灯转圈圈，转得头都晕了。' },
];

export const FRUITS = {
  orange: { id: 'orange', name: '橙子', price: 120, color: '#ff8a1c' },
  peach: { id: 'peach', name: '桃子', price: 180, color: '#ffa7a0' },
  apple: { id: 'apple', name: '苹果', price: 150, color: '#e8423a' },
  coconut: { id: 'coconut', name: '椰子', price: 260, color: '#8a5a32' },
};

export const MISC = {
  hive: { id: 'hive', name: '蜂窝', price: 300, quip: '里面已经空了……还好。' },
};

// 家具：shop = 商店里买得到；gift = 只能通过任务 / 捐赠获得
export const FURNITURE = [
  { id: 'teatable', name: '小茶几', price: 300, shop: true },
  { id: 'chair', name: '竹椅', price: 450, shop: true },
  { id: 'plant', name: '绿萝盆栽', price: 260, shop: true },
  { id: 'rug', name: '圆地毯', price: 600, shop: true },
  { id: 'lamp', name: '橙子台灯', price: 800, shop: true },
  { id: 'luckycat', name: '招财猫', price: 999, shop: true },
  { id: 'bookshelf', name: '书架', price: 1200, shop: true },
  { id: 'fishtank', name: '鱼缸', price: 1500, shop: true },
  { id: 'bed', name: '小木床', price: 1800, shop: true },
  { id: 'record', name: '唱片机', price: 2400, shop: true },
  { id: 'cattower', name: '猫爬架', price: 0, gift: true },
  { id: 'globe', name: '地球仪', price: 0, gift: true },
  { id: 'specimen', name: '昆虫标本框', price: 0, gift: true },
  { id: 'stove', name: '小茶炉', price: 0, gift: true },
];
export const FURN = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));

// 工具升级（商店“购买”页）
export const UPGRADES = [
  { id: 'rod1', name: '结实的鱼竿', price: 1200, desc: '咬钩的反应时间更长，试探次数更少', need: (s) => s.rod === 0, apply: (s) => { s.rod = 1; } },
  { id: 'rod2', name: '金色鱼竿', price: 6000, desc: '反应时间再加长，稀有鱼更容易上钩', need: (s) => s.rod === 1, apply: (s) => { s.rod = 2; } },
  { id: 'net1', name: '大捕虫网', price: 1500, desc: '挥网范围更大，虫子不容易被吓跑', need: (s) => s.net === 0, apply: (s) => { s.net = 1; } },
  { id: 'bag1', name: '背包扩容（20 格）', price: 2000, desc: '背包从 12 格变成 20 格', need: (s) => s.bag === 12, apply: (s) => { s.bag = 20; } },
  { id: 'bag2', name: '背包扩容（30 格）', price: 5000, desc: '背包从 20 格变成 30 格', need: (s) => s.bag === 20, apply: (s) => { s.bag = 30; } },
];

// 房子：贷款升级（向壶爷爷申请，盖好后慢慢还）
export const HOUSES = [
  { name: '帐篷', grid: [4, 3], loan: 0 },
  { name: '小木屋', grid: [6, 4], loan: 3000 },
  { name: '两层茶屋', grid: [8, 5], loan: 15000, upstairs: [6, 4] },
];

// 岛民
export const NPCS = {
  dango: { name: '团子', who: '橘猫', color: '#ff9a3c' },
  elder: { name: '壶爷爷', who: '茶壶', color: '#6fa8dc' },
  kuri: { name: '栗子', who: '小鹿', color: '#c98a4a' },
  shop: { name: '小松', who: '松鼠店长', color: '#d98a3a' },
  curator: { name: '慢慢', who: '乌龟馆长', color: '#6fae6a' },
};

// 闲聊台词：ctx = { hour, rain, house, dex, debt }，返回符合条件的若干句随机挑一句
export const CHAT = {
  dango: [
    () => '今天的风有橙子味喵～',
    (c) => c.rain && '下雨天最适合在屋檐下打盹了喵……',
    (c) => (c.hour >= 19 || c.hour < 5) && '晚上池塘和河边会有一闪一闪的小光点哦喵。',
    () => '听说站在码头最外面，能钓到超——级大的鱼喵！',
    (c) => c.house >= 1 && '你的房子好可爱！下次让我进去坐坐喵？',
    () => '我最喜欢的东西：橙子、太阳、还有你钓上来的小鱼喵。',
    (c) => c.hour < 9 && '早上好喵！刚睡醒的尾巴还有点乱……',
  ],
  elder: [
    () => '鱼真正咬钩的时候，浮标会“咕咚”一下沉下去。之前轻轻碰两下，是在试探你，呵呵。',
    () => '跑得太急，虫子会被吓跑的。慢慢走，慢慢来，岛上的日子长着呢。',
    () => '摇树的时候小心头顶……有时候会掉下来不太友好的东西，呵呵。',
    (c) => c.rain && '下雨天，河里的虹鳟可活泼了。码头那边……听说也有怪东西出没。',
    (c) => c.dex > 10 && `你的图鉴已经有 ${c.dex} 种了？了不起，了不起。`,
    () => '果子摇下来以后，等上一天又会长出来。',
  ],
  kuri: [
    () => '嘘——树上有声音！是蝉吗？是蝉吧！',
    () => '晚上的森林里有超厉害的甲虫！要轻轻地、慢慢地靠近哦。',
    (c) => c.rain && '下雨天石头旁边会有蜗牛出来散步，好可爱！',
    () => '海边沙滩上有会走路的贝壳！其实是寄居蟹啦～',
    () => '我在画一本虫子图册，已经画了好多页了！',
  ],
};

// —— 原创配乐 ——
const rep = (s, n) => Array(n).fill(s).join(' ');
const T = (s) => parseTrack(s.replace(/\|/g, ' '));
const CH = {
  F: ['F2', 'C3', 'F3', 'A3', 'C4'], Dm: ['D2', 'A2', 'D3', 'F3', 'A3'], Bb: ['A#2', 'F3', 'A#3', 'D4', 'F4'],
  C: ['C3', 'G3', 'C4', 'E4', 'G4'], Am: ['A2', 'E3', 'A3', 'C4', 'E4'], G: ['G2', 'D3', 'G3', 'B3', 'D4'],
  Em: ['E2', 'B2', 'E3', 'G3', 'B3'], E: ['E2', 'B2', 'E3', 'G#3', 'B3'], D: ['D3', 'A3', 'D4', 'F#4', 'A4'],
};
const bass = (chords, pat = 'r4 f4 o4 f4') => chords.map((ch) => {
  const [r, f, o] = CH[ch];
  return pat.replace(/r(\d)/g, `${r}:$1`).replace(/f(\d)/g, `${f}:$1`).replace(/o(\d)/g, `${o}:$1`);
}).join(' ');
// 分解和弦：每小节 8 个八分音符
const arp = (chords) => chords.map((ch) => {
  const n = CH[ch];
  return [n[2], n[3], n[4], n[3], n[2], n[3], n[4], n[3]].map((x) => `${x}:2`).join(' ');
}).join(' ');

const DAY_CH = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'Bb', 'C', 'Am', 'Dm', 'Bb', 'C', 'F', 'F'];
// 白天：海风午后
export const SONG_DAY = {
  bpm: 96,
  tracks: [
    { wave: 'triangle', vol: 0.15, gate: 0.85, notes: T(`
      A4:2 C5:2 F5:2 E5:2 F5:4 C5:4 | D5:2 E5:2 F5:2 A5:2 G5:4 F5:4 |
      D5:2 F5:2 A#5:3 A5:1 G5:4 F5:2 D5:2 | E5:2 G5:2 C5:4 -:2 E5:2 G5:4 |
      C5:2 F5:2 A5:4 G5:2 F5:2 E5:2 F5:2 | E5:4 C5:2 A4:2 C5:4 E5:4 |
      F5:2 D5:2 A#4:2 D5:2 F5:4 G5:4 | E5:6 D5:2 C5:8 |
      D5:4 F5:4 A#5:6 A5:2 | G5:4 E5:4 C5:4 -:4 |
      C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 | D5:2 F5:2 A5:4 G5:4 F5:4 |
      F5:2 G5:2 A5:2 A#5:2 A5:4 F5:4 | G5:2 A5:2 G5:2 E5:2 C5:8 |
      A5:4 G5:2 F5:2 C5:4 A4:4 | F5:12 -:4`) },
    { wave: 'sine', vol: 0.05, gate: 0.6, notes: T(arp(DAY_CH)) },
    { wave: 'triangle', vol: 0.2, gate: 0.55, notes: T(bass(DAY_CH)) },
    { wave: 'noise', vol: 0.035, notes: T(rep('k:4 h:4 h:4 h:2 h:2', 16)) },
  ],
};

const EVE_CH = ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G'];
// 傍晚：晚霞
export const SONG_EVENING = {
  bpm: 80,
  tracks: [
    { wave: 'triangle', vol: 0.14, gate: 0.9, notes: T(`
      E5:4 G5:4 C6:4 B5:2 G5:2 | A5:6 G5:2 E5:4 C5:4 | F5:4 A5:4 G5:2 F5:2 E5:2 D5:2 | D5:6 E5:2 G5:8 |
      E5:4 G5:2 E5:2 C5:4 E5:4 | B4:4 E5:4 G5:4 B5:4 | A5:4 G5:4 F5:4 D5:4 | C5:12 -:4`) },
    { wave: 'sine', vol: 0.05, gate: 0.7, notes: T(arp(EVE_CH)) },
    { wave: 'triangle', vol: 0.18, gate: 0.7, notes: T(bass(EVE_CH, 'r8 f8')) },
  ],
};

const NIGHT_CH = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'];
// 夜晚：星星和虫鸣
export const SONG_NIGHT = {
  bpm: 66,
  tracks: [
    { wave: 'sine', vol: 0.15, gate: 0.95, sustain: 0.7, notes: T(`
      E5:8 A4:4 C5:4 | F5:8 E5:4 C5:4 | G5:8 E5:4 C5:4 | D5:12 -:4 |
      E5:4 A5:8 G5:4 | F5:4 C5:4 A4:8 | C5:4 E5:4 G5:8 | G#4:4 B4:4 E5:8`) },
    { wave: 'triangle', vol: 0.14, gate: 0.9, notes: T(bass(NIGHT_CH, 'r16')) },
    { wave: 'sine', vol: 0.03, gate: 0.5, notes: T(arp(NIGHT_CH)) },
  ],
};

const SHOP_CH = ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'];
// 室内：小铺子
export const SONG_INDOOR = {
  bpm: 112,
  tracks: [
    { wave: 'p25', vol: 0.09, gate: 0.7, notes: T(`
      G4:2 B4:2 D5:2 G5:2 F#5:2 G5:2 D5:4 | E5:2 G5:2 B5:2 G5:2 E5:4 B4:4 |
      C5:2 E5:2 G5:2 E5:2 A5:4 G5:4 | F#5:4 E5:2 D5:2 A4:4 D5:4 |
      B4:2 D5:2 G5:4 A5:2 B5:2 A5:4 | G5:2 E5:2 B4:4 E5:4 G5:4 |
      E5:2 G5:2 C6:4 B5:2 A5:2 G5:4 | A5:4 F#5:4 G5:8`) },
    { wave: 'triangle', vol: 0.2, gate: 0.5, notes: T(bass(SHOP_CH, 'r2 -:2 o2 -:2 f2 -:2 o2 -:2')) },
    { wave: 'noise', vol: 0.04, notes: T(rep('k:2 h:2 s:2 h:2 k:2 h:2 s:2 h:2', 8)) },
  ],
};

// 小段旋律：钓到 / 抓到 / 升级
export const JINGLE_CATCH = { bpm: 150, tracks: [{ wave: 'p25', vol: 0.12, notes: T('C5:2 E5:2 G5:2 C6:6') }, { wave: 'triangle', vol: 0.18, notes: T('C3:4 G3:4 C4:4') }] };
export const JINGLE_HOUSE = {
  bpm: 132,
  tracks: [
    { wave: 'p25', vol: 0.12, notes: T('G4:2 C5:2 E5:2 G5:4 E5:2 G5:2 C6:8 -:2') },
    { wave: 'triangle', vol: 0.18, notes: T('C3:4 G3:4 E3:4 C4:10') },
  ],
};
