// 이미 실린 사자성어 목록을 프롬프트용으로 찍는다.
// 사용법: node scripts/list-idioms.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'idioms');
const list = readdirSync(DATA).filter((n) => n.endsWith('.json'))
  .map((n) => JSON.parse(readFileSync(join(DATA, n), 'utf-8')))
  .sort((a, b) => a.num - b.num);
for (const i of list) console.log(`- ${String(i.num).padStart(3, '0')} ${i.hangul} ${i.hanja}`);
console.log(`NEXT_NUM=${list.length + 1}`);
