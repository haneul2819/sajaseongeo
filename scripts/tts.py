"""사자성어 강의 음성 만들기.

data/idioms/NNN_한글.json 을 강사가 읽어 주는 대본으로 바꾸고, 뉴럴 음성(edge-tts)으로
문단별 음성을 만든 뒤 사이에 쉼을 넣어 한 파일로 잇는다.

  docs/audio/NNN.mp3     사이트에서 재생하는 파일
  data/audio/NNN.json    문단별 시작·끝 시각 (재생 중 읽는 곳을 표시하는 데 쓴다)

대본이나 목소리가 바뀌지 않았으면 다시 만들지 않는다.

사용법
  python scripts/tts.py                 없는 것·바뀐 것만 만든다
  python scripts/tts.py --only 301      한 편만
  python scripts/tts.py --force         전부 다시
  python scripts/tts.py --script 1      대본만 출력 (음성은 만들지 않음)
"""
import argparse, asyncio, hashlib, json, re, sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "idioms"
TIMING = ROOT / "data" / "audio"
AUDIO = ROOT / "docs" / "audio"
CONFIG = json.loads((ROOT / "config.json").read_text(encoding="utf-8"))
TTS = CONFIG.get("tts", {})
VOICE = TTS.get("voice", "ko-KR-HyunsuMultilingualNeural")
BASE_RATE = TTS.get("rate", "-5%")
SCRIPT_VERSION = 1  # 대본 규칙을 바꾸면 올린다 → 전부 다시 만든다

# ── 대본 ─────────────────────────────────────────────────────────────────
HANJA = r"[㐀-䶿一-鿿豈-﫿]"


def clean(s: str) -> str:
    s = re.sub(r"\([^)]*" + HANJA + r"[^)]*\)", "", s)  # 괄호 속 한자 (史記)
    s = re.sub(HANJA + "+", "", s)                         # 남은 한자
    s = re.sub(r"[『』「」《》〈〉]", "", s)
    s = s.replace("·", ", ").replace("—", ", ").replace("…", ", ")
    s = re.sub(r"\s+,", ",", s)
    s = re.sub(r"\(\s*\)", "", s)
    s = re.sub(r"([\"'])\s*\1", "", s)        # 한자를 지우고 남은 빈 따옴표
    s = re.sub(r"([\"'])\s+\(", r"\1(", s)
    s = re.sub(r"(사자|고사|한자)성어", r"\1 성어", s)  # [사자썽어] 된소리 방지 (build_script 주석 참고)
    s = re.sub(r"\s{2,}", " ", s)
    return s.strip()


def has_batchim(word: str) -> bool:
    ch = word.strip()[-1]
    code = ord(ch) - 0xAC00
    return 0 <= code < 11172 and code % 28 != 0


def jong(ch: str) -> int:
    code = ord(ch) - 0xAC00
    return code % 28 if 0 <= code < 11172 else -1


def polite_end(s: str) -> str:
    """출전 문장의 사전식 끝맺음(…전함, …있음)을 강의 말투(…전합니다)로 바꾼다."""
    s = s.rstrip(" .")
    for a, b in (("있음", "있습니다"), ("알려짐", "알려져 있습니다"), ("통함", "통합니다"), ("전함", "전합니다")):
        if s.endswith(a):
            return s[: -len(a)] + b + "."
    if s.endswith("다"):
        return s + "."
    return s + "입니다."


def meaning_end(s: str) -> str:
    """뜻 풀이의 마지막 문장: …뜻 → …뜻입니다, …견딤 → …견딤을 이르는 말입니다."""
    s = s.rstrip(" .")
    if s.endswith("다"):
        return s + "."
    if s.endswith("뜻") or s.endswith("말"):
        return s + "입니다."
    if jong(s[-1]) in (16, 10):  # ㅁ, ㄻ 받침 — 명사형 어미
        return s + "을 이르는 말입니다."
    return s + "입니다."


def meaning_line(m: str) -> str:
    parts = [p.strip() for p in re.split(r"(?<=\.)\s+", clean(m)) if p.strip()]
    if not parts:
        return ""
    parts[-1] = meaning_end(parts[-1])
    return " ".join(p if p.endswith(".") else p + "." for p in parts)


def origin_line(o: str) -> str:
    parts = [p.strip() for p in re.split(r"(?<=[^0-9])\.\s+", clean(o)) if p.strip()]
    out = []
    for k, p in enumerate(parts):
        if k == 0:
            lead = "이 말은 " if re.match(r"(특정|우리|조선|영어|불교)", p) or "비롯" in p or "옮긴" in p else "출전은 "
            p = lead + p
        out.append(polite_end(p))
    return " ".join(out)


