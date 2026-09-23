---
name: subtitle-translator
description: Translate subtitle files for movies, series, training videos, and other timed media while preserving timing, formatting, and cross-file terminology. Use when ChatGPT needs to translate or review SRT, VTT, ASS, SSA, SUB, or SBV subtitles; create a glossary before batch translation; preserve or intentionally retime cues; validate translated subtitle structure; or check consistency across episodes/files.
---

# Subtitle Translator

Translate subtitle files with a glossary-first workflow, structural verification, and cross-file consistency review. Perform the linguistic work directly with ChatGPT; do not require Claude Code, Codex CLI, or another external LLM.

## Workflow

### 1. Inspect the input

Identify all subtitle files and their formats. Determine the source language from content when it is clear; otherwise ask only if required.

Before translation, establish these parameters if the user has not already supplied them:
- target language
- show/movie/project context: title, genre, setting, period
- known character names, relationships, organizations, invented terms, or domain terminology
- desired tone/register
- timecode mode: `preserve` or `retimed`
- whether song lyrics should be translated
- any platform-specific technical limits

Default to `preserve` when no retiming request is made.

### 2. Build `glossary.md`

Read all relevant subtitle files for recurring names, terms, catchphrases, titles, slang, technical vocabulary, and character voice cues. For large sets, inspect files individually and merge findings rather than concatenating the whole corpus blindly.

Create `glossary.md` containing:
- canonical character/place/organization spellings
- recurring source terms and approved target translations
- tone and register rules
- project-specific context
- song-lyric handling
- ambiguous terms requiring context-dependent translation

Write the glossary using the target language's native orthography and full Unicode characters.

### 3. Require glossary review before bulk translation

Present the glossary for user review before translating the full batch. Apply corrections to `glossary.md` first. Do not continue into bulk translation until the glossary is approved, unless the user explicitly asks to skip review.

### 4. Translate each file

Translate one subtitle file at a time using the approved glossary.

For files with more than 300 subtitle blocks/cues, process in chunks of about 250 blocks and reassemble them in original order.

Translation rules:
- produce natural, fluent, subtitle-friendly target-language phrasing
- use full native orthography; never ASCII-fold diacritics or transliterate native script unless the user requests transliteration
- preserve meaning, tone, humor, politeness level, and character voice
- preserve cue order
- preserve all formatting/style tags exactly unless format conversion is explicitly requested
- preserve line breaks when they carry styling/positioning semantics; otherwise optimize readability without changing cue structure in preserve mode
- follow the user's song-lyrics preference
- write output as UTF-8

Timecode modes:
- `preserve`: keep every original timecode exactly and keep cue/block count unchanged
- `retimed`: allow timecode changes and cue split/merge only when needed for readable target-language timing; preserve chronological order and valid syntax

Keep the original subtitle format unless the user explicitly asks for conversion.

Name translated files predictably. Prefer replacing an identifiable source-language token with the target-language token; otherwise append the target language before the extension, such as `Episode01.he.srt`.

### 5. Verify each translated file

Run `scripts/validate_subtitles.py` against the source and translated file.

In `preserve` mode, treat these as failures:
- cue/block count differs
- timecode sequence differs
- required formatting tags are missing or altered
- empty translated cues appear
- output is not valid UTF-8

In either mode, treat malformed timecodes, broken cue ordering, or corrupted formatting as failures.

For languages that normally contain non-ASCII characters, inspect suspicious ASCII-only output manually. Do not "repair" missing diacritics by mechanical substitution; retranslate the affected cue with stronger language instructions.

Fix validation failures before moving to the next phase.

### 6. Run cross-file consistency review

Review all translated files together against `glossary.md` for:
- terminology consistency
- name/title spelling consistency
- character voice consistency
- context errors across episode boundaries
- inconsistent honorifics/register
- native-character/diacritic errors

Apply corrections directly to the translated files and update `glossary.md` when a newly discovered canonical term should persist.

### 7. Apply optional technical limits

If the user supplies a platform specification, enforce it after linguistic consistency review. Typical checks include:
- maximum characters per line
- maximum lines per cue
- minimum/maximum cue duration
- reading speed
- gap/overlap rules
- orphan-word avoidance

Do not invent a platform specification. If none is supplied, report structural validation only.

## Format handling

For SRT/VTT/SBV, preserve timestamp syntax and cue order. For ASS/SSA, preserve dialogue metadata fields and all override tags such as `{/...}` / `{\\...}` exactly, changing only the dialogue text content. For MicroDVD/SUB or other indexed formats, preserve frame/timing markers exactly in `preserve` mode.

When format behavior is unclear, consult `references/format-notes.md` before editing.

## Deterministic validator

Use:

```bash
python scripts/validate_subtitles.py SOURCE TRANSLATED --mode preserve
```

or:

```bash
python scripts/validate_subtitles.py SOURCE TRANSLATED --mode retimed
```

The validator checks UTF-8 readability, cue/timestamp structure, empty cues, and tag preservation. Its report is a structural gate; linguistic quality and context still require model review.

## Output expectations

Deliver:
- `glossary.md`
- translated subtitle file(s) in the original format
- a concise validation summary listing files checked and any remaining warnings

Never claim a file is verified if validation was not actually run.
