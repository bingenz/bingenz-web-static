# Implementation decisions

## 2026-09-16 — authoritative specification and continuity
- Decision: preserve supplied document verbatim in IMPLEMENTATION_SPEC.md before implementation.
- Reason: explicit owner instruction and Section 41 context-loss recovery.
- Alternatives: conversation-only memory rejected.
- Consequence: all future sessions must read this specification and state files before edits.
- Affected files: docs/commerce/*.

## 2026-09-16 — recover Git history without overwriting extracted source
- Decision: recover metadata from official remote master, compare existing files, then create codex/commerce-storefront.
- Reason: current folder contains no .git; remote master is accessible.
- Consequence: preserve every existing file and document differences before implementation. Do not infer live production commit from remote master.
- Affected resources: local Git metadata and official GitHub remote.

## 2026-09-16 — corrected live simulation path
- Decision: use C:/Users/Acer/Downloads/QuickShare_2609122051, containing 35 current HTML files.
- Reason: specified nested QuickShare/_2609122051 path does not exist; live directory differs only in separator placement.
- Alternatives: older ZIP rejected; no archive used.
- Consequence: importer must accept an explicit source path; preserve originals outside public/ and Git.
- Affected resources: local simulation audit/import source.
