# Switch 3D 交互模型

用 **Blender 程序化建模**的 Switch 风格掌机，在浏览器里可以 360° 旋转、拉近到毫米级查看每一个细节，
并且**直接按上面的按键玩屏幕里的游戏**（键盘、鼠标点按 3D 按键、触屏、USB/蓝牙手柄都可以）。

> 非官方粉丝作品，与任天堂（Nintendo）无关。“Nintendo Switch”是任天堂的商标。
> 本项目没有使用任何任天堂的素材：模型由脚本按公开尺寸生成，系统界面、图标、游戏、角色、音效全部为原创程序绘制 / 合成。

## 快速开始

- **直接打开**：双击 [`dist/index.html`](dist/index.html)（单文件，内嵌 three.js 和模型，可离线使用）。
- **本地开发**：
  ```bash
  npm install
  npm run dev      # 构建 + 监听改动，预览 http://localhost:5173
  npm run build    # 只构建 dist/index.html
  ```

## 能做什么

| 功能 | 说明 |
| --- | --- |
| 查看细节 | 左键拖动旋转、滚轮**朝鼠标指针方向**缩放、右键平移、**双击任意部件拉近**；10 个预设视角（游玩、正面、背面、顶部、底部、侧面、左右手柄、摇杆特写） |
| 按键 | 每颗按键都是独立部件：键盘按下时 3D 按键同步下沉并发光，鼠标点击 3D 按键 = 按下它，拖动摇杆 = 推摇杆 |
| 触摸屏 | 直接点击 3D 屏幕上的磁贴 / 按钮（和真机触摸屏一样） |
| 拆装 Joy-Con | 沿滑轨滑出 / 装回，露出 SL / SR、玩家指示灯、同步键、触点和主机侧面的金属滑槽 |
| 支架 / 卡槽盖 | 背面支架可打开（下面是 microSD 卡槽），顶部游戏卡槽盖可掀开 |
| 底座 / TV 模式 | 主机插入底座后掌机屏幕熄灭、底座指示灯亮起，画面切到后面的电视上 |
| 其他 | 键位标注（在每颗 3D 按键旁显示对应键盘键）、自动旋转、线框模式、明暗主题、3D 截图、手机触屏手柄 |

## 键盘操作

| Switch 按键 | 键盘 |
| --- | --- |
| 左摇杆 | `W` `A` `S` `D`（按下：左 `Shift`） |
| 十字键 | `↑` `↓` `←` `→` |
| A / B / X / Y | `L` / `K` / `I` / `J`（菱形排列，和手柄上的位置对应；A 也可以用 `空格`、`回车`，B 也可以用 `退格`） |
| 右摇杆 | 小键盘 `8` `4` `5` `6`（按下：右 `Shift` / 小键盘 `0`），或用鼠标拖动 3D 摇杆 |
| L / ZL · R / ZR | `Q` / `E` · `O` / `U` |
| + / − | `=` / `-` |
| HOME · 截图键 | `H` · `C` |
| SL / SR | 左手柄 `Z` / `X`，右手柄 `N` / `M` |
| 电源键 · 音量 | `P`（长按 2 秒打开电源菜单） · `]` / `[` |

按 `?` 可以随时在网页里打开完整的对照表。

## 内置系统与游戏

屏幕里运行的是原创的“茶室 OS”：开机动画、仿真机布局的 HOME 菜单（磁贴 + 圆形系统按钮）、锁屏（连按三次同一按键解锁）、
睡眠 / 电源菜单、音量浮层、截图相册、系统设置（亮度、主题、音量、按键说明）。

内置的经典玩法小游戏（全部原创美术）：横版闯关《橙子大冒险》、方块消除、星际射击、双人乒乓（左右 Joy-Con 各控一个拍子）、
贪吃蛇、打砖块、2048、扫雷，以及可以检查每一颗按键的手柄测试。

## 模型

`blender/build_switch.py` 用 bmesh 从零生成全部几何体（约 6 万个三角面），输出 `web/assets/switch.glb` 和 `blender/switch.blend`：

```bash
blender -b -P blender/build_switch.py          # 已安装 Blender
# 或者
pip install bpy && python blender/build_switch.py
python blender/build_switch.py --render out/   # 额外用 Cycles 渲染 7 张预览图
```

- 尺寸依据任天堂公布的初代机（HAC-001）规格：装上 Joy-Con 后 **102 × 239 × 13.9 mm**，摇杆顶端到 ZL/ZR 顶面 **28.4 mm**，
  **6.2 英寸 1280×720** 屏幕（[任天堂官方规格页](https://www.nintendo.com/sg/hardware/switch/modal/specs/body.html)）。
- 主机平板 173 mm 宽、每只 Joy-Con 外露 33 mm；按键、接口、散热孔、支架等部件的具体位置和大小是对照外观估算的，不是官方图纸。
- 每个可交互部件都是 GLB 里的独立节点，带 extras 描述（按压方向、扳机转轴、摇杆转动中心、开合角度、提示文字），
  网页端据此驱动动画；在 Blender 里打开 `.blend` 按 F12 就能用自带的相机和灯光渲染。

## 目录结构

```
blender/build_switch.py   Blender 程序化建模脚本
blender/switch.blend      生成的 Blender 工程
web/assets/switch.glb     导出的模型
web/index.html            页面与样式
web/src/main.js           入口：加载模型、交互、主循环
web/src/scene.js          渲染器、相机、灯光、阴影
web/src/device.js         按键 / 摇杆 / 拆装 / 底座等动画
web/src/input.js          键盘、鼠标、手柄 → 虚拟 Switch 手柄
web/src/touchpad.js       手机触屏手柄
web/src/os/               屏幕里的系统与游戏（Canvas 2D，1280×720）
web/os-test.html          单独调试系统和游戏的测试页
scripts/build.mjs         打包成单文件 dist/index.html
```
