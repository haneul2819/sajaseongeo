// 일회성 도구: 기존 HTML 100편을 data/idioms/*.json 으로 되돌린다.
// 사용법: node scripts/import-html.mjs <html폴더>
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const src = process.argv[2];
const outDir = 'data/idioms';
mkdirSync(outDir, { recursive: true });

const unesc = (s) => s
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const pick = (html, re) => {
  const m = html.match(re);
  if (!m) throw new Error('패턴 없음: ' + re);
  return unesc(m[1].trim());
};

let count = 0;
for (const name of readdirSync(src).sort()) {
  if (!/^\d{3}_.+\.html$/.test(name)) continue;
  const html = readFileSync(join(src, name), 'utf-8');
  const num = Number(name.slice(0, 3));
  const storyHtml = html.match(/<div class="story">([\s\S]*?)<\/div>/)[1];
  const exHtml = html.match(/<ul class="ex">([\s\S]*?)<\/ul>/)[1];
  const idiom = {
    num,
    hangul: pick(html, /<h1>(.*?)<\/h1>/),
    hanja: pick(html, /<div class="hanja">(.*?)<span class="seal">/),
    lit: pick(html, /<div class="lit">(.*?)<\/div>/),
    meaning: pick(html, /<p class="meaning">(.*?)<\/p>/),
    origin: pick(html, /<p class="origin">(.*?)<\/p>/),
    story: storyHtml.split(/<\/p>/).map((p) => p.replace(/<p>/, '').trim()).filter(Boolean).map(unesc),
    lesson: pick(html, /<p class="lesson">([\s\S]*?)<\/p>/),
    examples: [...exHtml.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => unesc(m[1].trim())),
    collection: '100선',
    date: '2026-09-08',
  };
  const out = join(outDir, basename(name, '.html') + '.json');
  writeFileSync(out, JSON.stringify(idiom, null, 2) + '\n', 'utf-8');
  count++;
}
console.log(`${count}편 변환 완료 → ${outDir}/`);
