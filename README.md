# 사자성어 이야기

**https://haneul2819.github.io/sajaseongeo/**

사자성어 100선(유래·뜻·오늘의 쓰임·예문)을 먼저 올려 두고, 그 뒤로 PC가 켜져 있는 동안
**매일 한 편씩** 100선에 없는 사자성어를 자동으로 더해 가는 사이트입니다.

글을 쓰는 주체는 **로그인된 Claude Code 구독 세션**입니다. `ANTHROPIC_API_KEY`는 쓰지
않습니다. 생성 스크립트가 환경에서 키를 걷어내고 헤드리스 모드로 세션을 띄웁니다.

```
매일 10:00 (작업 스케줄러 Sajaseongeo-Daily)
   ↓
run-scheduled.ps1     오늘 한 편이 이미 있으면 건너뛴다
   ↓
generate-idiom.sh     기존 목록 + 집필 규칙을 프롬프트로 조립
   ↓
claude -p             목록에 없는 사자성어 선택 → 집필 → data/idioms/NNN_한글.json 저장
   ↓
검사 → build.mjs(docs/ 재생성) → git commit & push → GitHub Pages 갱신
```

---

## 1. 구조

```
사자성어/
├─ config.json              하루 편수·마감 시각·사이트 주소
├─ prompts/write-idiom.md   집필 규칙. 글의 성격을 바꾸려면 여기를 고칩니다
├─ data/
│  ├─ idioms/               글의 원본. NNN_한글.json 하나가 한 편 (001~100은 100선)
│  └─ rejected/             검사에 걸린 글
├─ docs/                    빌드 결과. GitHub Pages가 이 폴더를 그대로 서비스합니다
│  ├─ index.html, NNN_한글.html, sitemap.xml, robots.txt
├─ scripts/
│  ├─ build.mjs             data → docs (페이지·목록·sitemap·robots·SEO 메타)
│  ├─ generate-idiom.sh     한 편 생성 (핵심)
│  ├─ list-idioms.mjs       기존 목록을 프롬프트용으로 출력
│  ├─ validate-idiom.mjs    새 글 검사 (한자 4자, 문단 수, 중복, 번호, 이모지)
│  ├─ run-scheduled.ps1     예약 실행기 (재시도·마감 처리)
│  ├─ register-task.ps1     작업 스케줄러 등록·해제
│  ├─ import-html.mjs       (일회성) 원래의 HTML 100편을 JSON으로 되돌린 도구
│  └─ page.css, index-extra.css   원래 디자인 그대로의 스타일
└─ logs/                    월별 실행 기록 (git에 올리지 않음)
```

글의 원본은 `data/idioms/*.json` 입니다. `docs/`는 언제든 다시 만들 수 있습니다.

```bash
npm run build
```

## 2. 손으로 한 편 만들어 보기

```bash
bash scripts/generate-idiom.sh
```

2~5분 걸립니다. 결과 한 줄은 `logs/2026-09.log` 에 남습니다. 성공하면 바로 커밋·푸시되어
1~2분 안에 사이트에 반영됩니다.

로그인 상태 확인 (이게 실패하면 스케줄러도 실패합니다):

```bash
claude auth status
```

`loggedIn: false` 이면 터미널에서 `claude` 를 실행해 다시 로그인하세요.

## 3. 스케줄러

`Sajaseongeo-Daily` 작업이 매일 10:00에 돕니다. PC가 꺼져 있어 놓치면 켜졌을 때 한 번
따라잡습니다(23시 이후면 그날 분은 접습니다).

```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1            # (재)등록
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Time 08:30
powershell -ExecutionPolicy Bypass -File scripts\register-task.ps1 -Unregister
Get-ScheduledTask -TaskName 'Sajaseongeo-Daily' | Get-ScheduledTaskInfo
Start-ScheduledTask -TaskName 'Sajaseongeo-Daily'
```

하루 편수는 `config.json`의 `postsPerDay`, 마감 시각은 `cutoffHour`입니다.

## 4. 글을 손으로 고치거나 지우기

- 고치기: `data/idioms/NNN_한글.json` 을 편집하고 `npm run build` 후 커밋.
- 지우기: 번호가 이어져야 하므로 마지막 번호만 지우는 것이 안전합니다. 가운데를 지우면
  뒤 번호를 당겨야 합니다(파일명과 `num` 둘 다).

## 5. 검색 노출

빌드가 페이지마다 `<title>`(예: "고진감래(苦盡甘來) 뜻과 유래"), meta description,
canonical, Open Graph, JSON-LD(Article) 를 넣고 `sitemap.xml`·`robots.txt` 를 만듭니다.

Google Search Console 등록 (한 번만):

1. https://search.google.com/search-console 에서 "URL 접두어" 속성으로
   `https://haneul2819.github.io/sajaseongeo/` 추가.
2. 소유권 확인은 HTML 파일 방식. `docs/google5c39d22cd6990b0e.html` 이 이미 올라가 있으니
   확인 버튼만 누르면 됩니다 (AI 블로그와 같은 계정의 토큰).
3. Sitemaps 메뉴에 `sitemap.xml` 제출.

네이버 서치어드바이저도 같은 방식(사이트 등록 → HTML 파일 확인 → 사이트맵 제출)입니다.

## 6. 배포

저장소 [haneul2819/sajaseongeo](https://github.com/haneul2819/sajaseongeo), GitHub Pages
(`main` 브랜치의 `/docs` 폴더). 빌드 단계가 없어 푸시하면 1분 안팎에 반영됩니다.
