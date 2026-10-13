import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const seconds = (stamp) => {
  const [hours, minutes, rest] = stamp.split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest);
};

const shortTime = (stamp) => stamp.startsWith('00:') ? stamp.slice(3, 8) : stamp.slice(0, 8);

const cues = JSON.parse(fs.readFileSync(path.join(root, 'data', 'part2-transcript.json'), 'utf8'));
const groups = new Map();
for (const cue of cues) {
  const minute = Math.floor(seconds(cue.start) / 60);
  if (!groups.has(minute)) groups.set(minute, []);
  groups.get(minute).push(cue);
}

const transcriptHtml = [...groups.entries()].map(([, minuteCues]) => {
  const first = minuteCues[0];
  const text = minuteCues.map((cue) => cue.text).join(' ');
  const hrefSeconds = Math.floor(seconds(first.start));
  return `<article class="transcript-block" data-search="${escapeHtml(text.toLowerCase())}">\n` +
    `  <a class="transcript-time" href="https://www.youtube.com/watch?v=-Ggc37xLj_Y&t=${hrefSeconds}s">${shortTime(first.start)}</a>\n` +
    `  <div class="transcript-text">${escapeHtml(text)}</div>\n` +
    `</article>`;
}).join('\n');

let html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(srcDir, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(srcDir, 'app.js'), 'utf8');

html = html
  .replace('<link rel="stylesheet" href="style.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`)
  .replace('{{TRANSCRIPT}}', transcriptHtml)
  .replace('{{GENERATED_AT}}', new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Shanghai'
  }).format(new Date()));

html = html.replace(/src="\.\.\/assets\/slides\/([^"]+\.jpg)"/g, (_, filename) => {
  const image = fs.readFileSync(path.join(root, 'assets', 'slides', filename)).toString('base64');
  return `src="data:image/jpeg;base64,${image}"`;
});

fs.mkdirSync(distDir, { recursive: true });
const out = path.join(distDir, 'index.html');
fs.writeFileSync(out, html);
console.log(`Built ${path.relative(root, out)} (${(fs.statSync(out).size / 1024 / 1024).toFixed(2)} MiB)`);
