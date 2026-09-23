#!/usr/bin/env python3
import argparse
import re
import sys
from pathlib import Path
from collections import Counter

TIMECODE_PATTERNS = [
    re.compile(r"^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{3}.*$"),
    re.compile(r"^\s*\d+:\d{2}:\d{2}[,.]\d{3}\s*,\s*\d+:\d{2}:\d{2}[,.]\d{3}\s*$"),
]
MICRODVD_RE = re.compile(r"^\{\d+\}\{\d+\}")
ASS_DIALOGUE_RE = re.compile(r"^Dialogue:\s*", re.IGNORECASE)
TAG_RE = re.compile(r"(?:<[^>]+>|\{\\[^}]+\})")


def read_utf8(path: Path):
    try:
        return path.read_text(encoding="utf-8"), None
    except UnicodeDecodeError as exc:
        return None, f"not valid UTF-8: {exc}"
    except OSError as exc:
        return None, str(exc)


def timestamp_lines(text: str):
    out = []
    for line in text.splitlines():
        if any(p.match(line) for p in TIMECODE_PATTERNS) or MICRODVD_RE.match(line):
            out.append(line.rstrip())
        elif ASS_DIALOGUE_RE.match(line):
            parts = line.split(",", 3)
            if len(parts) >= 3:
                out.append(",".join(parts[:3]).rstrip())
    return out


def cue_count(text: str, suffix: str):
    suffix = suffix.lower()
    lines = text.splitlines()
    if suffix in {".ass", ".ssa"}:
        return sum(1 for l in lines if ASS_DIALOGUE_RE.match(l))
    if suffix == ".sub" and any(MICRODVD_RE.match(l) for l in lines):
        return sum(1 for l in lines if MICRODVD_RE.match(l))
    return sum(1 for l in lines if any(p.match(l) for p in TIMECODE_PATTERNS))


def empty_cues(text: str, suffix: str):
    suffix = suffix.lower()
    lines = text.splitlines()
    empties = 0
    if suffix in {".ass", ".ssa"}:
        for line in lines:
            if ASS_DIALOGUE_RE.match(line):
                parts = line.split(",", 9)
                if len(parts) == 10 and not parts[9].strip():
                    empties += 1
        return empties
    if suffix == ".sub" and any(MICRODVD_RE.match(l) for l in lines):
        for line in lines:
            m = MICRODVD_RE.match(line)
            if m and not line[m.end():].strip():
                empties += 1
        return empties
    for i, line in enumerate(lines):
        if any(p.match(line) for p in TIMECODE_PATTERNS):
            j = i + 1
            payload = []
            while j < len(lines) and lines[j].strip():
                payload.append(lines[j])
                j += 1
            if not any(p.strip() for p in payload):
                empties += 1
    return empties


def tags(text: str):
    return Counter(TAG_RE.findall(text))


def main():
    parser = argparse.ArgumentParser(description="Validate translated subtitle structure.")
    parser.add_argument("source", type=Path)
    parser.add_argument("translated", type=Path)
    parser.add_argument("--mode", choices=["preserve", "retimed"], default="preserve")
    args = parser.parse_args()

    errors, warnings = [], []
    src, err = read_utf8(args.source)
    if err:
        errors.append(f"source {err}")
    dst, err = read_utf8(args.translated)
    if err:
        errors.append(f"translated {err}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        return 2

    src_count = cue_count(src, args.source.suffix)
    dst_count = cue_count(dst, args.translated.suffix)
    if dst_count == 0:
        errors.append("no subtitle cues/timestamps detected in translated file")

    if args.mode == "preserve":
        if src_count != dst_count:
            errors.append(f"cue count differs: source={src_count}, translated={dst_count}")
        src_ts = timestamp_lines(src)
        dst_ts = timestamp_lines(dst)
        if src_ts != dst_ts:
            errors.append("timecode/timing markers differ in preserve mode")

    empty = empty_cues(dst, args.translated.suffix)
    if empty:
        errors.append(f"translated file contains {empty} empty cue(s)")

    src_tags = tags(src)
    dst_tags = tags(dst)
    missing = src_tags - dst_tags
    extra = dst_tags - src_tags
    if missing:
        errors.append("formatting tags missing/changed: " + ", ".join(f"{k} x{v}" for k, v in missing.items()))
    if extra:
        warnings.append("translated file contains additional tags: " + ", ".join(f"{k} x{v}" for k, v in extra.items()))

    non_ascii = sum(1 for c in dst if ord(c) > 127)
    letters = sum(1 for c in dst if c.isalpha())
    if letters and non_ascii == 0:
        warnings.append("translated file contains no non-ASCII characters; verify native orthography if target language normally uses them")

    print(f"source cues: {src_count}")
    print(f"translated cues: {dst_count}")
    print(f"mode: {args.mode}")
    for w in warnings:
        print(f"WARNING: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    if errors:
        return 1
    print("OK: structural validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
