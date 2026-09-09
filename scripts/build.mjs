// data/idioms/*.json 을 읽어 docs/ 에 정적 사이트를 만든다.
// 페이지마다 검색 엔진용 메타(description, canonical, Open Graph, JSON-LD)를 붙이고
// sitemap.xml 과 robots.txt 도 함께 만든다.
// 사용법: node scripts/build.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'idioms');
const OUT = join(ROOT, 'docs');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf-8'));
const SITE = String(CONFIG.site?.url ?? '').replace(/\/$/, '');
const SITE_TITLE = CONFIG.site?.title ?? '사자성어 이야기';
const AUTHOR = CONFIG.site?.author ?? '';
const PAGE_CSS = readFileSync(join(ROOT, 'scripts', 'page.css'), 'utf-8');
const INDEX_CSS = readFileSync(join(ROOT, 'scripts', 'index-extra.css'), 'utf-8');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const pad = (n) => String(n).padStart(3, '0');
const fileOf = (i) => `${pad(i.num)}_${i.hangul}.html`;
const urlOf = (file) => `${SITE}/${encodeURIComponent(file)}`;
const dateKo = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${y}년 ${m}월 ${day}일`;
};

function loadIdioms() {
  const list = readdirSync(DATA)
    .filter((n) => n.endsWith('.json'))
    .map((n) => ({ ...JSON.parse(readFileSync(join(DATA, n), 'utf-8')), _file: n }))
    .sort((a, b) => a.num - b.num);
  list.forEach((i, idx) => {
    if (i.num !== idx + 1) throw new Error(`번호가 이어지지 않는다: ${i._file} (기대 ${idx + 1})`);
    if (i._file !== `${pad(i.num)}_${i.hangul}.json`) throw new Error(`파일명이 내용과 다르다: ${i._file}`);
  });
  return list;
}

// ── 머리 부분 ────────────────────────────────────────────────────────────
function head({ title, description, url, css, og = {}, jsonLd }) {
  const meta = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">`,
    url ? `<link rel="canonical" href="${esc(url)}">` : '',
    `<meta property="og:site_name" content="${esc(SITE_TITLE)}">`,
    `<meta property="og:locale" content="ko_KR">`,
    `<meta property="og:type" content="${og.type ?? 'website'}">`,
    `<meta property="og:title" content="${esc(og.title ?? title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    url ? `<meta property="og:url" content="${esc(url)}">` : '',
    `<meta name="twitter:card" content="summary">`,
    jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '',
  ].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scal
e=1">
${meta}
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap" rel="stylesheet">
<style>
${css}</style></head><body>`.replace('initial-scal\ne=1', 'initial-scale=1');
}

// ── 개별 페이지 ──────────────────────────────────────────────────────────
function renderPage(i, prev, next, total100) {
  const file = fileOf(i);
  const url = urlOf(file);
  const label = i.collection === '100선'
    ? `사자성어 이야기 ${i.num} / ${total100}`
    : `사자성어 이야기 ${i.num} · ${dateKo(i.date)}`;
  const title = `${i.hangul}(${i.hanja}) 뜻과 유래 — ${SITE_TITLE}`;
  const description = `${i.hangul}(${i.hanja}) ${i.meaning} 출전: ${i.origin}. 유래 이야기와 오늘의 쓰임, 예문을 담았습니다.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${i.hangul}(${i.hanja}) 뜻과 유래`,
    alternativeHeadline: i.meaning,
    description,
    inLanguage: 'ko',
    datePublished: i.date,
    dateModified: i.date,
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: AUTHOR },
    publisher: { '@type': 'Organization', name: SITE_TITLE },
    about: { '@type': 'DefinedTerm', name: i.hangul, alternateName: i.hanja, description: i.meaning },
    keywords: [i.hangul, i.hanja, `${i.hangul} 뜻`, `${i.hangul} 유래`, '사자성어', '고사성어'].join(', '),
  };
  const prevLink = prev ? `<a href="${fileOf(prev)}" rel="prev">← ${esc(prev.hangul)}</a>` : '<a class="empty"></a>';
  const nextLink = next ? `<a href="${fileOf(next)}" rel="next">${esc(next.hangul)} →</a>` : '<a class="empty"></a>';
  return `${head({ title, description, url, css: PAGE_CSS, og: { type: 'article', title: `${i.hangul}(${i.hanja}) 뜻과 유래` }, jsonLd })}<main class="wrap">
<div class="top"><span>${label}</span><a href="index.html">목록으로</a></div>
<article>
<div class="hero">
  <div class="hanja">${esc(i.hanja)}<span class="seal">${esc(i.hangul)}</span></div>
  <div>
    <h1>${esc(i.hangul)}</h1>
    <div class="lit">${esc(i.lit)}</div>
    <p class="meaning">${esc(i.meaning)}</p>
    <p class="origin">${esc(i.origin)}</p>
  </div>
</div>
<h2>유래 이야기</h2>
<div class="story">${i.story.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
<h2>오늘에 새기는 뜻</h2>
<p class="lesson">${esc(i.lesson)}</p>
<h2>이렇게 씁니다</h2>
<ul class="ex">${i.examples.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
</article>
<nav class="nav">${prevLink}${nextLink}</nav>
</main></body></html>`;
}