def build_script(i: dict) -> list[dict]:
    """[{t: 대상 id, text, rate, pause}] — pause 는 이 문단 뒤에 쉬는 초."""
    h = i["hangul"]
    eul = "을" if has_batchim(h) else "를"
    lit = clean(i["lit"]).rstrip(".")
    segs = [
        # '사자성어'를 붙여 쓰면 음성 엔진이 [사자썽어]로 된소리를 낸다. 표준 발음은 [사ː자성어].
        # 대본에서만 띄어 써서 합성어 된소리를 막는다.
        {"t": "title", "text": f"오늘 함께 볼 사자 성어는, {h}입니다.", "rate": "-10%", "pause": 0.7},
        {"t": "lit", "text": f"한 글자씩 풀어 보면, {lit}.", "rate": "-18%", "pause": 0.6},
        {"t": "meaning", "text": "풀이하면, " + meaning_line(i["meaning"]), "rate": BASE_RATE, "pause": 0.5},
        {"t": "origin", "text": origin_line(i["origin"]), "rate": BASE_RATE, "pause": 0.9},
        {"t": "storyh", "text": "그럼 이 말이 어떻게 생겨났는지, 유래를 들어 보겠습니다.", "rate": BASE_RATE, "pause": 0.6},
    ]
    for k, p in enumerate(i["story"]):
        segs.append({"t": f"story-{k}", "text": clean(p), "rate": BASE_RATE, "pause": 0.55})
    segs[-1]["pause"] = 0.9
    segs.append({"t": "lesson", "text": "이 이야기에서 오늘 새길 뜻은 이렇습니다. " + clean(i["lesson"]), "rate": BASE_RATE, "pause": 0.9})
    segs.append({"t": "exh", "text": "이제 실제로 어떻게 쓰는지 예문으로 보겠습니다.", "rate": BASE_RATE, "pause": 0.5})
    leads = ["예를 들어, ", "또, ", "그리고, "]
    for k, e in enumerate(i["examples"]):
        segs.append({"t": f"ex-{k}", "text": leads[min(k, 2)] + clean(e), "rate": "-8%", "pause": 0.6})
    segs[-1]["pause"] = 0.9
    segs.append({"t": "title", "text": f"지금까지 사자 성어 {h}{eul} 함께 살펴보았습니다.", "rate": BASE_RATE, "pause": 0.3})
    return segs


# ── MP3 잇기 ─────────────────────────────────────────────────────────────
# edge-tts 출력은 MPEG-2 Layer III, 24kHz, 48kbps, 모노의 고정 비트레이트다.
# 한 프레임은 576샘플 = 24ms, 크기 144바이트(패딩 시 145).
FRAME_SEC = 576 / 24000


def split_frames(buf: bytes) -> list[bytes]:
    """MP3를 프레임 단위로 자른다. 형식이 예상과 다르면 예외."""
    out, pos = [], 0
    while pos + 4 <= len(buf):
        b1, b2 = buf[pos + 1], buf[pos + 2]
        if buf[pos] != 0xFF or (b1 & 0xE0) != 0xE0:
            raise ValueError(f"프레임 동기 오류 @{pos}")
        if (b1 & 0x18) != 0x10 or (b1 & 0x06) != 0x02 or (b2 >> 4) != 6 or ((b2 >> 2) & 3) != 1:
            raise ValueError("예상과 다른 MP3 형식 (MPEG-2 L3 48kbps 24kHz 아님)")
        size = 144 + ((b2 >> 1) & 1)
        out.append(buf[pos:pos + size])
        pos += size
    return out


def frames(buf: bytes) -> int:
    return len(split_frames(buf))


def seg_key(s: dict) -> str:
    """문단 음성의 지문. 목소리·빠르기·문장이 같으면 기존 음성을 그대로 다시 쓴다."""
    return hashlib.sha1(json.dumps([VOICE, s["rate"], s["text"]], ensure_ascii=False).encode()).hexdigest()[:12]


def reusable_clips(tfile: Path, afile: Path) -> dict:
    """기존 파일에서 문단별 음성을 떼어 {지문: 프레임 바이트} 로 돌려준다."""
    if not (tfile.exists() and afile.exists()):
        return {}
    try:
        old = json.loads(tfile.read_text(encoding="utf-8"))
        keys = old.get("keys")
        if not keys or old.get("voice") != VOICE or len(keys) != len(old["segments"]):
            return {}
        fr = split_frames(afile.read_bytes())
        clips = {}
        for key, m in zip(keys, old["segments"]):
            a, b = round(m["s"] / FRAME_SEC), round(m["e"] / FRAME_SEC)
            if 0 <= a < b <= len(fr):
                clips.setdefault(key, b"".join(fr[a:b]))
        return clips
    except Exception:
        return {}


