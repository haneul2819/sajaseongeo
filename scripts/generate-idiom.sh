#!/usr/bin/env bash
#
# 사자성어 이야기 — 한 편 생성
#
#   scripts/generate-idiom.sh
#
# 하는 일
#   1) data/idioms 의 기존 목록을 읽어 프롬프트에 넣는다
#   2) 헤드리스 Claude 세션이 목록에 없는 사자성어 하나를 골라 JSON으로 저장한다
#   3) 검사 → docs/ 재빌드 → git commit & push
#
# ANTHROPIC_API_KEY는 쓰지 않는다. 로그인된 구독 세션을 그대로 사용한다.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

read_config() {
  node -e '
    const cfg = JSON.parse(require("fs").readFileSync("config.json", "utf-8"));
    let v = cfg; for (const k of process.argv[1].split(".")) v = v?.[k];
    process.stdout.write(v == null ? "" : String(v));
  ' "$1"
}

TIMEOUT_SECONDS="$(read_config timeoutSeconds)"; [ -n "$TIMEOUT_SECONDS" ] || TIMEOUT_SECONDS=900
TODAY="$(date +%Y-%m-%d)"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="logs/$(date +%Y-%m).log"
RAW_DIR="logs/raw"
DATA_DIR="data/idioms"
mkdir -p "$DATA_DIR" data/rejected logs "$RAW_DIR"

log_line() { printf '%s | %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG_FILE"; }
say() { printf '%s\n' "$1" >&2; }
finish_fail() {
  log_line "FAIL | ${SECONDS}s | - | $1"
  say ""; say "실패: $1"; say "로그: ${LOG_FILE}"
  printf 'RESULT=fail\nREASON=%s\n' "$1"
  exit 1
}

# ── claude 실행 파일 ──────────────────────────────────────────────────────
CLAUDE_BIN="${CLAUDE_BIN:-}"
if [ -z "$CLAUDE_BIN" ]; then
  if command -v claude >/dev/null 2>&1; then CLAUDE_BIN="$(command -v claude)"
  else
    for c in "$HOME/AppData/Roaming/npm/claude" "$HOME/.local/bin/claude" "/usr/local/bin/claude"; do
      [ -x "$c" ] && { CLAUDE_BIN="$c"; break; }
    done
  fi
fi
[ -n "$CLAUDE_BIN" ] || finish_fail "claude 실행 파일을 찾지 못했다. CLAUDE_BIN 환경 변수로 경로를 지정하라."
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL || true

say "── 사자성어 이야기 · 한 편 생성 ──────────────────────────"
say "  날짜   ${TODAY}"
say "  실행   ${CLAUDE_BIN}"

# ── 1. 기존 목록 ──────────────────────────────────────────────────────────
LIST="$(node scripts/list-idioms.mjs)"
NEXT_NUM="$(printf '%s\n' "$LIST" | grep '^NEXT_NUM=' | cut -d= -f2)"
LIST="$(printf '%s\n' "$LIST" | grep -v '^NEXT_NUM=')"
NEXT_PAD="$(printf '%03d' "$NEXT_NUM")"
say "기존 $((NEXT_NUM-1))편. 이번은 ${NEXT_PAD}번."

# ── 2. 프롬프트 ───────────────────────────────────────────────────────────
PROMPT_FILE="$(mktemp)"; BEFORE="$(mktemp)"; AFTER="$(mktemp)"
trap 'rm -f "$PROMPT_FILE" "$BEFORE" "$AFTER" 2>/dev/null || true' EXIT
{
  cat prompts/write-idiom.md
  printf '\n\n---\n\n## 이번 회차 정보\n\n'
  printf -- '- 오늘 날짜: %s\n' "$TODAY"
  printf -- '- 번호(num): %s\n' "$NEXT_NUM"
  printf -- '- 저장 경로: `%s/%s_<한글4자>.json` (예: `%s/%s_결자해지.json`)\n' "$DATA_DIR" "$NEXT_PAD" "$DATA_DIR" "$NEXT_PAD"
  printf -- '- 저장소 루트: `%s`\n' "$ROOT"
  printf '\n## 이미 실린 목록 (%s편)\n\n' "$((NEXT_NUM-1))"
  printf '%s\n' "$LIST"
  printf '\n이 목록에 있는 것은 고르지 않는다.\n'
} > "$PROMPT_FILE"

find "$DATA_DIR" -maxdepth 1 -name '*.json' | sort > "$BEFORE"

# ── 3. 헤드리스 세션 ──────────────────────────────────────────────────────
OUT_JSON="${RAW_DIR}/${STAMP}.json"; ERR_LOG="${RAW_DIR}/${STAMP}.err"
say "Claude 세션 시작 (최대 ${TIMEOUT_SECONDS}초)..."
RUNNER=()
if command -v timeout >/dev/null 2>&1; then
  RUNNER=(timeout --signal=TERM --kill-after=30 "$TIMEOUT_SECONDS")
fi
set +e
"${RUNNER[@]}" "$CLAUDE_BIN" -p "$(cat "$PROMPT_FILE")" \
  --allowedTools "Read,Write,Edit,WebSearch,WebFetch" \
  --permission-mode acceptEdits \
  --output-format json > "$OUT_JSON" 2> "$ERR_LOG"
STATUS=$?
set -e
if [ "$STATUS" -eq 124 ]; then
  finish_fail "Claude 세션이 ${TIMEOUT_SECONDS}초 제한을 넘겨 중단됐다."
fi
RESULT_TEXT="$(node -e 'try{process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1],"utf-8")).result??""))}catch{}' "$OUT_JSON")"
if [ "$STATUS" -ne 0 ]; then
  say "$(tail -n 3 "$ERR_LOG" 2>/dev/null || true)"
  finish_fail "Claude 세션이 종료 코드 ${STATUS}로 끝났다: $(printf '%s' "$RESULT_TEXT" | head -c 160) (원본: ${ERR_LOG})"
fi

# ── 4. 새 파일 ────────────────────────────────────────────────────────────
find "$DATA_DIR" -maxdepth 1 -name '*.json' | sort > "$AFTER"
NEW_FILE="$(comm -13 "$BEFORE" "$AFTER" | head -1)"
if [ -z "$NEW_FILE" ]; then
  CLAIMED="$(printf '%s' "$RESULT_TEXT" | grep -m1 '^FILE:' | sed 's/^FILE:[[:space:]]*//' | tr -d '\r')"
  if [ -n "$CLAIMED" ] && [ -f "$CLAIMED" ]; then NEW_FILE="$CLAIMED"; fi
fi
[ -n "$NEW_FILE" ] || finish_fail "새 JSON 파일이 생기지 않았다. 원본 응답: ${OUT_JSON}"
say "생성된 파일: ${NEW_FILE}"

# ── 5. 검사와 빌드 ────────────────────────────────────────────────────────
if ! node scripts/validate-idiom.mjs "$NEW_FILE" >&2; then
  REJ="data/rejected/${STAMP}_$(basename "$NEW_FILE")"
  mv "$NEW_FILE" "$REJ"
  finish_fail "검사 불합격. ${REJ} 로 옮겼다."
fi
IDIOM="$(node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf-8"));process.stdout.write(j.hangul+" "+j.hanja)' "$NEW_FILE")"

