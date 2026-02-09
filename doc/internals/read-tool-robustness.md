# Read Tool Robustness

`packages/daycare/sources/plugins/shell/tool.ts` now uses the same robust read behavior pattern used in the reference coding-agent implementation.

## What changed

- Accepts relative or absolute `path`.
- Adds optional `offset` and `limit` for line-based pagination.
- Truncates text by whichever limit is hit first:
  - `2000` lines
  - `50KB`
- Emits actionable continuation hints (`Use offset=... to continue.`).
- Detects supported images (`jpeg`, `png`, `gif`, `webp`) and returns image content blocks.
- Applies macOS-friendly path fallbacks for screenshot-like filenames:
  - AM/PM narrow no-break space variant
  - NFD unicode normalization
  - Curly apostrophe variant

## Read Flow

```mermaid
flowchart TD
  A[read path, offset, limit] --> B[normalize path and resolve from workspace]
  B --> C[sandboxCanRead secure resolution]
  C --> D{file type}
  D -->|image| E[return text note + image base64 content]
  D -->|text| F[split into lines]
  F --> G[apply offset and optional limit]
  G --> H[truncate by 2000 lines or 50KB]
  H --> I[return text with continuation hint]
```
