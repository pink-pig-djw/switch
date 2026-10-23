// 把网页打包成一个单文件 dist/index.html（内嵌 three.js、全部代码和 GLB 模型），
// 双击就能离线打开。用法：
//   node scripts/build.mjs           构建
//   node scripts/build.mjs --serve   构建 + 监听改动 + 本地预览 http://localhost:5173
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'index.html');

// GLB 先 gzip 再内嵌（约 3 MB → 1.3 MB），网页里用 three.js 自带的 fflate 解压，不依赖 WebAssembly
const gzipGlb = {
  name: 'gzip-glb',
  setup(b) {
    b.onLoad({ filter: /\.glb$/ }, (args) => ({
      contents: zlib.gzipSync(fs.readFileSync(args.path), { level: 9 }),
      loader: 'binary',
    }));
  },
};

async function build() {
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'web/src/main.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2020'],
    plugins: [gzipGlb],
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const tpl = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
  const html = tpl.replace('<!--APP_JS-->', () => `<script>${js}</script>`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`dist/index.html  ${(html.length / 1024 / 1024).toFixed(2)} MB  (${Date.now() - t0} ms)`);

  // --artifact <文件>：额外输出一份发布到 claude.ai Artifact 用的版本
  // （发布时会自动包上 doctype/head/body，所以这里去掉外层标签，并打开 __ARTIFACT__ 标记）
  const ai = process.argv.indexOf('--artifact');
  if (ai > 0 && process.argv[ai + 1]) {
    const art = tpl
      .replace(/<!doctype html>\s*/i, '')
      .replace(/<html[^>]*>\s*/i, '')
      .replace(/<\/html>\s*/i, '')
      .replace(/<head>\s*/i, '')
      .replace(/<\/head>\s*/i, '')
      .replace(/<body>\s*/i, '')
      .replace(/<\/body>\s*/i, '')
      .replace(/<meta charset="utf-8">\s*/i, '')
      .replace(/<meta name="viewport"[^>]*>\s*/i, '')
      .replace('<!--APP_JS-->', () => `<script>window.__ARTIFACT__ = true;</script>\n<script>${js}</script>`);
    fs.writeFileSync(process.argv[ai + 1], art);
    console.log(`artifact → ${process.argv[ai + 1]}`);
  }
}

await build();

if (process.argv.includes('--serve')) {
  let timer = null;
  fs.watch(path.join(root, 'web'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120);
  });
  const port = Number(process.env.PORT || 5173);
  http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(out).pipe(res);
  }).listen(port, () => console.log(`预览： http://localhost:${port}`));
}