# 강의 음성. 실패해도 글은 음성 없이 발행한다 (다음에 python scripts/tts.py 로 채울 수 있다).
AUDIO_NOTE=""
PY_BIN="$(command -v python || command -v py || true)"
if [ -n "$PY_BIN" ] && PYTHONIOENCODING=utf-8 "$PY_BIN" scripts/tts.py --only "$NEXT_NUM" >&2; then
  say "강의 음성 생성 완료."
else
  AUDIO_NOTE="음성 생성 실패 — 글만 발행"
  say "경고: 강의 음성을 만들지 못했다. 글은 음성 없이 발행한다."
fi

if ! node scripts/build.mjs >&2; then
  REJ="data/rejected/${STAMP}_$(basename "$NEW_FILE")"
  mv "$NEW_FILE" "$REJ"
  node scripts/build.mjs >&2 || true
  finish_fail "빌드 실패. ${REJ} 로 옮겼다."
fi

# ── 6. 커밋과 푸시 ────────────────────────────────────────────────────────
PUSH_NOTE=""
git add -- "$NEW_FILE" docs data/audio
if git diff --cached --quiet; then
  PUSH_NOTE="변경 없음 — 커밋 생략"
else
  git commit -q -m "post: ${NEXT_PAD} ${IDIOM}" -m "자동 생성: ${NEW_FILE}"
  say "커밋 완료."
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if git push -q origin "$BRANCH" 2>>"$ERR_LOG"; then
    say "origin/${BRANCH} 푸시 완료."
  else
    PUSH_NOTE="푸시 실패 — 커밋은 남아 있다"
    say "경고: 푸시 실패. 커밋은 로컬에 남아 있다."
  fi
fi

log_line "OK | ${SECONDS}s | $(basename "$NEW_FILE") | ${IDIOM}${AUDIO_NOTE:+ | $AUDIO_NOTE}${PUSH_NOTE:+ | $PUSH_NOTE}"
say ""
say "완료 — ${SECONDS}초 · ${IDIOM} · ${NEW_FILE}"
printf 'RESULT=ok\nFILE=%s\nIDIOM=%s\n' "$NEW_FILE" "$IDIOM"
