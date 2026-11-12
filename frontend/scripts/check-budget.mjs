import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, '../../app/static/dist/assets');

if (!fs.existsSync(assetsDir)) {
  throw new Error(`Compiled dist assets directory missing: ${assetsDir}`);
}

let jsRaw = 0;
let jsGzip = 0;
let cssRaw = 0;

for (const name of fs.readdirSync(assetsDir)) {
  const fullPath = path.join(assetsDir, name);
  if (!fs.statSync(fullPath).isFile()) continue;
  const buf = fs.readFileSync(fullPath);
  if (name.endsWith('.js')) {
    jsRaw += buf.length;
    jsGzip += zlib.gzipSync(buf).length;
  } else if (name.endsWith('.css')) {
    cssRaw += buf.length;
  }
}

const MAX_JS_RAW = 650 * 1024;
const MAX_JS_GZIP = 200 * 1024;
const MAX_CSS_RAW = 100 * 1024;

if (jsRaw === 0 || cssRaw === 0) {
  throw new Error(`Expected non-empty JS and CSS assets (js=${jsRaw}, css=${cssRaw})`);
}
if (jsRaw > MAX_JS_RAW || jsGzip > MAX_JS_GZIP || cssRaw > MAX_CSS_RAW) {
  throw new Error(
    `Asset budget exceeded: jsRaw=${jsRaw}B (max ${MAX_JS_RAW}), jsGzip=${jsGzip}B (max ${MAX_JS_GZIP}), cssRaw=${cssRaw}B (max ${MAX_CSS_RAW})`
  );
}

console.log(
  `REL-07 asset budget OK: jsRaw=${(jsRaw / 1024).toFixed(2)}KB, jsGzip=${(jsGzip / 1024).toFixed(2)}KB, cssRaw=${(cssRaw / 1024).toFixed(2)}KB`
);
