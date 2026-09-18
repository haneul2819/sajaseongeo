// 소개·개인정보처리방침·404 페이지의 본문.
// build.mjs 가 머리말·메뉴·바닥글을 붙여 docs/ 에 쓴다. 문장을 고치려면 이 파일을 고친다.

export function staticPages(ctx) {
  const { esc, SITE, SITE_TITLE, OPERATOR, CONTACT_EMAIL, REPO_URL, count, categories, firstDate, effective } = ctx;

  return [
    {
      file: 'about.html',
      title: `소개 — ${SITE_TITLE}`,
      heading: '사이트 소개',
      description: `${SITE_TITLE}는 사자성어 ${count}편의 뜻과 유래, 오늘의 쓰임과 예문을 담고 강의 음성으로도 들려주는 사이트입니다. HNLAB 하늘디지털랩스가 만들었습니다.`,
      body: `
<p class="lead">${esc(SITE_TITLE)}는 사자성어 하나마다 글자의 뜻과 소리, 말이 생겨난 이야기, 오늘의 삶에 새길 뜻, 실제로 쓰는 예문을 한 장에 담는 사이트입니다. 지금 ${count}편이 실려 있고 매일 한 편씩 더해 갑니다.</p>

<h2>무엇을 담나요</h2>
<ul class="plain">
  <li><b>뜻과 훈음</b> — 네 글자 각각의 훈과 음, 직역과 속뜻을 함께 적습니다.</li>
  <li><b>출전과 유래</b> — 말이 처음 나온 책이나 고사를 밝히고, 그 이야기를 세 문단으로 풀어 씁니다. 특정한 출전이 없는 관용 성어는 그렇다고 밝힙니다.</li>
  <li><b>오늘에 새기는 뜻과 예문</b> — 옛이야기를 지금의 생활로 옮겨 생각해 볼 한두 문장과, 그 성어가 실제로 들어간 현대 예문을 붙입니다.</li>
  <li><b>한 글자씩 보기</b> — 같은 한자가 쓰인 다른 사자성어를 이어 보여 줘, 글자 하나를 여러 성어 속에서 익힐 수 있게 합니다.</li>
  <li><b>강의 음성</b> — 모든 이야기를 강사가 읽어 주듯 들을 수 있습니다. 읽는 문단이 화면에서 함께 표시됩니다.</li>
</ul>
<p>이야기는 ${categories.map((c) => esc(c.name)).join(', ')}의 열 갈래로 나누어 두었습니다. 목록에서 한글·한자·뜻으로 찾거나, 갈래와 첫소리(ㄱ~ㅎ)로 걸러 볼 수 있습니다.</p>


<h2>만든 곳</h2>
<p>${esc(SITE_TITLE)}는 ${esc(OPERATOR)}가 만들고 운영합니다. 첫 글은 ${esc(firstDate)}에 실었습니다. 광고가 붙더라도 광고주가 글의 내용에 관여하지 않습니다.</p>

<h2>저작권</h2>
<p>이 사이트의 글과 음성의 저작권은 ${esc(OPERATOR)}에 있습니다. 출처(사이트 이름과 주소)를 밝힌 짧은 인용과 개인 학습·수업 자료로의 활용은 환영합니다. 글 전체를 옮겨 싣는 것은 삼가 주세요.</p>
`,
    },
    {
      file: 'privacy.html',
      title: `개인정보처리방침 — ${SITE_TITLE}`,
      heading: '개인정보처리방침',
      description: `${SITE_TITLE}의 개인정보처리방침입니다. 수집하는 정보, 쿠키와 광고, 브라우저 저장소 사용을 안내합니다.`,
      body: `
<p class="lead">${esc(SITE_TITLE)}(${esc(SITE.replace(/^https?:\/\//, ''))}, 이하 "사이트")는 방문자의 개인정보를 소중히 여기며, 어떤 정보가 어떻게 쓰이는지 아래와 같이 알려 드립니다.</p>

<h2>1. 직접 수집하는 개인정보</h2>
<p>사이트에는 회원가입, 로그인, 댓글, 입력 양식이 없습니다. 이름·이메일·전화번호 같은 개인정보를 사이트가 직접 수집하거나 보관하지 않습니다.</p>

<h2>2. 자동으로 처리되는 정보</h2>
<ul class="plain">
  <li><b>호스팅</b> — 사이트는 GitHub, Inc.의 GitHub Pages에서 제공됩니다. GitHub는 서비스 운영과 보안을 위해 방문자의 IP 주소 등 접속 기록을 처리할 수 있습니다. 자세한 내용은 <a href="https://docs.github.com/ko/site-policy/privacy-policies/github-general-privacy-statement">GitHub 개인정보 처리방침</a>을 따릅니다.</li>
  <li><b>글꼴</b> — 본문 글꼴(Noto Serif KR)을 Google Fonts에서 불러옵니다. 이 과정에서 브라우저의 IP 주소 등이 Google에 전달될 수 있습니다.</li>
  <li><b>검색 등록</b> — 사이트는 Google Search Console 등 검색 서비스에 등록되어 있으나, 방문자를 추적하는 분석 도구(예: 방문 통계 스크립트)는 쓰지 않습니다.</li>
</ul>

<h2>3. 광고와 쿠키</h2>
<p>사이트는 Google 애드센스 광고를 게재할 수 있습니다. 광고와 관련해 다음 사항을 알려 드립니다.</p>
<ul class="plain">
  <li>Google을 비롯한 제3자 공급업체는 쿠키를 사용하여 사용자가 이 사이트나 다른 웹사이트를 이전에 방문한 기록을 바탕으로 광고를 게재합니다.</li>
  <li>Google은 광고 쿠키를 사용하여, Google과 그 파트너가 이 사이트 및 인터넷의 다른 사이트 방문 기록을 바탕으로 사용자에게 적합한 광고를 게재할 수 있도록 합니다.</li>
  <li>사용자는 <a href="https://adssettings.google.com">Google 광고 설정</a>에서 맞춤 광고를 사용하지 않도록 설정할 수 있습니다. 또한 <a href="https://www.aboutads.info/choices/">www.aboutads.info</a>에서 제3자 공급업체의 맞춤 광고용 쿠키 사용을 해제할 수 있습니다.</li>
  <li>Google이 파트너 사이트에서 정보를 사용하는 방식은 <a href="https://policies.google.com/technologies/partner-sites?hl=ko">Google 파트너 사이트 데이터 사용 안내</a>에서 확인할 수 있습니다.</li>
  <li>광고를 게재할 때는 유럽 경제 지역·영국·스위스 방문자에게 Google의 동의 관리 도구로 쿠키 사용 동의를 먼저 묻도록 설정합니다.</li>
</ul>
<p>브라우저 설정에서 쿠키를 거부하거나 삭제할 수 있습니다. 쿠키를 거부해도 글을 읽고 음성을 듣는 데에는 지장이 없습니다.</p>

<h2>4. 브라우저 저장소</h2>
<p>강의 음성의 재생 속도(예: 1.2배)를 다음 방문에도 기억하기 위해 브라우저의 로컬 저장소(localStorage)에 저장합니다. 이 값은 방문자의 기기에만 남고 사이트나 제3자에게 전송되지 않습니다.</p>

<h2>5. 외부 서비스로의 공유</h2>
<p>글의 공유 버튼(X, 페이스북 등)은 누르는 순간에만 해당 서비스의 창을 엽니다. 누르기 전에는 어떤 정보도 그 서비스로 보내지 않습니다. 링크·글 복사와 이미지 카드는 방문자의 기기 안에서만 처리됩니다.</p>

<h2>6. 아동의 개인정보</h2>
<p>사이트는 만 14세 미만 아동을 포함해 누구의 개인정보도 의도적으로 수집하지 않습니다.</p>

<h2>7. 방침의 변경</h2>
<p>이 방침이 바뀌면 이 페이지에 바뀐 내용과 날짜를 알립니다.</p>
<p class="meta">시행일: ${esc(effective)}</p>
`,
    },
    {
      file: '404.html',
      title: `페이지를 찾을 수 없습니다 — ${SITE_TITLE}`,
      heading: '페이지를 찾을 수 없습니다',
      description: '요청한 페이지가 없습니다.',
      noindex: true,
      body: `
<p class="lead">주소가 바뀌었거나 잘못 입력된 것 같습니다. 목록에서 한글·한자·뜻으로 찾아보세요.</p>
<p><a class="btn" href="${SITE}/">사자성어 목록으로 가기</a></p>
<p class="meta">찾던 사자성어가 아직 없다면 조금만 기다려 주세요. 매일 한 편씩 더해 갑니다.</p>
`,
    },
  ];
}
