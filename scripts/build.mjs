// data/idioms/*.json 을 읽어 docs/ 에 정적 사이트를 만든다.
//  - 목록(index.html): 검색·갈래·가나다 필터, 최근 글, 갈래별 보기
//  - 갈래 페이지(category-<slug>.html)
//  - 글 페이지(NNN_한글.html): SEO 메타, 같은 갈래의 이야기, 이전/다음
//  - sitemap.xml, robots.txt
// 사용법: node scripts/build.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data', 'idioms');
const OUT = join(ROOT, 'docs');
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'config.json'), 'utf-8'));
const CATEGORIES = JSON.parse(readFileSync(join(ROOT, 'data', 'categories.json'), 'utf-8'));
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));
const SITE = String(CONFIG.site?.url ?? '').replace(/\/$/, '');
const SITE_TITLE = CONFIG.site?.title ?? '사자성어 이야기';
const AUTHOR = CONFIG.site?.author ?? '';
const PAGE_CSS = readFileSync(join(ROOT, 'scripts', 'page.css'), 'utf-8');
const SITE_CSS = readFileSync(join(ROOT, 'scripts', 'site.css'), 'utf-8');
const SHARE_JS = readFileSync(join(ROOT, 'scripts', 'share.js'), 'utf-8');
const shareBar = (data = '') => `<div class="share"${data}><span class="share-t">공유하기</span><button data-act="native" hidden>기기로 공유</button><button data-act="link">링크 복사</button><button data-act="text">글로 복사</button>${data ? '<button data-act="image">이미지 카드</button>' : ''}<button data-act="x" class="x">X</button><button data-act="fb" class="x">페이스북</button><span class="share-msg" aria-live="polite"></span></div>`;

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const pad = (n) => String(n).padStart(3, '0');
const fileOf = (i) => `${pad(i.num)}_${i.hangul}.html`;
const catFile = (slug) => `category-${slug}.html`;
const urlOf = (file) => `${SITE}/${encodeURIComponent(file)}`;
const dateKo = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return `${y}년 ${m}월 ${day}일`;
};
const INITIALS = ['ㄱ','ㄱ','ㄴ','ㄷ','ㄷ','ㄹ','ㅁ','ㅂ','ㅂ','ㅅ','ㅅ','ㅇ','ㅈ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const INITIAL_ORDER = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const initialOf = (s) => {
  const code = s.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 ? INITIALS[Math.floor(code / 588)] : '';
};

function loadIdioms() {
  const list = readdirSync(DATA)
    .filter((n) => n.endsWith('.json'))
    .map((n) => ({ ...JSON.parse(readFileSync(join(DATA, n), 'utf-8')), _file: n }))
    .sort((a, b) => a.num - b.num);
  list.forEach((i, idx) => {
    if (i.num !== idx + 1) throw new Error(`번호가 이어지지 않는다: ${i._file} (기대 ${idx + 1})`);
    if (i._file !== `${pad(i.num)}_${i.hangul}.json`) throw new Error(`파일명이 내용과 다르다: ${i._file}`);
    if (!CAT[i.category]) throw new Error(`갈래를 모른다: ${i._file} (${i.category})`);
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
    ...(Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`),
  ].filter(Boolean).join('\n');
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${meta}
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;900&display=swap" rel="stylesheet">
<style>
${css}</style></head><body>`;
}

const breadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], idx) => ({ '@type': 'ListItem', position: idx + 1, name, item: url })),
});

const footer = (list) =>
  `<footer class="foot"><span>${esc(SITE_TITLE)} · ${list.length}편 · 매일 한 편씩 더합니다</span><span><a href="index.html">목록</a> · <a href="sitemap.xml">sitemap</a></span></footer>`;

