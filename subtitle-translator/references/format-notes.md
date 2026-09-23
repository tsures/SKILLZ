# Subtitle Format Notes

## SRT
- Cue structure: numeric index, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, one or more text lines, blank separator.
- In preserve mode, keep index and timestamp lines exactly.

## WebVTT
- Preserve `WEBVTT` header, cue identifiers, timestamps, cue settings, NOTE/STYLE/REGION blocks, and inline tags.
- Translate cue payload only.

## ASS / SSA
- Preserve section headers, style definitions, and event metadata.
- `Dialogue:` lines are comma-delimited metadata followed by text; do not reorder or rewrite metadata fields.
- Preserve override tags such as `{\\an8}`, `{\\i1}`, `{\\pos(...)}`, and drawing/animation commands exactly.

## SBV
- Preserve timestamp lines such as `0:00:01.000,0:00:04.000` exactly in preserve mode.

## SUB
- `.sub` is ambiguous. It may be MicroDVD text (`{start}{end}Text`) or a binary/image-based subtitle companion format.
- Only translate text-based `.sub` directly. If the content is binary or requires an `.idx` companion, stop and explain that OCR/extraction is required before translation.

## General tag safety
Preserve HTML-like tags (`<i>`, `<b>`, `<u>`, `<font ...>`, `<c...>`, voice tags) and brace-style renderer tags exactly unless the user explicitly requests style changes.
