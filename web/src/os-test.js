// 茶室 OS 独立测试台：只有一块 1280×720 画布，用键盘驱动
import { Input } from './input.js';
import { ConsoleOS } from './os/index.js';

const canvas = document.getElementById('screen');
const status = document.getElementById('status');
const shots = document.getElementById('shots');
const os = new ConsoleOS({ canvas });
const input = new Input(window);
window.__os = os;
window.__input = input;

let unlocked = false;
const unlock = () => {
  if (unlocked) return;
  unlocked = true;
  os.unlockAudio();
};
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);

const joy = { L: true, R: true };
let docked = false;
document.getElementById('joyL').onclick = () => os.setJoyCon('L', (joy.L = !joy.L));
document.getElementById('joyR').onclick = () => os.setJoyCon('R', (joy.R = !joy.R));
document.getElementById('dock').onclick = () => os.setDocked((docked = !docked));

os.onCapture = (url) => {
  const img = new Image();
  img.src = url;
  shots.prepend(img);
  while (shots.children.length > 6) shots.lastChild.remove();
};

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  os.update(dt, input.poll());
  canvas.style.filter = `brightness(${(0.35 + 0.65 * os.brightness).toFixed(3)})`;
  status.textContent = os.appName + (os.screenOn ? '' : '（屏幕已关闭）');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