// ── 글 페이지 ────────────────────────────────────────────────────────────
function renderPage(i, prev, next, list, byCat) {
  const file = fileOf(i);
  const url = urlOf(file);
  const cat = CAT[i.category];
  const isDaily = i.collection !== '100선' && i.collection !== '200선 추가';
  const label = `사자성어 이야기 ${i.num} / ${list.length}${isDaily ? ` · ${dateKo(i.date)}` : ''}`;
  const title = `${i.hangul}(${i.hanja}) 뜻과 유래 — ${SITE_TITLE}`;
  const description = `${i.hangul}(${i.hanja}) ${i.meaning} 출전: ${i.origin}. 유래 이야기와 오늘의 쓰임, 예문을 담았습니다.`;
  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${i.hangul}(${i.hanja}) 뜻과 유래`,
    alternativeHeadline: i.meaning,
    description,
    inLanguage: 'ko',
    datePublished: i.date,
    dateModified: i.date,
    mainEntityOfPage: url,
    articleSection: cat.name,
    author: { '@type': 'Person', name: AUTHOR },
    publisher: { '@type': 'Organization', name: SITE_TITLE },
    about: { '@type': 'DefinedTerm', name: i.hangul, alternateName: i.hanja, description: i.meaning },
    keywords: [i.hangul, i.hanja, `${i.hangul} 뜻`, `${i.hangul} 유래`, cat.name, '사자성어', '고사성어'].join(', '),
  }, breadcrumb([[SITE_TITLE, `${SITE}/`], [cat.name, urlOf(catFile(cat.slug))], [i.hangul, url]])];

  // 같은 갈래에서 자기 다음 6편 (순환)
  const same = byCat[i.category];
  const at = same.findIndex((x) => x.num === i.num);
  const related = [];
  for (let k = 1; k <= 6 && k < same.length; k++) related.push(same[(at + k) % same.length]);

  const prevLink = prev ? `<a href="${fileOf(prev)}" rel="prev">← ${esc(prev.hangul)}</a>` : '<a class="empty"></a>';
  const nextLink = next ? `<a href="${fileOf(next)}" rel="next">${esc(next.hangul)} →</a>` : '<a class="empty"></a>';
  return `${head({ title, description, url, css: PAGE_CSS + SITE_CSS, og: { type: 'article', title: `${i.hangul}(${i.hanja}) 뜻과 유래` }, jsonLd })}<main class="wrap">
<div class="top"><span>${label} · <a class="cat" href="${catFile(cat.slug)}">${esc(cat.name)}</a></span><a href="index.html">목록으로</a></div>
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
${shareBar(` data-h="${esc(i.hangul)}" data-j="${esc(i.hanja)}" data-m="${esc(i.meaning)}" data-l="${esc(i.lit)}" data-o="${esc(i.origin)}" data-c="${esc(cat.name)}"`)}
${related.length ? `<h2>같은 갈래의 이야기 <a class="cat" href="${catFile(cat.slug)}" style="font-size:13px;font-weight:400">${esc(cat.name)} 전체 →</a></h2>
<ul class="rel">${related.map((r) => `<li><a href="${fileOf(r)}"><span class="h">${esc(r.hanja)}</span><span class="r">${esc(r.hangul)}</span></a></li>`).join('')}</ul>` : ''}
<nav class="nav">${prevLink}${nextLink}</nav>
${footer(list)}
</main><script>${SHARE_JS}</script></body></html>`;
}

// ── 목록 항목 ────────────────────────────────────────────────────────────
const item = (i, { withDate = false } = {}) =>
  `<li data-n="${i.num}" data-c="${i.category}" data-i="${initialOf(i.hangul)}" data-k="${esc(i.hangul)}" data-s="${esc(`${i.hangul} ${i.hanja} ${i.meaning} ${i.lit} ${CAT[i.category].name}`.toLowerCase())}">` +
  `<a href="${fileOf(i)}"><span class="num">${pad(i.num)}</span><span class="h">${esc(i.hanja)}</span>` +
  `<span class="r">${esc(i.hangul)}</span><span class="m">${esc(i.meaning)}` +
  (withDate ? `<em class="d">${i.date}</em>` : '') + `</span><span class="tag">${esc(CAT[i.category].name)}</span></a></li>`;

// ── 목록 페이지 ──────────────────────────────────────────────────────────
function renderIndex(list, byCat) {
  const description = `사자성어 ${list.length}개의 뜻과 유래, 오늘의 쓰임과 예문을 열 갈래로 나누어 담았습니다. 검색과 가나다순으로 찾아보고, 매일 한 편씩 더해 갑니다.`;
  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_TITLE,
    url: `${SITE}/`,
    description,
    inLanguage: 'ko',
    author: { '@type': 'Person', name: AUTHOR },
  }];
  const latest = [...list].sort((a, b) => b.num - a.num).slice(0, 6);
  const sample = (slug) => byCat[slug].slice(0, 3).map((x) => x.hangul).join(' · ');

  const body = `
<header class="site-head">
  <h1>${esc(SITE_TITLE)}</h1>
  <p class="lit">유래와 뜻, 오늘의 쓰임을 함께 담았습니다. 매일 한 편씩 더해 갑니다.</p>
  <div class="stats"><span><b>${list.length}</b>편</span><span><b>${CATEGORIES.length}</b>갈래</span><span><b>${latest[0].date}</b>마지막 갱신</span></div>
</header>
<div class="top-share">${shareBar()}</div>
<section class="find" aria-label="찾기">
  <input id="q" type="search" placeholder="사자성어 · 한자 · 뜻으로 찾기  (예: 우정, 苦, 새옹지마)" autocomplete="off" aria-label="검색">
  <div class="chips" id="cats"><button data-c="" class="on">전체 <small>${list.length}</small></button>${CATEGORIES.map((c) => `<button data-c="${c.slug}">${esc(c.name)} <small>${byCat[c.slug].length}</small></button>`).join('')}</div>
  <div class="chips ini" id="ini"><button data-i="" class="on">가나다</button>${INITIAL_ORDER.map((k) => `<button data-i="${k}">${k}</button>`).join('')}</div>
  <div class="bar"><span id="count">${list.length}편</span><span class="sort"><button data-s="num" class="on">번호순</button><button data-s="ka">가나다순</button></span></div>
</section>
<section class="latest" id="latest">
  <h2 class="sec-h">최근 더한 이야기 <small>매일 10시 무렵 한 편</small></h2>
  <ul>${latest.map((i) => `<li><a href="${fileOf(i)}"><span class="h">${esc(i.hanja)}</span><span class="r">${esc(i.hangul)} · ${esc(CAT[i.category].name)}</span><span class="d">${pad(i.num)} · ${i.date}</span></a></li>`).join('')}</ul>
</section>
<section class="cats" id="catsec">
  <h2 class="sec-h">갈래별로 보기</h2>
  <ul>${CATEGORIES.map((c) => `<li><a href="${catFile(c.slug)}"><span class="c">${byCat[c.slug].length}편</span><span class="n">${esc(c.name)}</span><span class="s">${esc(c.desc)}</span><span class="e">${esc(sample(c.slug))} …</span></a></li>`).join('')}</ul>
</section>
<h2 class="sec-h" id="allh">전체 목록 <small>번호를 누르면 이야기로 갑니다</small></h2>
<ul class="list" id="list">${list.map((i) => item(i)).join('')}</ul>
<p class="empty-msg" id="empty">찾는 사자성어가 아직 없습니다. 다른 말로 찾아보거나, 내일 더해질 이야기를 기다려 주세요.</p>
${footer(list)}
<script>
(function(){
  var q=document.getElementById('q'),list=document.getElementById('list'),items=[].slice.call(list.children);
  var count=document.getElementById('count'),empty=document.getElementById('empty');
  var latest=document.getElementById('latest'),catsec=document.getElementById('catsec');
  var cat='',ini='',sort='num';
  function on(group,attr,val){[].forEach.call(document.querySelectorAll('#'+group+' button'),function(b){b.classList.toggle('on',b.getAttribute(attr)===val)});}
  function apply(){
    var s=q.value.trim().toLowerCase(),n=0;
    items.forEach(function(li){
      var ok=(!cat||li.dataset.c===cat)&&(!ini||li.dataset.i===ini)&&(!s||li.dataset.s.indexOf(s)>-1);
      li.classList.toggle('off',!ok); if(ok)n++;
    });
    count.textContent=n+'편'+(s||cat||ini?' 찾음':'');
    empty.classList.toggle('on',n===0);
    var filtering=!!(s||cat||ini);
    latest.style.display=filtering?'none':'';catsec.style.display=filtering?'none':'';
    try{history.replaceState(null,'',filtering?('#'+[s?'q='+encodeURIComponent(s):'',cat?'c='+cat:'',ini?'i='+ini:''].filter(Boolean).join('&')):location.pathname);}catch(e){}
  }
  function resort(){
    var sorted=items.slice().sort(sort==='num'?function(a,b){return a.dataset.n-b.dataset.n}:function(a,b){return a.dataset.k.localeCompare(b.dataset.k,'ko')});
    sorted.forEach(function(li){list.appendChild(li)});
  }
  q.addEventListener('input',apply);
  document.getElementById('cats').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;cat=b.dataset.c;on('cats','data-c',cat);apply();});
  document.getElementById('ini').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;ini=b.dataset.i;on('ini','data-i',ini);apply();});
  document.querySelector('.bar .sort').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;sort=b.dataset.s;[].forEach.call(b.parentNode.children,function(x){x.classList.toggle('on',x===b)});resort();});
  // 주소의 #q=…&c=…&i=… 복원
  try{
    var h=location.hash.slice(1);
    if(h){h.split('&').forEach(function(p){var kv=p.split('=');if(kv[0]==='q')q.value=decodeURIComponent(kv[1]||'');if(kv[0]==='c')cat=kv[1]||'';if(kv[0]==='i')ini=decodeURIComponent(kv[1]||'');});
      on('cats','data-c',cat);on('ini','data-i',ini);apply();}
  }catch(e){}
})();
</script><script>${SHARE_JS}</script>`;
  return `${head({ title: `${SITE_TITLE} — 사자성어 ${list.length}편의 뜻과 유래`, description, url: `${SITE}/`, css: PAGE_CSS + SITE_CSS, jsonLd })}<main class="wrap wide">${body}</main></body></html>`;
}

// ── 갈래 페이지 ──────────────────────────────────────────────────────────
function renderCategory(c, items, list) {
  const url = urlOf(catFile(c.slug));
  const title = `${c.name} 사자성어 ${items.length}편 — ${SITE_TITLE}`;
  const description = `${c.desc}. ${items.slice(0, 6).map((i) => i.hangul).join(', ')} 등 ${c.name} 갈래의 사자성어 ${items.length}편, 뜻과 유래와 예문.`;
  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${c.name} 사자성어`,
    url,
    description,
    inLanguage: 'ko',
    isPartOf: { '@type': 'WebSite', name: SITE_TITLE, url: `${SITE}/` },
  }, breadcrumb([[SITE_TITLE, `${SITE}/`], [c.name, url]])];
  const body = `
<div class="top"><span>${esc(SITE_TITLE)} · 갈래</span><a href="index.html">목록으로</a></div>
<header class="site-head">
  <h1>${esc(c.name)}</h1>
  <p class="lit">${esc(c.desc)} · ${items.length}편</p>
</header>
<div class="top-share">${shareBar()}</div>
<div class="chips" style="margin-bottom:18px">${CATEGORIES.map((x) => x.slug === c.slug ? `<button class="on" disabled>${esc(x.name)}</button>` : `<a href="${catFile(x.slug)}">${esc(x.name)}</a>`).join('')}</div>
<ul class="list">${items.map((i) => item(i)).join('')}</ul>
${footer(list)}<script>${SHARE_JS}</script>`;
  return `${head({ title, description, url, css: PAGE_CSS + SITE_CSS, jsonLd })}<main class="wrap wide">${body}</main></body></html>`;
}

