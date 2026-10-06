# UI SPEC — DecentraIDE

> The UI must match the reference screenshots. **Image 1 = main reference (layout, spacing, tone).** **Image 2 = all other pages/tabs.** Do not redesign; reproduce.

## 1. Design language
- **Theme:** dark, VS Code–like, dense, professional. Near-black backgrounds (`#0B0D10`–`#12151A`), 1px subtle borders (`#232830`).
- **Accent:** mint/teal green (`#2EE6A6`-ish) for primary actions, "healthy/connected/passed" states.
- **Semantic colors:** amber = warning/review required · red = rejected/denied/error · blue = info/peer cursor · green = pass/verified.
- **Type:** UI font Inter (or system sans); code/terminal font JetBrains Mono. Base size 12–13px; compact line height.
- **Components:** small rounded corners (4–6px), pill badges, thin icons (lucide), no heavy shadows.
- **Per-peer colors:** Arjun = red/coral, Rahul = blue, Mohammed = green. Used for cursors, avatars, version cards.
- Everything driven by **real state** (stores), not hard-coded text.

## 2. Global shell (every screen)
```
┌ TitleBar: logo "DecentraIDE" · File Edit View Run Terminal Help · [Search files, commands, peers… ⌘K] · P2P connected · 3 peers · E2E encrypted · avatar ┐
├ ProjectBar: project name ▾ · branch (feature/auth-policy) · "2 conflicts" badge · ↔ main · Last sync 8s ago · Project healthy · 12 tests passing · Sync now ┤
├ Left Sidebar ─┬──────────── Main Editor Area (tabs) ───────────┬─ Right Panel (AI assistant | Activity) ─┤
│ WORKSPACE     │  tabs: LoginService.java · UserRepository.java │  Local & private  [ON DEVICE]           │
│  nav items    │        · Conflict resolution · +               │  Suggested resolution card              │
│ EXPLORER tree │                                                │  Ask input                              │
│ LIVE PEERS    │                                                │  VERIFICATION · MERGE HISTORY           │
│ Network&sync  ├──────────── Bottom Panel (tabs) ───────────────┴─────────────────────────────────────────┤
│ Settings      │  Terminal · Logs · Security · Verification · Metrics · Problems   (+ Demo controls, Test harness) │
├ StatusBar: Transport LAN/WebRTC · RTT 24 ms · ↑/↓ KB/s · Offline-ready · local-first │ Java · UTF-8 · Ln,Col · Build passing · DecentraIDE v0.9.4 ┤
```
- Resizable splitters; bottom panel collapsible; right panel collapsible; sidebar collapsible.
- Title bar chips are live: P2P state, peer count, E2E, AI model (local/external), signaling (online/**offline** in amber).

## 3. Left sidebar
**WORKSPACE nav (with count badges):** Explorer · Source control (changed files count) · Conflict resolution (conflict count, mint badge) · Merge history · Security & verification · Metrics · Project health.
**EXPLORER:** file tree of the open folder (`decentra-auth/src/main/java/auth/...`, `test/java`, `pom.xml`, `README.md`); git status letters (M/A), unsaved dot, conflict `!` marker; context menu: New file, Rename, Delete.
**LIVE PEERS:** avatar + name + activity ("Editing LoginService.java", "Reviewing auth policy", "Running verification") + online dot; `+ Invite peer`.
**Network & sync card:** "Mesh stable · 3/3 peers synced", progress bar, "Discovery: LAN 100%".
**Footer:** Workspace settings · "Local shells · encrypted workspace".

## 4. Screens (map to Image 2, left→right, top→bottom)

### 4.1 Editor + Copilot (image 2, #1)
- Monaco editor: collaborator **cursors & selections with name flags** (Arjun/Rahul/Mohammed colored), AI-authored lines marked (gutter "AI-assisted block"), tabs with unsaved dot.
- Left explorer shows **Open editors**, **Collaborators** (with line number each), "Workspace trusted".
- Right panel **Copilot**: Task & result log; AI proposal card (diff, **Confidence**, **Attribution**), buttons **Apply / Discard**; "Proposal ID · not applied · Generated on this device".
- Bottom: Terminal (`mvn test` output).

### 4.2 Semantic conflict — resolve (image 2, #2) and Conflict resolution tab (Image 1)
- Header: "Resolve semantic overlap" + banner (green "Compatible changes · confidence 94%" **or** amber "Human review required · confidence 61–76%").
- **Three version cards** (A/B/C): author avatar, branch/feature label, op hash, code snippet, line, `Use version ↗`.
- "Why this conflicted" explanation.
- **Proposed merge** editable Monaco block (Diff view / Reset), highlighted AI-suggested lines "AI suggestion · review pending".
- Preservation chips: Authentication preserved · Account validation preserved · Session handling preserved.
- Verification stages row: **Parse → Compile → Static checks → Tests (42/42)** with duration.
- Actions: **Run verification · Accept & stage merge (primary) · Review changes · Edit proposal · Retry · Reject · Resolve manually**; "Next conflict: UserRepository.java →"; pager "Conflict 1 of 2 ‹ ›".
- Right panel: **Conflict navigation**, **AI explanation**, **Provenance** (model, context hash, timestamp), **Review queue**.
- If human review required: primary button locked until "Review changes" completed.

### 4.3 Network & Sync (image 2, #3)
- **Peers list** (left): A Arjun online·local, B Rahul online·WebRTC, C Mohammed **offline · N operations pending**.
- **Topology graph:** nodes A/B/C, lines labeled transport + RTT (e.g., `WebRTC · 18 ms`), dashed line for offline peer.
- **Convergence status** card: "Connected replicas A and B converged · C excluded while offline".
- **CRDT operation counters:** Local ops · Received · Pending · Duplicates ignored.
- **Replica hashes table:** Peer · Hash (SHA-256 prefix) · Verification (verified / syncing / offline – pending N).
- **Transport table:** WebRTC active · LAN ready · Bluetooth *not implemented*.
- **Operation flow log** + **Recovery** steps text. Right panel: **Sync evidence** (last round, vector summary).
- Bottom **Metrics**: latency sparkline (last 60 s), replication stats, security verification counts.
- Session block: Session ID, Discovery "LAN + WebRTC", "Signaling unavailable, existing links remain active" notice, Invite peer.

### 4.4 Security Monitor (image 2, #4)
- Top counters: Forged · Modified · Duplicate · Unauthorized · Malformed · **Rejected** (total).
- **Peer trust table:** Peer · Role (Owner/Developer/Unknown) · Trust (Trusted / Quarantined / Revoked) · Action (Inspect key / Review & restore / Access denied).
- **Rejected events table:** Timestamp · Peer · Reason (Invalid signature / Not a member / Payload modified / Duplicate operation / Malformed payload) · Status (REJECTED / verified).
- **Operation log** (INSERT/UPDATE/DELETE/RENAME, file, time, signature status).
- Right panel: **Security status: Protected**, **Rejection pipeline** (Member authorization → Signature verification → Schema & replay checks), **Key evidence** (key fingerprints, trusted/quarantined), "E2E encryption active".
- Footer: "Verify v95 1.9 ms · Buffer 12 KB".

### 4.5 Welcome / Invite peer (image 2, #5)
- **Welcome**: Open folder (primary), Create project, Search in workspace, Source control, Peers & membership; **Join with invitation** (paste link `decentraide://join/…` or Scan QR → Join project); Recent folders; Recent projects table (Project · Location · Last opened); "Local-first collaboration" notes (Direct P2P editing · Encrypted operations · Local AI by default).
- **Invite peer**: Project identity (ID, name), **Copy invitation**, **Rotate**, QR code, "Developer invitation" code, expiry (24h) + "owner approval required"; **Members** list with role + Revoke; **Invitation safety** text ("Membership signed by owner").
- Left shows Project identity ("Local project · Java/Maven", "Trusted workspace").

### 4.6 Source control + Project Health (image 2, #6)
- **Source control (left):** branch `main` + "2 changes", commit message input, **Create checkpoint**, Changes list (M/A), Selected diff, **Last checkpoint** (hash, message, author, time), Local only · not pushed.
- **Project Health (main):** Run checks button; table Subsystem · State · Metric/Evidence — Build (mvn compile), Tests (42/42, 0 failures), CRDT (119 ops applied), Peers (3/3 trusted), Security (92 verified · 16 rejected), Sync (3 matching replica hashes), AI (external consent required / local), Git (modified).
- **Health inspector (right):** Current session, **AI provider** (Local / External + consent), **Demo controls** (Test harness · SIMULATION): Disconnect Peer C · Restore Peer C · Kill signaling · Restore signaling · Duplicate op · Corrupt op · Last event · Reset.
- Verification staged pipeline table + Problems + Metrics (compile time, sync latency, heap).

### 4.7 Merge History / AI Merge #N detail (image 2, #7)
- Right/left list of **AI proposals** (#24 Accepted, #23 Rejected, #22 Accepted…) with file, confidence, model, time, "Compiler PASS · Tests 42/42".
- Main: **AI MERGE #24** header, status badge (Accepted/Rejected), model, context ID, reviewer, **Accepted diff** (red/green), **Merge rationale**, actions: View original proposals · Compare checkpoint · Export audit log.
- Bottom: **Copilot task & result attribution log** (who proposed, who accepted, signed op, replicated to peers) + **Context & retention** panel.

### 4.8 Human-review-required variant (image 2, #8)
Same as 4.2 with amber confidence (61%), "Behavior unverified" chip, **Accept merge** disabled/locked until **Review changes** done, Review queue "Owner approval needed".

## 5. Bottom panel tabs
| Tab | Content |
|-----|---------|
| Terminal | xterm sessions list (auth-service, verification, p2p-daemon) + shell; split view |
| Logs | Workspace logs table: Time · Level (INFO/WARN/PASS/DENY) · Source (mesh/sync/merge/security/verify/local-ai) · Event; row tint amber/red for warn/deny; level filter, search |
| Security | Rejected events summary (Trusted/Quarantined/Revoked/Rejected counts) |
| Verification | staged pipeline results |
| Metrics | latency chart, replication, security verification |
| Problems | diagnostics (count badge) |
| Demo controls / Test harness | failure simulation (see 4.6) |

## 6. States to implement for every screen
loading · empty · offline · error · human-review-required · success. No placeholder lorem text; use real or seeded demo data.

## 7. Accessibility & UX rules
Keyboard: ⌘/Ctrl+K command palette, ⌘/Ctrl+S save, ⌘/Ctrl+` toggle terminal, F8 next conflict. Visible focus rings; color is never the only signal (icon + text for status).
