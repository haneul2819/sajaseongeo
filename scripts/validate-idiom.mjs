// 새로 생성된 사자성어 JSON이 규칙을 지켰는지 확인한다.
// 사용법: node scripts/validate-idiom.mjs <json파일>
// 종료 코드 0 = 통과(경고 가능), 1 = 불합격
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'idioms');
const file = process.argv[2];
if (!file) { console.error('사용법: node scripts/validate-idiom.mjs <json파일>'); process.exit(2); }

const errors = [];
const warnings = [];
let i;
try { i = JSON.parse(readFileSync(file, 'utf-8')); }
catch (e) { console.error(`오류: JSON을 읽지 못했다. ${e.message}`); process.exit(1); }

const str = (k, min, max) => {
  const v = i[k];
  if (typeof v !== 'string' || !v.trim()) { errors.push(`${k} 항목이 비었다.`); return ''; }
  if (min && v.length < min) errors.push(`${k}가 ${v.length}자로 짧다 (최소 ${min}).`);
  if (max && v.length > max) warnings.push(`${k}가 ${v.length}자로 길다 (권장 ${max} 이하).`);
  return v;
};
const hangul = str('hangul');
const hanja = str('hanja');
str('lit', 8, 40);
str('meaning', 10, 120);
str('origin', 3, 80);
str('lesson', 30, 220);
if (!/^[가-힣]{4}$/.test(hangul)) errors.push(`hangul은 한글 4자여야 한다: ${hangul}`);
if (!/^[㐀-鿿豈-﫿]{4}$/.test(hanja)) errors.push(`hanja는 한자 4자여야 한다: ${hanja}`);
if (!Array.isArray(i.story) || i.story.length < 2 || i.story.length > 4) errors.push('story는 2~4개 문단이어야 한다.');
else {
  i.story.forEach((p, n) => {
    if (typeof p !== 'string' || p.length < 40) errors.push(`story ${n + 1}문단이 짧다 (${p?.length ?? 0}자, 최소 40).`);
    if (typeof p === 'string' && p.length > 450) warnings.push(`story ${n + 1}문단이 ${p.length}자로 길다.`);
  });
  const total = i.story.join('').length;
  if (total < 250) errors.push(`유래 이야기가 총 ${total}자로 너무 짧다 (최소 250).`);
  else if (total < 300) warnings.push(`유래 이야기가 총 ${total}자로 짧은 편이다 (원본 100선은 290~410자).`);
}
if (!Array.isArray(i.examples) || i.examples.length < 2 || i.examples.length > 3) errors.push('examples는 2~3개여야 한다.');
else i.examples.forEach((e, n) => { if (typeof e !== 'string' || e.length < 15) errors.push(`예문 ${n + 1}이 짧다.`); if (typeof e === 'string' && !e.includes(hangul)) warnings.push(`예문 ${n + 1}에 '${hangul}'이 들어 있지 않다.`); });
if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date ?? '')) errors.push(`date 형식이 YYYY-MM-DD가 아니다: ${i.date}`);
if (i.collection === '100선') errors.push('새 글에 collection: 100선 을 쓰면 안 된다.');
if (!Number.isInteger(i.num)) errors.push('num이 정수가 아니다.');

const all = JSON.stringify(i);
const emoji = all.match(/\p{Extended_Pictographic}/gu);
if (emoji) errors.push(`이모지가 있다: ${[...new Set(emoji)].join(' ')}`);
if (/[!]/.test(all)) warnings.push('느낌표가 있다.');
if (/<[a-z/]/i.test(all)) errors.push('HTML 태그가 섞여 있다. 순수 텍스트만 쓴다.');

// 중복과 번호 확인
const self = resolve(file);
const others = readdirSync(DATA).filter((n) => n.endsWith('.json'))
  .map((n) => ({ path: resolve(join(DATA, n)), ...JSON.parse(readFileSync(join(DATA, n), 'utf-8')) }))
  .filter((o) => o.path !== self);
for (const o of others) {
  if (o.hangul === hangul) errors.push(`이미 실린 사자성어다 (${String(o.num).padStart(3, '0')} ${o.hangul}).`);
  if (o.hanja === hanja) errors.push(`같은 한자가 이미 있다 (${String(o.num).padStart(3, '0')} ${o.hanja}).`);
}
const expected = others.length + 1;
if (Number.isInteger(i.num) && i.num !== expected) errors.push(`num은 ${expected}이어야 한다 (지금 ${i.num}).`);
const expectedName = `${String(i.num).padStart(3, '0')}_${hangul}.json`;
if (basename(file) !== expectedName) errors.push(`파일명은 ${expectedName} 이어야 한다.`);

for (const w of warnings) console.log(`경고: ${w}`);
for (const e of errors) console.error(`오류: ${e}`);
console.log(`${hangul} ${hanja} · 문단 ${i.story?.length ?? 0} · 예문 ${i.examples?.length ?? 0}`);
process.exit(errors.length ? 1 : 0);