// ── sitemap, robots ──────────────────────────────────────────────────────
function renderSitemap(list) {
  const latest = list.reduce((m, i) => (i.date > m ? i.date : m), '');
  const urls = [
    { loc: `${SITE}/`, lastmod: latest, priority: '1.0', changefreq: 'daily' },
    ...CATEGORIES.map((c) => ({ loc: urlOf(catFile(c.slug)), lastmod: latest, priority: '0.7', changefreq: 'weekly' })),
    ...list.map((i) => ({ loc: urlOf(fileOf(i)), lastmod: i.date, priority: '0.8', changefreq: 'monthly' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n') +
    `\n</urlset>\n`;
}
const renderRobots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

// ── 실행 ─────────────────────────────────────────────────────────────────
const list = loadIdioms();
const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.slug, list.filter((i) => i.category === c.slug)]));
mkdirSync(OUT, { recursive: true });
const keep = new Set([...list.map(fileOf), ...CATEGORIES.map((c) => catFile(c.slug))]);
for (const n of readdirSync(OUT)) {
  if (/^(\d{3}_.+|category-.+)\.html$/.test(n) && !keep.has(n)) unlinkSync(join(OUT, n));
}
list.forEach((i, idx) => {
  writeFileSync(join(OUT, fileOf(i)), renderPage(i, list[idx - 1], list[idx + 1], list, byCat), 'utf-8');
});
for (const c of CATEGORIES) writeFileSync(join(OUT, catFile(c.slug)), renderCategory(c, byCat[c.slug], list), 'utf-8');
writeFileSync(join(OUT, 'index.html'), renderIndex(list, byCat), 'utf-8');
writeFileSync(join(OUT, 'sitemap.xml'), renderSitemap(list), 'utf-8');
writeFileSync(join(OUT, 'robots.txt'), renderRobots(), 'utf-8');
if (!existsSync(join(OUT, '.nojekyll'))) writeFileSync(join(OUT, '.nojekyll'), '');
console.log(`빌드 완료: ${list.length}편, 갈래 ${CATEGORIES.length}개 → docs/ (sitemap ${list.length + CATEGORIES.length + 1}개 URL)`);