def silence(sec: float) -> bytes:
    # 헤더 FF F3 64 C4 + 사이드 정보 9바이트 0 → part2_3_length 0 → 디코더가 무음을 낸다.
    frame = bytes([0xFF, 0xF3, 0x64, 0xC4]) + bytes(140)
    return frame * max(1, round(sec / FRAME_SEC))


async def speak(text: str, rate: str, sem: asyncio.Semaphore) -> bytes:
    for attempt in range(4):
        try:
            async with sem:
                buf = bytearray()
                async for ch in edge_tts.Communicate(text, VOICE, rate=rate).stream():
                    if ch["type"] == "audio":
                        buf += ch["data"]
            if not buf:
                raise RuntimeError("빈 음성")
            frames(bytes(buf))
            return bytes(buf)
        except Exception as e:  # 네트워크·일시 오류는 잠깐 쉬고 다시
            if attempt == 3:
                raise
            await asyncio.sleep(2 + attempt * 3)


def digest(segs) -> str:
    return hashlib.sha1(json.dumps([SCRIPT_VERSION, VOICE, segs], ensure_ascii=False).encode()).hexdigest()[:16]


async def make(i: dict, sem, force=False) -> str:
    num = f"{i['num']:03d}"
    segs = build_script(i)
    h = digest(segs)
    tfile, afile = TIMING / f"{num}.json", AUDIO / f"{num}.mp3"
    if not force and tfile.exists() and afile.exists():
        try:
            if json.loads(tfile.read_text(encoding="utf-8")).get("hash") == h:
                return "skip"
        except Exception:
            pass
    keys = [seg_key(s) for s in segs]
    have = {} if force else reusable_clips(tfile, afile)
    need = [k for k, key in enumerate(keys) if key not in have]
    fresh = await asyncio.gather(*(speak(segs[k]["text"], segs[k]["rate"], sem) for k in need))
    have.update({keys[k]: clip for k, clip in zip(need, fresh)})
    clips = [have[key] for key in keys]
    out, marks, t = bytearray(), [], 0.0
    for s, clip in zip(segs, clips):
        dur = frames(clip) * FRAME_SEC
        marks.append({"t": s["t"], "s": round(t, 2), "e": round(t + dur, 2)})
        gap = silence(s["pause"])
        out += clip + gap
        t += dur + frames(gap) * FRAME_SEC
    AUDIO.mkdir(parents=True, exist_ok=True)
    TIMING.mkdir(parents=True, exist_ok=True)
    afile.write_bytes(bytes(out))
    tfile.write_text(json.dumps({"num": i["num"], "voice": VOICE, "hash": h, "duration": round(t, 2), "segments": marks,
                                 "keys": keys}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return f"{t:.0f}s (새로 만든 문단 {len(need)}/{len(segs)})"


def load(only=None):
    items = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(DATA.glob("*.json"))]
    return [i for i in items if only is None or i["num"] in only]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=int, nargs="*")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--script", type=int, help="대본만 출력")
    ap.add_argument("--jobs", type=int, default=6)
    a = ap.parse_args()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if a.script:
        for s in build_script(load([a.script])[0]):
            print(f"[{s['t']:<8}] ({s['rate']}, 쉼 {s['pause']}s) {s['text']}")
        return
    items = load(a.only)
    sem = asyncio.Semaphore(a.jobs)
    done = fail = skip = 0

    async def run(i):
        nonlocal done, fail, skip
        try:
            r = await make(i, sem, a.force)
            if r == "skip":
                skip += 1
            else:
                done += 1
                print(f"{i['num']:03d} {i['hangul']} {r}", flush=True)
        except Exception as e:
            fail += 1
            print(f"{i['num']:03d} {i['hangul']} 실패: {e}", flush=True)

    # 편 단위로도 동시에 몇 개씩 돌린다 (문단 요청은 세마포어가 조절)
    chunk = 4
    for k in range(0, len(items), chunk):
        await asyncio.gather(*(run(i) for i in items[k:k + chunk]))
    print(f"음성 완료: 새로 {done} · 그대로 {skip} · 실패 {fail} (목소리 {VOICE})")
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
