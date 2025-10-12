# Phase 4 — Image Deliverables (Kickoff)

Status: Runtime implemented — pending docs/UI follow-up
Owner: Codex with Matt

## Goal
Enable agents to produce and manage image deliverables (creation + enhancement versions) safely and consistently across the A2A runtime.

## Scope (MVP first)
- Runtime: accept image URLs from agents (no uploads in MVP), attach as deliverable versions
- Deliverables: `type=image`, `format=image/png|image/jpeg` (etc.), `file_attachments` carries URLs and basic metadata
- Security: logs redact URLs if they contain secrets; no body logging; header allowlist preserved
- UI: show thumbnails and link to full image (basic lightbox optional)

## Out of Scope (for MVP)
- Upload/ingest (S3/Supabase Storage)
- Virus/malware scanning, moderation
- Thumbnail generation pipeline

## Data Model
- Reuse `deliverables` + `deliverable_versions`
- `deliverable_versions.file_attachments` includes array of assets:
```
[
  {
    "url": "https://cdn.example.com/img/abc.png",
    "mime": "image/png",
    "width": 1024,
    "height": 768,
    "size": 345678,
    "thumbnailUrl": "https://cdn.example.com/img/abc_thumb.jpg",
    "altText": "Diagram of...",
    "hash": "sha256:..."
  }
]
```

## Runtime Changes (MVP)
- Deliverables Adapter
  - Allow `payload.images` (array of `{ url, mime, width, height, size, thumbnailUrl, altText }`)
  - If present on build success: create image deliverable or add new version when `deliverableId` is supplied
  - Keep text/JSON deliverable path as is
- A2A Surface
  - No changes to endpoints; response payload mirrors current behavior (`payload.deliverables` for new, `metadata.newVersionId` for enhancements)
- Authoring Guides
  - Add notes to agent type docs: agents that generate images should declare `output_modes: [image/*, ...]` and return URLs

## UI Changes (MVP)
- Thumbnails and lightbox display for `payload.deliverables` with image formats
- Fallback alt text if missing

## Backlog (Post-MVP)
- Uploads: support direct uploads to Storage; signed URL policy; edge cache
- Scanning: malware/virus scanning on ingest; moderation hooks
- Thumbnails: server-side generation and storage
- Editor/Enhance: image enhancement flow and version browsing UI

## Tasks (MVP)
1. ✅ Deliverables Adapter: accept and persist `payload.images` to `file_attachments`
2. ✅ Mode Router: wire image path on build success (create or version)
3. Docs: update API/External/Tool guides with image deliverable notes
4. UI: simple thumbnails + lightbox support
5. Tests: adapter path (create/version), router integration

## Success Criteria
- Agents can return one or more image URLs on build; runtime creates deliverable/version accordingly
- UI shows images with thumbnails; structured metadata available
- No secrets in logs; headers/body content not logged

---

Next steps
- Confirm storage strategy for post‑MVP (S3/Supabase Storage)
- Decide scanning/moderation vendors if uploads are required