// ── 목록 ─────────────────────────────────────────────────────────────────
const item = (i, withDate) =>
  `<li><a href="${fileOf(i)}"><span class="num">${pad(i.num)}</span><span class="h">${esc(i.hanja)}</span>` +
  `<span class="r">${esc(i.hangul)}</span><span class="m">${esc(i.meaning)}` +
  (withDate ? `<em class="d">${i.date}</em>` : '') + `</span></a></li>`;

function renderIndex(list) {
  const base = list.filter((i) => i.collection === '100선');
  const daily = list.filter((i) => i.collection !== '100선').sort((a, b) => b.num - a.num);
  const description = `사자성어 ${list.length}개의 뜻과 유래, 오늘의 쓰임과 예문. 고진감래, 새옹지마, 온고지신 등 100선에 이어 매일 한 편씩 더해 갑니다.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_TITLE,
    url: `${SITE}/`,
    description,
    inLanguage: 'ko',
    author: { '@type': 'Person', name: AUTHOR },
  };
  let body = `<h1 style="margin-bottom:6px">${esc(SITE_TITLE)}</h1>` +
    `<p class="lit" style="margin-bottom:24px">유래와 뜻, 오늘의 쓰임을 함께 담았습니다. 100선에 이어 매일 한 편씩 더해 갑니다.</p>`;
  if (daily.length) {
    body += `<h2>이어지는 이야기 <small>${daily.length}편</small></h2><ul class="list">${daily.map((i) => item(i, true)).join('')}</ul>`;
  }
  body += `<h2>사자성어 100선</h2><ul class="list">${base.map((i) => item(i, false)).join('')}</ul>`;
  return `${head({ title: `${SITE_TITLE} — 사자성어 뜻과 유래 ${list.length}편`, description, url: `${SITE}/`, css: PAGE_CSS + INDEX_CSS, jsonLd })}<main class="wrap">${body}</main></body></html>`;
}

// ── sitemap, robots ──────────────────────────────────────────────────────
function renderSitemap(list) {
  const latest = list.reduce((m, i) => (i.date > m ? i.date : m), '');
  const urls = [
    { loc: `${SITE}/`, lastmod: latest, priority: '1.0', changefreq: 'daily' },
    ...list.map((i) => ({ loc: urlOf(fileOf(i)), lastmod: i.date, priority: '0.8', changefreq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n') +
    `\n</urlset>\n`;
}
const renderRobots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

// ── 실행 ─────────────────────────────────────────────────────────────────
const list = loadIdioms();
const total100 = list.filter((i) => i.collection === '100선').length;
mkdirSync(OUT, { recursive: true });
// 이전 빌드의 낡은 페이지를 치운다 (이름이 바뀐 경우 대비)
const keep = new Set(list.map(fileOf));
for (const n of readdirSync(OUT)) {
  if (/^\d{3}_.+\.html$/.test(n) && !keep.has(n)) unlinkSync(join(OUT, n));
}
list.forEach((i, idx) => {
  writeFileSync(join(OUT, fileOf(i)), renderPage(i, list[idx - 1], list[idx + 1], total100), 'utf-8');
});
writeFileSync(join(OUT, 'index.html'), renderIndex(list), 'utf-8');
writeFileSync(join(OUT, 'sitemap.xml'), renderSitemap(list), 'utf-8');
writeFileSync(join(OUT, 'robots.txt'), renderRobots(), 'utf-8');
if (!existsSync(join(OUT, '.nojekyll'))) writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`빌드 완료: ${list.length}편 → docs/ (sitemap ${list.length + 1}개 URL)`);
