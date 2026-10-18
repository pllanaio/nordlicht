# Contentdock / MoneyPrinterTurbo: REA investigation

Date: 2026-10-18. This report describes the baseline before the current integration. No application source, MCP configuration, or global toolchain was modified during the investigation.

## Provenance and actual REA execution

- Contentdock source: https://github.com/pllanaio/nordlicht at `4bd88d48bf884d76283c98daeab0da925b27b5ea`.
- An immutable `git archive` of that commit was extracted to `/workspace/tooling/nordlicht-baseline`, avoiding concurrent source edits and installed dependencies.
- MoneyPrinterTurbo source: https://github.com/harry0703/MoneyPrinterTurbo at `9e7d8b7efa6b912058156943906542b53b945f0a`.
- REA skill/source: https://github.com/morluto/rea at `c12d9eda87aa5a022ee7e18ea96d8d03bfd12e96`; read `.agents/skills/reverse-engineer-anything/SKILL.md`, `references/connection-and-recovery.md`, and `references/javascript-applications.md`.
- Executed published `rea-agents@6.7.0` through npx using existing Node 24.19.0. Package integrity/tarball recorded in `/workspace/tooling/rea-evidence/package-provenance.json`. No setup/MCP registration or native engines installed.
- Command: `npx -y rea-agents@6.7.0 analyze-javascript-application /workspace/tooling/nordlicht-baseline --format json`.
- Complete retained output: `/workspace/tooling/rea-evidence/nordlicht-baseline.json` (about 31 MB).
- Main Evidence: `ev_90b906625b3beb369f6d7e5baad334641768323d21deb1cc3c3f6b67cc5a854d`.
- Artifact SHA-256: `72dba0c003c4cc0050ea8620e6b16aed16f80d7699c3ec897770e581b7a5d6ba`.
- Official summary projection: `/workspace/tooling/rea-evidence/nordlicht-summary.json`, Evidence `ev_83098d90d63d5695a3d84c443ec06c1fa31e956960cef2ac5a669a68928f28fe`.
- Official AiStudio module projection: `/workspace/tooling/rea-evidence/ai-studio-module.json`, Evidence `ev_8a3e95a59a0f024ef1c7f30970b085538d83a0702768611e78f1521ca450077c`.
- Compact extracted references with exact nodes/source hashes: `/workspace/tooling/rea-evidence/integration-references.json` (a local extraction of the main evidence, not a new REA Evidence record).

REA parsed 64 JavaScript/TypeScript files among 67 relevant files, read 467,169 text bytes, reported zero skipped files/parse failures, and retained 647 graph nodes / 777 edges. Graph coverage remains **partial**, with 5,394 semantic unknowns. Next.js `@/` aliases are often retained as external/unresolved references. Static observations do not prove runtime behavior, authorization effectiveness, or successful provider calls. The source tree is the supplied artifact here; REA's `shipped-artifact` authority field must not be read as proof of deployment.

## Integration findings

All REA nodes below belong to the main Evidence ID above. Behavioral explanations are corroborated by direct source reading, not runtime execution.

| Finding | Evidence / source | Integration consequence |
| --- | --- | --- |
| AiStudio exports a client component and fetches `/api/ai/generate`. Its existing modes produce captions, hashtags, hooks and repurposing text. | Module `jag_node_e166daec286d09bbf9635701ec30573f5fd70674db629f4f1f1f24196d3ee3d4`; fetch node `jag_node_ee478f4bf2aaec29592a6831631bf46bbea46bc31d4f2d20135453d10a3df6c4`; `src/components/dashboard/ai-studio.tsx:36,63`. | Add the video workflow as a first-class studio surface; preserve demo labeling and existing text features. |
| The AI route calls OpenAI Responses using a request-specific key and returns parsed JSON. | Endpoint `jag_node_68d911955a77b538b73b83a6121ff244a9abae795e8bcb1ef45e2417b2f1ea99`; `src/app/api/ai/generate/route.ts:24,44`. | Reuse explicit BYOK handling only if the new pipeline can carry it securely through durable processing; do not persist plaintext credentials in job input/logs. |
| Existing media POST and GET routes expose Node handlers. Source inserts assets with workspace/user IDs and serves assets through authenticated routes. | Modules `jag_node_559f313a36101b47bea340538192936de6e0d903515edc13e6ee7092b9fe6892` and `jag_node_1a4beb4c99a87426fb1b5b7611609d1de0c4f94241dc8b2093ed92a30e596281`; `src/app/api/workspace/media/route.ts:29,48`. | Store finished MP4 with the existing MediaAsset contract and protected preview route. The baseline upload cap is 12 MB; generated videos need explicit storage/size handling. |
| Workspace store exports `ensureWorkspaceContext`, `loadWorkspaceData`, and persistence helpers. Database module exports the PostgreSQL pool. | Modules `jag_node_4b917ce36cb66b8facab2dcb09a454a7c768931c30d3c8535e8a85cc5ee63c60` and `jag_node_1851132e8a6a95ddb05ab3c19cc1ac3a65b65dd1e5be5bb493a7711a6dc3e540`. | Bind job creation, status, downloads and publishing to the established workspace identity, and keep job state in durable storage. |
| Dashboard already fetches media uploads and workspace state. | Endpoint nodes `jag_node_c5b630eab66dde8458701d37dd3b8c74b2628fde19bebd78af923a73c2949b91` and `jag_node_df89fbcdc4622f53447e294c6a4bf6a70d9dda48f373e5f247e0080eff7b3c04`; `src/components/dashboard/dashboard-app.tsx:708,865,897`. | Return generated media into existing library state and support post creation from that asset. |

## MoneyPrinterTurbo workflow (source-derived, not REA Python evidence)

REA's JavaScript analyzer does not analyze the Python implementation. The requested upstream behavior was read directly in pinned source; no claim of REA decompilation or executed Python analysis is made.

`app/services/task.py:_run_pipeline` (1516–1903) performs preflight → script → search terms → audio → subtitles → media acquisition → final composition, updates stage progress, and returns stage-specific errors. Intermediate `stop_at` paths support script/terms/audio/subtitle/material outputs. Core boundaries are `generate_script` (358), `generate_terms` (379), `generate_audio` (551), `generate_subtitle` (649), `get_video_materials` (723), and `generate_final_videos` (977). Provider implementations live in `llm.py`, `voice.py`, `material.py`, and `video.py`.

The media service selects clips according to aspect and duration, and records material source metadata. Narration duration determines required material coverage. Subtitle generation can use TTS timing or transcription, then final rendering combines clips, narration, subtitles and optional background audio. Treat dynamic network URLs as untrusted, constrain downloads/render resources, and keep material attribution/source records with output.

The upstream completes the video task before optional cross-platform posting (`task.py` around 1830–1901); it records distinct `cross_post_state/results/error`, so posting failures do not invalidate a successful rendered video. This is the relevant model for the user's later Instagram/TikTok/YouTube publishing requirement: persistent publication status and per-platform failures should remain separate from rendering status.

## Unverified / intentionally out of scope for this investigation

No provider credentials used, no paid generation performed, no social publication made, and no browser/rendering runtime validated. REA is not a replacement for the separately requested Cloudflare security audit or integration tests. This evidence describes baseline source only and must not be presented as validation of later implementation changes or launch readiness. Python code/media licensing needs attribution checks if copied; recreating the staged workflow does not establish rights to bundled music/fonts.
