# Milestone 1 status and acceptance

## Implemented

Existing types/provider interfaces remain the architecture. Added optional bounded narrative
memory. The world is cloned for AI calls; schema-validated operations apply to a private
draft. Deterministic consequences produce the narrator's factual summary. Narration failure
leaves the old save untouched. SQLite commits snapshot and turn in one transaction before
the UI publishes the new state. Visual failure falls back to STATE_BOARD.

The native app owns HTTPS model/runtime acquisition, progress, resumable `.part` files,
SHA-256 validation, safe archive extraction, random loopback port and process-local API
secret, health checks, GPU/smaller-model/CPU fallback and Windows Job cleanup. Players never
see that internal secret and no external inference service is used.

## Verification evidence

- TypeScript: 24 automated tests passing (validation, rollback, invalid IDs/counts,
  faction authority, commander synchronization, concurrent turns, isolated AI inputs,
  narration/save/visual failures, compact prompts, narrative recovery).
- Frontend: `npm run typecheck` and `npm run build` passing.
- Rust: seven tests passing (real SQLite rollback/reopen/stale writers, SHA-256,
  hardware tier selection, inference request bounds, exclusive model-directory lock).
- Initial Windows CI passed: NSIS installer, real 4B CPU model automatic download,
  verification, Korean inference and restart. Run: https://github.com/kovemu/AI-threekingdoms/actions/runs/35814760811
  The 170.71-second smoke duration includes download and two loads, not per-turn latency.
- The second Windows run built successfully but exposed an interpreter prompt defect:
  JSON grammar was supplied to llama.cpp without teaching the model the operation fields.
  The model chose invalid event resolutions; rule validation rejects those IDs. The prompt
  now includes its exact output schema and a generic reinforcement/march example.
- The third run exposed army identity confusion despite valid JSON. Compact projections
  now join commander names and reinforcement sources, while dynamic grammar restricts
  army commands to owned armies and same-location transfer pairs. Rules still validate
  every operation. One failed CPU interpretation took about 159 seconds on CI, so the CPU
  request deadline is 300 seconds and the planning latency range has been revised upward.
- The fourth run selected the correct armies but confused requested total with additional
  troops. The interpreter wire response now starts with a short allocation assessment
  before operations, so it can establish current/target/delta before emitting an amount.
  That model note is discarded; it never updates state or supplies canonical narration.
- The final Windows workflow additionally checks the production JSON-schema interpreter
  against the supplied troop-transfer/march example; see its run result before acceptance.
- Interactive GUI: not yet verified. Local browser startup failed; the connected cloud
  browser cannot access localhost (`ERR_BLOCKED_BY_CLIENT`). No screenshot claimed.
- 8GB GPU inference speed/peak VRAM: not measured in this environment.
- Independent review could not run because the reviewer hit its usage limit. Author review
  was used and found the dialogue-memory and concurrent-instance issues addressed here.

## Planning estimates (not benchmarks)

| Profile | Download | Expected VRAM | Expected application RAM | Warm whole-turn latency |
| --- | ---: | ---: | ---: | ---: |
| Qwen3-8B Q4_K_M, GPU | 5.03GB (4.68GiB) | about 6–7.5GB | about 6–10GB | provisional 10–35 seconds |
| Qwen3-4B Q4_K_M, CPU | 2.50GB (2.33GiB) | little beyond display | about 4–7GB | provisional 60–300+ seconds |

The estimates assume a compact scenario projection and short narration; actual latency
varies by GPU bandwidth, CPU, input length, background GPU load and prompt processing.
Cold startup includes verification and model loading. Total system RAM includes the OS
and other applications in addition to the application estimate. 16GB is the minimum
shipping target; lower-RAM fallback is best effort, not an accepted minimum configuration.

## Deliberate decisions

- Use an app-downloaded, checksum-pinned llama.cpp runtime instead of committing large
  binaries to git. This adds first-run network dependency but preserves zero configuration.
- Use a 214 CE alternate-history scenario to match the supplied Chengdu/Zhang Fei example.
- Reject the whole action when any proposed operation is illegal; do not partially march
  or transfer troops without player knowledge.
- Commit after successful narration, with validated state privately available beforehand.
  This avoids saving a half-finished turn when the text model fails.
- CPU fallback on unknown GPU detection is conservative; AMD/Intel GPU acceleration needs
  additional detection and acceptance work.
- High-tier profiles can be added to the manifest/provider structure, but no 14B download
  is enabled before 8GB acceptance.

## Windows acceptance checklist

1. Clean install on Windows x64, 8GB VRAM and 16GB RAM: automatic 8B preparation.
2. Enter `장비에게 병사 3천을 맡겨 한중으로 보내고 나는 성도에 남는다.`
3. Check garrison 4,000, Zhang Fei army 3,000 at Hanzhong, Liu Bei at Chengdu,
   date advanced and a standoff event. Repeat phrasing variants; measure interpretation accuracy.
4. Exit and restart: exact troop counts, locations and narrative restored.
5. Interrupt a download; restart and verify resumed transfer/checksum validation.
6. Fill GPU memory or test a machine without supported GPU detection: smaller/CPU fallback.
7. Kill or fail text inference: no partial state saved, retry works.
8. Record warm turn latency and peak VRAM/RAM over a 15-minute session.

## Milestone 2: STATE_BOARD

Use fixed scenario coordinates and deterministic SVG. Add faction color ownership overlays,
army counts/markers, character markers, active front lines, date and event labels. All
positions derive from the same canonical snapshot. Keep the board read-only; chat remains
the sole command surface. Cache the last visual for NONE and keep SCENE generation disabled
until text performance is accepted on 8GB hardware.
