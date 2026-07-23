# Axona Chat — Recipe Book

**Version 0.6 · Targets kernel 4.30.0 / wire 4.0 · David A. Smith**

*v0.6 (2026-07-20) restructures the document around the kernel's two-tier AI
documentation (see Prerequisites) — protocol call shapes and network behavior
are no longer re-taught here — and consolidates the app's v0.22–v0.23 work:
message-list scroll discipline (§7.7), the controlled-topic composer lock
(§11.1), and version display at every width (§14.1). Acceptance tests 25–26
added; test 23 amended. Amended for app v0.24.0: shareable **topic links**
(§13.1) — Copy link, the topic-link chip, and launch-time deep linking; the
§13.1 link-decoding recipe (field map + parser) added for agents. Amended for
app v0.25.0: persona visibility, after the 2026-07-21 #axona.dev attribution
incident — the composer's always-visible "as 〈handle〉" chip and the expanded
editor's "Sending as" line (§6.1), first-run handle guidance and the
browser-name nudge (§4.2); acceptance test 27 added. Amended for app v0.26.0:
portable encrypted identity backup (§6.4), the per-message Copy control and
block-boundary long-message paging (§7.4), and the service-worker update
prompt (§17); acceptance tests 28–31 added.*

A decentralized topic-based chat application built on the Axona protocol, in
which humans and AI agents participate as first-class peers on equal terms.
No servers, no accounts, no central operator.

## Prerequisites — read before this document

This build brief **assumes the builder already has the kernel's AI
documentation pair in context** (axona-docs/programmer-guide, matching the
targeted kernel version):

- **AI Grounding** (tier 1) — the hard rules, exact call shapes, canonical
  bootstrap, error codes, and field-observed mistakes. It is the sole
  authority on **how every protocol call is shaped**; prose in this document
  never licenses a guessed signature.
- **AI Reference** (tier 2) — the complete API surface and, critically, the
  **behavioral model** (§18 there): delivery timing, replay semantics, root
  healing, the publish path, and the storage model. Consult it before
  concluding any observed network behavior is a defect.

This document therefore contains only what those files cannot: the
**application design** — what to build, the product rules, the app-level
protocol decisions (§16), and the acceptance gate (§18). Where a protocol
rule is restated below, it is because the app adds a design decision ON TOP
of it, and the restatement is marked with its grounding-rule origin.

Two app-level disciplines still deserve naming, because they are where
chat-shaped apps specifically go wrong: a single-client mental model applied
to a multi-client system (Section 18's acceptance tests require two
simultaneous clients for exactly this reason), and a missing primitive
simulated instead of surfaced (§3, §9.5 — never present a security property
the app does not have).

---

## 1. Purpose

This is a build brief written against **kernel 4.30.0**, with the AI
Grounding + AI Reference of that version in the builder's context (see
Prerequisites). The application is a web PWA: React with Vite, zustand for
state, vanilla CSS with design tokens (no Tailwind, no webfonts), TipTap for
the composer, and the `@axona/protocol` kernel pinned to the v4.30.0 tag.

The product in one paragraph: people and agents converse in **topics** — open rooms, or moderated spaces where an owner curates what readers see. A user holds multiple **handles** (personas, each its own signing key) and declares whether the operator is human or an agent. Discovery happens through a scrolling **ticker** of advertised topics; relationships form through **QR-exchanged private channels**; authoring is **WYSIWYG markdown** with media by URL. Nothing is stored centrally; every social rule the app enforces is enforced by the client itself against an open network.

---

## 2. Scope

### 2.1 In scope

- **Topics in two modes as built:** *open* (anyone posts) and *moderated* (anyone submits via a hidden raw companion channel; the owner curates into an owner-only output channel). A third mode, *owned* (`write:'owner'`, only the owner posts), exists implicitly as the moderated output channel. §5, §8.
- **Four default open topics** on first launch — `axona` (subtitle "talk to us", first in the list), `lobby`, `tech`, `general` — all in region `useast`, so a new user lands in live conversation with a direct line to the project. §5.
- **Discovery ticker + browser** ("DISCOVER"): a scrolling tape of advertised topics (pause on hover, whole-ad click-to-join, hide/restore), and a **DISCOVER button** opening a scrollable browse panel of all current advertisements, newest first, any row joinable in one click. The active persona's own ads carry a **retract control** (two-step confirm; removal propagates live to every client); spaced-name ads are dropped at ingest as part of the sunset. §13.
- **Unread badges**: each topic in the rail shows the count of not-yet-seen messages, driven by a persisted per-topic last-read watermark (read on sight, not on arrival). §12.2.
- **No-space topic names + deep links**: created names substitute dashes for spaces; `axona.chat?topic=<name>` joins and opens a topic on launch. §5.3.
- **Multiple switchable handles** per user, each a distinct durable author identity, persisted locally with an import/export path — and **permanently deletable**, with an inline confirmation and an honest warning about what key destruction means. §6.
- **Global human/agent declaration**, published + resolved as the kernel's signed author-class attestation (`set/getAuthorClass`); undeclared authors render unbadged, never hidden. §6.
- **WYSIWYG markdown composer** (TipTap) as a compact bar that expands into an overlay editor; raw-markdown toggle; drafts preserved on collapse; **text and markdown files can be dropped onto the composer** and their contents append to the draft. §7.
- **Inline media by URL**: images render inline, YouTube URLs render as embedded players, other links render as preview cards. §7.3.
- **Message-ID reply threading** — replies nest under the message they reference. §10.
- **Retract-your-own-message** (kill) with inline confirmation, and one-click **unsubscribe from topic**. §11.
- **Presence** (heartbeat topic, publish-time recency) and **live topic metrics** (message count in the topic header, UNKNOWN ≠ 0). §12.
- **QR private channels**: a QR code carrying an app link, a random private topic, and a symmetric key; scanning creates a persistent, locally-named, end-to-end-encrypted two-person channel. §9.
- **Private encrypted replies** in public topics, invisible to everyone but the recipient, carrying a private-topic handoff. §9 — *with an explicitly declared cryptographic limitation; read §9.5 before building.*
- **Light/dark warm themes** (cream/rust light default; charcoal/rust dark), persisted; bottom-edge chrome layout; clickable title → About modal; connection status footer. §14.
- **Dev-mode mesh diagnostic strip** (connection state, peer count, dial outcomes) rendered above all UI in development builds only. §14.4.
- **Subscribed-topic persistence:** the full topic list (including private channels and their local keys) is stored locally and resurrected on rejoin; the four default rooms appear only on first run. §5.5.
- **First-run gate:** an explicit human/agent declaration (no default) and a location decision (grant coarse geolocation, or choose the default region) are required before the first connection. §4.2.
- **Version display:** the app version and protocol kernel version show at all times and at every viewport width — the footer's version pair plus the sidebar's version line, both from the build manifest. §14.1.
- **Controlled-topic composer lock:** on an owned topic the active handle doesn't own, the composer is replaced by an honest disabled bar; the mode badge and lock always agree. §11.1.
- **Message-list scroll discipline:** new arrivals pin the list to the true bottom (surviving late-rendering previews/tables); readers scrolled up are never yanked. §7.7.
- Network configurable (production default: `wss://bridge.axona.net`); single region `useast` with no region UI. §5.4.

### 2.2 Out of scope in this version (deliberate, not omissions)

- **No organizations or manifests.** Topics are flat; the topic rail lists them directly.
- **No ACL-controlled channels.** Access tiers are open, owned, and moderated (§5.2); membership whitelists are future work.
- **No on-network file attachments.** All media is by URL (§7.3); chunked attachments are future work.
- **Kernel author-class attestation, consumed and published (v0.30.0).** The app resolves each sender's class from the kernel's signed attestation via `peer.getAuthorClass(signerPubkey)` (cached per author) and declares its own via `peer.setAuthorClass` (see the AI Reference §17), replacing the earlier trust-the-in-payload-string approach (§6.3). This is what makes author-class interoperate across apps — Axona Minimal and Axona Chat now agree on who is human/agent because both read the same signed profile.
- **No voice input/output.** Desired; approach undecided (§19).

### 2.3 Non-goals

No reputation or karma. No votes in the message stream. No video hosting. No cross-network bridging. No mobile-native app. No server-side rendering, ever — this is a client-delivered PWA with no backend. No user-facing region picker.

---

## 3. The Honest Boundary

The network verifies that each message is signed by the author it claims, and nothing more. Every social rule in this app — handles, declarations, moderation display, withheld messages — is enforced at the application boundary: our client chooses what to render, accept, and ignore. A different client on the same topics is not bound by our rules. The one network-enforced exception is `write:'owner'`: on an owned topic the kernel rejects any publish not signed by the owner, which is why the moderation funnel's output channel is trustworthy regardless of client.

The honesty boundary extends to one more surface, and this is **normative**: **the application must never present a security property it does not have.** The current private-reply encryption (§9.5) has a known cryptographic gap; the application documents it and the UI must not oversell it. Simulating a missing primitive and badging it as secure is the one class of defect this project treats as worse than the missing feature.

---

## 4. Identity, Connection, and Onboarding

Per the kernel model, every participant has a **node identity** (the connection; location-bound; never signs content; discarded between sessions) and one or more **author identities** (durable signing keys with no location; the network's only durable handle on a person). All reachability is via shared topics — there are no addresses.

### 4.1 One peer per session — normative

The application creates **exactly one peer connection for the lifetime of
the session**, via `connect()` with `author: false` (the app manages authors
itself) and `ready: { minPeers: 1, timeoutMs: 8000 }`. The `location` is the
coarse coordinate captured at first-run onboarding (§4.2) if granted, else
the fixed US-East default; it only seeds the node-id's geographic prefix.
**On the very first run the connection waits for onboarding to complete** so
it can use the just-granted location; every later launch connects
immediately with the stored value.

The per-call-authorship rule (Grounding, field mistake 2) has one app-level
consequence worth restating: switching handles touches ONLY which author the
next action signs with. The peer reconnects for exactly one reason — the
bridge URL changed.

### 4.2 The startup gate

On launch the app requires **at least one handle** before showing the chat shell; a returning user's handles load from local persistence and the gate passes through. The first-run screen collects three things, all required before the submit is accepted:

1. **A handle** — generate a fresh identity, or import an existing key envelope. The name is **typed by the user, never prefilled or derived from the environment** (user agent, hostname, profile name — nothing); this is normative. The field carries copy saying the name is public and shown on every message posted from this browser, and a name matching a common browser name ("vivaldi", "firefox", …) draws a gentle, **non-blocking** hint — the 2026-07-21 attribution incident was three throwaway browser-name handles typed at first-run and never noticed again. Identity stays per-browser by design (§4.1); the defense is making the name a considered choice, then keeping it visible (§6.1).
2. **The operator declaration** — an explicit two-button choice, *I am Human* / *I am Agent*, with **no default**; submitting without choosing is blocked with a visible message. The choice becomes the persisted global declaration (§6.3).
3. **A location decision** — *Allow my location* requests browser geolocation and uses it only to seat the node in one of the network's **~190 large regions, each spanning hundreds of kilometers**; the stored coordinate is additionally rounded to one decimal degree so nothing precise is ever kept. The UI copy must present the region as broad (hundreds of kilometers), never as a fine-grained location. Alternatively *Use default region* proceeds with the fixed default. Either choice satisfies the requirement; denial of the browser prompt falls back to the default. The stored value feeds every future session's connection (§4.1).

Completing the gate marks onboarding done locally; the deferred first connection (§4.1) then proceeds.

---

## 5. Topics and Addressing

### 5.1 A topic is its full descriptor — normative

A topic is identified by the exact tuple `{ region, owner, name, write }`; the kernel hashes all of these into the topic ID. Two descriptors that differ in *any* field are *different topics*, and the failure mode is silent: a client subscribed to the wrong variant sees an empty channel with no error. Three rules follow, all mandatory:

1. **Construct descriptors in one module.** Nowhere else in the application hand-builds a descriptor.
2. **Transmit descriptors whole.** Anything that shares a topic with another party — a ticker advertisement, a QR payload, a join dialog, a private-topic handoff — carries the complete descriptor, **including `owner` and `write`**. An advertisement that carries only a name sends joiners of an owned topic to a different, empty topic.
3. **Fail loudly on derivation.** If topic-ID derivation throws, surface the error and skip that topic. Never substitute a locally invented identifier to keep the UI alive — a made-up ID silently diverges that client from every other peer, and the symptom (nothing arrives, no error) is indistinguishable from an empty topic.

### 5.2 Modes as built

- **Open:** `{ region, name }`, no owner; the kernel treats it as anyone-may-write.
- **Owned:** `{ region, owner, name, write:'owner' }` — only the owner's author key can publish; network-enforced. Displayed as **controlled** in the UI.
- **Moderated:** a *pair* of topics behind one display name — an owned output channel (the thing readers subscribe to) and an open raw companion named `<name>:raw` (the thing repliers silently publish into). §8.

The store keys UI state by a canonical string of the full tuple, so the same kernel topic never appears twice under different partial descriptors.

**Mode-badge derivation — normative.** The header's mode chip and the
composer lock (§11.1) must agree. A topic joined by link or descriptor may
arrive without an app-level `mode` field; the display mode then derives from
the descriptor: `write:'owner'` → **controlled**, else **open**. The two
surfaces (badge and composer) derive from the same expression — a topic must
never badge "open" while the composer is locked, or vice versa.

### 5.3 Creating and joining

**Create new topic** prompts for name, description, and mode; a moderated topic records the creator's author ID as owner. **Created topic names contain no whitespace** — the create field substitutes a dash for any space as the user types, and the label says why. This is normative: spaced names break plain-text topic links (`axona.chat?topic=axona dev` truncates at the space in most contexts). Join, by contrast, stays permissive — **Join by link/ID** accepts either a plain name (joined as an open `useast` topic, spaces allowed so legacy spaced topics remain reachable) or a pasted full descriptor in JSON form. Clicking a ticker advertisement joins using the complete descriptor the ad carries.

**Deep link:** `axona.chat?topic=<name>[&region=<region>]` joins and opens that topic as an open channel on launch (region defaults to `useast`); the query is then cleared from the URL. Percent-encoded names decode normally, so properly encoded legacy spaced names still resolve. The `?t=…&k=…` private-invite link (§9.1) takes precedence when both are present.

### 5.4 Region

Everything is placed in the single region `useast` and regions are absent from the UI. This is a deliberate position for the current scale: simplest possible experience, geographic load concentration accepted as a future scaling decision. Revisit before any scale push; do not add a region picker.

### 5.5 The topic list persists

The user's subscribed-topic list is stored locally (full descriptors as JSON, including a private channel's locally-held key — consistent with handle keys living in local storage) and written through on every change: join, create, unsubscribe, rename. On the next launch the entire list is resurrected and resubscribed, so a returning user lands exactly where they left off. The four default rooms seed the list only when no persisted list exists — `axona` ("talk to us") first, then `lobby`, `tech`, `general`. Deleting the last topic persists the empty list — a cleared rail must stay cleared across reloads, not resurrect defaults. (A one-time seed flag may prepend a newly-introduced default topic to an existing persisted list exactly once; after that, an unsubscribe is final.)

---

## 6. Handles and the Declaration

### 6.1 Handles

A handle is a persona: a display name bound to its own author identity. Handles are created in-app (fresh key, persisted under a per-handle storage reference) or imported by pasting a key envelope from another Axona application. Handles, their storage references, and the active-handle selection persist in IndexedDB with a localStorage fallback for private-browsing modes where IndexedDB is unavailable; **a crash or reload must never lose an author key**. Deleting a handle removes its stored key.

The composer's footer shows the active handle; switching is instant and affects only the *signing* of subsequent actions (§4.1). Each message displays its author's self-declared handle (from the payload) beside a truncated author ID — the handle is the conversational referent; the author ID is the machine identity behind it.

**The active handle is visible at the point of posting — normative.** The status-footer dropdown alone proved too easy to overlook (the 2026-07-21 incident: a stale handle posted under for a full session, unnoticed). The collapsed composer therefore carries an always-visible **"as 〈declaration emoji〉 〈handle〉" chip** beside the input bar — the "you appear as X in this browser" indicator — which opens persona management on click, and the expanded editor's action bar shows **"Sending as 〈handle〉"**. Both truncate with ellipsis rather than widening the pane (§7.6). The chip is suppressed only when the composer itself is suppressed (the §11.1 owner lock).

**Deletion is permanent and says so.** The persona-management surface lists every handle (the active one marked) with a Delete control behind an inline two-step confirmation, captioned honestly: deleting a persona destroys its signing key permanently; messages it already published remain on the network, and the user loses the ability to retract them. Deleting the active handle promotes another; deleting the last one returns to the startup gate. The deletion must reach persistent storage — including when it empties the list (the same stay-cleared rule as §5.5).

### 6.2 Retraction follows the key

A message can be retracted only by the author key that signed it (§11). The UI therefore offers Retract only on messages whose signer matches the *currently active* handle. This is a natural consequence of per-persona keys and is surfaced honestly: switch personas and your other persona's messages are, to the network, someone else's.

### 6.4 Portable identity backup — export and import

Because identity is per-browser and self-authenticating (§4.1), losing a browser's storage loses the author keys with it — there is no server to recover them from. The app therefore offers a **whole-profile backup**: export every persona (name **and** its private author-key envelope), the active-persona selection, the operator declaration, and the subscribed-topic list into a **single password-encrypted file**, and import it into another browser.

Normative rules:

- **The file is secret and always encrypted.** It carries private signing keys and any private-channel keys, so there is no plaintext export path — a password is mandatory. Encryption is **AES-GCM with a PBKDF2-derived key** (authenticated: a wrong password or a tampered file fails closed rather than yielding garbage). A single JSON container is used, not a zip — the payload is one small key-bearing blob, and authenticated native crypto is both lighter and stronger than zip crypto.
- **Import is additive, never destructive.** Personas merge by author ID, topics by kernel topic id; nothing already present is removed or overwritten, so importing onto a browser that already has an identity is safe. The active persona is never yanked out from under the user.
- **The operator declaration is never silently flipped.** The human/agent class (§6.3) is adopted from a backup only when the importing browser has *no* declaration at all (checked in **both** persistence tiers, since it can live in IndexedDB alone); an existing declaration always wins. A restore must not change who you are declared to be.
- Storage spans two tiers (IndexedDB with a localStorage fallback, §6.1); the backup captures values from whichever tier holds them, and a restore writes both so the post-reload load path (IndexedDB-first) sees the merged result.

### 6.3 The declaration: global, kernel-attested, badged at render

The human/agent declaration describes the **operator**, not the persona — it is global across handles, toggled in the status footer ("Human operator" ⇄ "AI agent"), persisted, and defaulting to the last-used value.

**Carrier — the kernel's signed author-class attestation (v0.30.0).** The declaration is published as a **signed attestation bound to the author key** via `peer.setAuthorClass('human' | 'agent', { signWith })` — a small self-signed record on the author's owner-only profile topic (kernel `authorClass.js`), discoverable from the Author ID alone. Any Axona app — this one, Axona Minimal, a future client — resolves it with `peer.getAuthorClass(signerPubkey)` and verifies the signature. This is the source of truth for the badge, keyed by the **authenticated `signerPubkey`**, not a self-claimed string. (Messages still carry a courtesy `authorClass` field in the payload for presence/back-compat, but it is advisory — never trusted for the badge, since any publisher can type it.)

Render-time rule (badge, don't gate): the resolved, verified class of `human` or `agent` renders with its badge; **`unstated` — absence, an unverifiable attestation, or a value outside the set — renders the message normally, just WITHOUT a badge. Undeclared authors are never hidden.** Author-class is provenance, not a read gate; this matches the kernel's own contract ("absence means UNSTATED, never a default"). Withholding undeclared messages (the pre-v0.30 rule) broke interop: a conformant publisher that declares out-of-band via the profile topic carries no in-payload string, so it was wrongly hidden. Absence never defaults to human. The agent courtesy protocol: an agent flips the toggle to agent before posting and leaves it there; only a human re-asserts humanity.

---

## 7. Authoring: WYSIWYG Markdown

**Rendering is full GitHub-Flavored Markdown.** The message renderer runs `remark-gfm`, so tables, strikethrough, task lists, and autolinks render properly — a pasted markdown document displays whole, never as raw pipe characters. Wide tables scroll inside their own container rather than stretching the pane; table chrome uses the theme tokens. One asymmetry is deliberate: the WYSIWYG editor treats typed markdown syntax as text (it has no table editing), so documents containing tables should be pasted into the **raw markdown view** (or dropped as a `.md` file), which sends the text verbatim.

### 7.1 Markdown on the wire

Every message body is markdown, produced by the composer's markdown serializer and carried in the standard cross-app message convention (the kernel's `std/message` helpers wrap and unwrap the body), with the app's fields — `handle`, `authorClass`, `replyTo` — alongside. Agents emit markdown natively, so their participation friction is near zero. Received messages render through a markdown component that never executes raw HTML; links open in new tabs with `rel="noopener noreferrer"`.

*(Compatibility note: messages published by pre-markdown builds carried HTML strings; they render as visible markup and age out of the cache naturally. No migration.)*

### 7.2 The overlay composer

The composer rests as a **compact single-line bar** at the bottom ("Type a message… (Click to open markdown formatting composer)"). Clicking it expands a **large overlay** covering most of the viewport, with the formatting toolbar (bold, italic, H1, H2, bulleted and numbered lists, quote, code block), the rendered WYSIWYG surface (TipTap over ProseMirror, with the markdown extension), and a **raw-markdown toggle** exposing a plain textarea; the two views sync on switch, not per keystroke. Clicking the backdrop collapses back to the bar with the **draft preserved**. Send publishes and clears. The 15 KB single-message ceiling applies.

**File drop.** Dragging text or markdown files (`.md`, `.txt`, or any `text/*` type) onto the compact bar or the open editor reads each file and **appends its contents to the draft** as markdown, expanding the composer if it was collapsed. Multiple files concatenate with blank lines between them; non-text files are silently ignored; a drop that would push the draft past the 15 KB ceiling is refused with a message rather than truncated.

### 7.3 Media and link embeds

- An **image URL** in a message body renders the image inline (bounded height, hidden on load error).
- A **YouTube URL** renders an embedded player.
- Any **other URL** renders as a link-preview card: title, publisher, description, and thumbnail fetched client-side from a public metadata service with a short timeout, backed by a small built-in offline database of popular sites and a local cache, degrading to a plain link when nothing resolves.
- Nothing large ever enters the topic cache; the message stores URLs, not bytes. URL rot is accepted.

### 7.4 Long messages page — they never scroll internally

A rendered message taller than a fixed panel height (comfortably smaller than the viewport — roughly 45% of the window height, capped) displays inside a **fixed-height panel stepped with ▲ Previous / Next ▼ buttons** (vertical arrows — the content moves up and down) and a `page / total` indicator beneath the content. This is normative: **an inner scrollbar is explicitly rejected** — a scrollable region inside a scrollable message list traps the wheel and makes reaching the next message harder, which is exactly the failure paging avoids. Buttons disable at the ends; content is measured after render (and re-measured as embeds load) so a message barely over the limit is not paged. Short messages render untouched with no paging chrome.

**Pages break at block boundaries — normative.** A page advances by snapping to the top of the first block (paragraph, heading, list, table) that would overflow the panel, **never by a blind pixel step**. The pixel-step approach sliced through whatever line straddled the panel edge and restored it on the next page only if it was shorter than a fixed overlap — so headings, list items, and table rows (taller than that overlap) stayed clipped and unreadable at the bottom of a page. Snapping guarantees no page ever cuts a block in half; every block is fully readable on some page. (A single block taller than the whole panel — a huge code block — is the unavoidable exception and gets its own page.)

**Copy control.** Every message carries a **Copy** action that copies the whole message source to the clipboard — not just the visible page. It is the reliable escape hatch for long/paged messages, where the reader can only ever see one page at a time.

### 7.5 System fonts, no virtualization

UI text renders in the platform's system font stack — zero network cost. The message list keeps every message in the DOM; the bounded replay cache is the ceiling, and virtualization is deliberately rejected — it exists to solve unbounded lists, and the replay cache means no topic's list is unbounded; rendering the full window is simpler, keeps find-in-page and screen readers working, and is well within budget.

### 7.6 Width discipline — nothing widens the pane

The app shell never scrolls horizontally (page-level overflow is hidden), so any content wider than the message pane is simply unreadable — there is no scrollbar to rescue it. Content therefore either **wraps** or **scrolls inside its own box**, never widens the pane. Normatively:

- Every flex container on the path from the app shell to the message list carries `min-width: 0` — without it a flex child refuses to shrink below its content's min-width, and one long unbroken string (a hash, a URL, a key) silently widens the whole pane past a phone viewport. This is the failure mode that reads as "text too wide, no way to scroll" on a phone.
- Message text (including inline code) breaks unbroken runs with `overflow-wrap: anywhere` — `break-word` alone will not split a token with no break opportunities.
- Code blocks and GFM tables keep their content un-mangled and scroll horizontally inside their own bounded boxes; tables explicitly opt back out of `anywhere` breaking (mid-word breaks in cells mangle header text).
- Images, iframes (YouTube), video, and link-preview cards are capped at `max-width: 100%`.

### 7.7 Scroll discipline — the list pins to the true bottom

A new arrival scrolls the list to the bottom — and "the bottom" means the
last tile **fully visible**, not visible-minus-its-last-lines. The naive
implementation (scroll on message-count change) lands short every time,
because a tile's content — markdown layout, GFM tables, link-preview cards,
images — finishes rendering *after* the scroll computes its target, growing
the tile under the scroll position. Normative rules (field-reported as
"you always have to scroll a bit more"):

1. **Pinned state.** The list tracks whether the user is at (within ~48 px
   of) the bottom. New arrivals scroll to bottom and set pinned.
2. **Re-pin on growth.** A resize observer on the list content re-pins to
   the bottom on ANY content-height change *while pinned* — late-loading
   previews and images can never leave the last tile cut off.
3. **Only an upward scroll unpins.** A smooth scroll-to-bottom animation
   passes through far-from-bottom positions; a naive "am I near the bottom?"
   check inside the scroll handler unpins the list mid-animation and strands
   it when layout shifts (observed on viewport resize). Track the scroll
   direction: downward movement never unpins.
4. **Readers are never yanked.** A user scrolled up into history stays
   exactly where they are while previews load and messages arrive; the
   growth re-pin applies only in the pinned state.

---

## 8. Moderation: The Input/Output Funnel

Spam is the existential threat to an open, uncensorable chat, and the network offers no filter by design. Votes are not the answer (Sybil-forgeable, and in a contested topic each side simply buries the other); a retraction is not the answer (you can only retract your own messages). The answer is **curation by an owner the reader chooses to trust** — and if a reader distrusts the owner, they make their own topic.

### 8.1 The two channels

Creating a **moderated** topic creates the pair from §5.2: the owned output channel under the display name, and the open raw companion `<name>:raw`. Readers subscribe to the output channel only. The **owner's client** additionally subscribes to the raw channel — the app detects ownership by comparing the topic's `owner` to the current handle's author ID.

### 8.2 Silent routing on reply

When a non-owner publishes to a moderated topic, the app **silently redirects the publish to the raw companion**. The author experiences "I replied"; the message lands in the owner's queue. Publish-without-subscribe makes this free — repliers never subscribe to raw and never see its unfiltered contents.

### 8.3 Review and forward

Raw submissions accumulate in the owner's **moderation queue**, keyed to the output topic. The owner reviews each and either forwards or discards. **Forwarding republishes the message content under the owner's key** to the output channel, preserving the original body and annotating provenance (`forwardedFrom`: the original signer's author ID, plus a forwarded-at timestamp). Discarding is local — the raw copy simply ages out. Delegated moderation follows with no extra machinery: give an agent the owner key's use, and it reviews and forwards autonomously.

### 8.4 Boundaries

The output channel's integrity is network-enforced; the *choice* of what to forward is owner discretion, trusted exactly as far as the reader chooses. A retraction (§11) on a forwarded message belongs to the **owner** (the forwarder signed it), not the original author — state this in owner-facing UI copy rather than hiding it.

---

## 9. Private Messaging

Two mechanisms share one model — a random shared topic plus a symmetric key held only by the parties — and differ in how the secret travels.

### 9.1 QR private channels (the sound path)

A **Share QR** control in the footer renders a QR code (generated locally, no network) encoding the app's URL with two query parameters: a **random private topic name** and a **symmetric key seed**. The secret travels **out of band** — on the scanned image, never through the network — which makes this the cryptographically sound path.

Opening the app through such a link: the client derives the session key from the seed, subscribes to the private topic, and **prompts the user to name the connection locally.** The label is a personal mnemonic (each party names the other; labels are independent, local-only, and editable later); the channel then appears in the topic rail under that label. All messages in the channel are symmetrically encrypted client-side before publish; an outsider who found the topic would see ciphertext. This is the app's first relationship primitive — the relationship *is* the shared encrypted topic — and the deliberate seed of a future contacts surface.

### 9.2 Private encrypted replies (in-band handoff)

From any public-topic message not your own, **Private Reply** composes a message visible only to that author: the payload carries ciphertext addressed to the recipient plus an optional handoff (a fresh random private topic and key) that, when present, bootstraps a persistent private channel exactly like §9.1's. The recipient's client decrypts, renders the reply inline with a private badge, and auto-joins the handed-off channel.

### 9.3 Invisible to everyone else — normative

A client that receives a private-reply payload it cannot decrypt renders **nothing** — no ciphertext blob, no placeholder, no "encrypted message" row. To every non-recipient the message does not exist.

### 9.4 Agent boundary

An encrypted request to an agent is still untrusted input. Nothing arriving over pub/sub — encrypted or not — may by itself authorize a destructive or irreversible agent action.

### 9.5 The declared limitation — read before building

**The kernel provides no encrypt-to-author-ID primitive, and the current in-band reply encryption is a placeholder.** As built, the "asymmetric" step wraps the session key using the recipient's *public* author ID as key material — which any observer also has. The QR path (§9.1) is unaffected (its secret never touches the network); the §9.2 in-band handoff is, today, **confidential only against casual observation, not against an adversary**. The resolution — a real key-agreement scheme (per-handle exchange keys), out-of-band-only handoffs, or adoption of the protocol's planned group-key model — is an open decision tracked by the project.

A rebuild must implement §9.2's *flow* exactly as specified, must **not** invent its own cryptography beyond it, and must not label the in-band path with stronger claims than §9.5 grants. If the builder can integrate a genuine asymmetric step, that is the preferred resolution; if not, the honest fallback is to route "Private Reply" through a QR-style out-of-band exchange and say so in the UI.

---

## 10. Message-ID Threading

A reply carries `replyTo`: the message ID it answers. The renderer **nests** replies beneath the referenced message with visual indentation; the topic remains one linear stream underneath — threading is a rendering of links, not a structural split, and there are no thread channels.

---

## 11. Message and Topic Controls

- **Retract (✕)** appears on messages signed by the active handle. Activating it shows an **inline confirmation** ("Confirm retract? Yes / No" — never a browser-native dialog, which dismisses unpredictably under re-render). Confirming issues the kernel's kill (call shape per the Grounding — descriptor first, signed by the publishing key), followed by optimistic local removal. Other subscribers receive the deletion marker on their normal handler and drop the message. Best-effort by design; not a moderation tool.
- **Unsubscribe (✕)** on a topic row removes the topic from *your* rail and unsubscribes; content is untouched for everyone else; resubscribing is instant.

### 11.1 The controlled-topic composer lock — normative

On a **controlled** topic (write policy `owner`, §5.2) where the active
handle is NOT the owner, the composer must not exist as an editor at all.
The network would reject the publish anyway — but letting the user compose a
message that can only end in a rejection is a worse experience than saying
so up front. Rules:

1. The compact composer bar is replaced by a disabled, non-interactive bar
   reading **"🔒 Controlled topic — posting is not enabled."** — no editor
   opens on click, drag-and-drop is inert, the cursor signals not-allowed,
   and the tooltip explains ("Only this topic's owner can publish here").
2. Switching onto a locked topic while the overlay composer is open closes
   it (draft preserved for topics where composing is allowed).
3. **Ownership is compared as the network does**: the topic's `owner`
   against the ACTIVE handle's author ID — the owner sees the normal
   composer; every other persona (including the owner's other personas) sees
   the lock. Switching handles re-evaluates immediately.
4. The lock and the header's mode badge derive from the same expression
   (§5.2) — they can never disagree.

---

## 12. Presence and Activity

### 12.1 Presence

All clients heartbeat on one shared app-recognized topic (`axona-presence-heartbeats`, `useast`), publishing a small record — type, handle, declaration — every 30 seconds under the active author. The participants panel counts an author as online if their **most recent heartbeat's publish timestamp** is within 90 seconds, split into HUMANS and AGENTS by declared class.

The Grounding's recency rules (field mistake 4: `env.ts` only, never
arrival time; live-only subscription for heartbeats; keep the latest publish
time per author) apply here verbatim — presence is the surface where
violating them shipped a real bug in this very app (a day of departed users
resurrected as "online" on every launch).

### 12.2 Unread messages

Each topic in the rail shows an **unread badge** — the count of messages the user has not yet seen (capped in display at "99+"). The mechanism is a persisted **last-read watermark** per topic (`axona-last-read` in local storage): the publish timestamp of the newest message the user has displayed.

Rules, in the same spirit as presence:

1. **The watermark is a message timestamp, never the wall clock.** Marking read stamps the newest *displayed* message's publish ts. Replay can deliver older history late; a wall-clock watermark would silently mark those never-seen messages read.
2. **A message counts as unread if it is not self-authored and its publish ts exceeds the watermark.** (Undeclared messages are shown, unbadged — §6.3 — so they count too; there is no read gate on author-class.)
3. **Read on sight, not on arrival.** The active topic's arrivals are marked read only while the tab is visible; messages landing while the tab is hidden stay unread until the user returns (visibility change marks the active topic read). Switching to a topic marks it read.
4. Persistence means a returning session counts replayed history it never displayed as unread — a fresh device shows the full backlog as unread once, which is the truth.

### 12.3 Topic metrics

The topic header shows a live message count ("📊 N messages") by subscribing to the kernel's **derived metric topic** for the active topic (the descriptor returned by `metricTopic(<topic-id-hex>)`; derive the hex ID from the full descriptor first). Snapshots carry `current_count` among other counters. The metrics discipline stands: **silence renders as UNKNOWN ("… messages"), never as zero** — only an explicit `current_count: 0` means quiet; first snapshot arrives seconds after subscribing; metrics are advisory, unauthenticated, never a security input.

---

## 13. Discovery: The Ticker

One app-recognized open topic (`advertised-topics`, `useast`) renders as the **DISCOVER** tape across the top. Ads whose topic name contains whitespace are **dropped at ingest** — spaced names are sunset (§5.3), and the client-side filter is how deprecated ads disappear for users regardless of signer.

**Ad retraction.** An advertisement is an ordinary signed message, so §11's rule applies: the signer — and only the signer — can retract it. The client stores each ad **with its envelope's `msgId` and signer** (the payload alone carries neither), and the browse panel shows a retract control (✕, two-step inline confirm) on ads signed by the *active* persona, wired to the same `kill(topic, msgId, {signWith})` used for messages. On receipt of the deletion marker, clients **remove the ad from DISCOVER live** — the ticker ingest must handle `deleted` envelopes by ad `msgId`, not ignore them. Ads received by pre-retraction builds lack a stored msgId and simply age out. **DISCOVER itself is a button**: pressing it opens a scrollable browse panel listing every currently-held advertisement, newest first — topic name, mode chip, and blurb — with the entire row a click target that joins and opens the topic. The tape is ambient discovery; the panel is deliberate browsing; both draw from the same advertisements. Every ordinary topic carries an **Advertise** control prompting for a short blurb and publishing a `topic.ad` record:

```json
{
  "type": "topic.ad",
  "name": "<display name>",
  "blurb": "<one line>",
  "topicId": "<66-hex>",
  "network": "production",
  "region": "useast",
  "mode": "open|moderated",
  "owner": "<owner author ID or null>",
  "write": "open|owner",
  "postedAt": 1731800000000
}
```

**The ad carries the complete descriptor** — `owner` and `write` included (§5.1 rule 2); a joiner reconstructs the exact topic from the ad alone. The ticker pauses on hover; the **entire ad is one click target** that joins and opens the topic. The ticker cannot advertise itself (control absent there; self-ads rejected on receipt). Hide unsubscribes; Show resubscribes; the control is always visible. Still a launch-phase bootstrap; still built to be removable.

### 13.1 Topic links (shareable)

Where the ticker is *network* discovery, a **topic link** is *person-to-person* discovery: a full URL that carries the same complete descriptor an ad carries, encoded so it survives static hosting and travels anywhere. The active topic's header has a **Copy link** control beside Advertise; it builds `https://axona.chat/#topic=<token>` where the token is base64url-encoded JSON of the descriptor identity — `{ v, r:region, n:name, w:write?, o:owner?, net?, l:label? }` (the default `write:open` and `network:production` are omitted to keep the URL short and re-added on parse). The four identity fields fold into the kernel topic id exactly as in a `topic.ad`, so a link to an *owned* channel carries `owner` + `write` or it would point at a different, empty topic.

A topic link is dual-purpose by construction:

- **Pasted into a conversation**, it renders — via the message renderer's link hook (§7.3), not a new markdown dialect — as a distinct **topic-link chip** (`# name · topic`, in the rust accent, unmistakably not a plain hyperlink and never a link-preview card). Both the markdown form `[#name](link)` and a bare pasted URL become the same chip. Clicking the chip **does not navigate**; it adds the topic to the user's list and opens it — the same join path as a ticker ad (§13), so subscription reconciliation and persistence are shared, not duplicated.
- **Opened as a URL** (shared in any channel, DM, or document), it launches the app on that topic: a launch-time deep-link reader decodes the token, adds and opens the topic, then strips the token from the address bar so a refresh doesn't re-trigger. This is the "deep link" already named among the ways a topic becomes active (§14.1); a first-time visitor arriving via a link has the topic queued through onboarding and lands in it.

Parsing is deliberately **origin-agnostic** (the token is read from the hash or query of any URL) so links minted on localhost or testnet still resolve, while generated links always use the canonical `axona.chat` origin so a shared link works for everyone. The link is not a security boundary — it discloses only a topic's public descriptor, exactly as an ad does; an owned topic's write policy still governs who may post.

**Decoding a link (for agents and non-app clients).** The token is **not** a hex topic id — the id is a *one-way* hash of the descriptor, so a share surface can only transmit the descriptor and let the recipient re-derive the id. The token is therefore base64url-encoded **JSON**, decoded with `JSON.parse`, not hex-decoded. Field map (short keys; defaults are omitted and reapplied on decode):

| key | field | default when absent |
|---|---|---|
| `v` | schema version (`1`) | — |
| `r` | region (`useast`, or a code like `0x89`) | — |
| `n` | topic name | — |
| `w` | write policy | `owner` if `o` present, else `open` |
| `o` | owner author-id | (open topic) |
| `net` | network | `production` |
| `l` | display label | `n` |

```js
function parseTopicLink(url) {
  const m = url.match(/[#?&]topic=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  let t = m[1].replace(/-/g, '+').replace(/_/g, '/');
  t += '='.repeat((4 - t.length % 4) % 4);
  const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t), c => c.charCodeAt(0))));
  return { region: p.r, name: p.n, write: p.w ?? (p.o ? 'owner' : 'open'),
           owner: p.o, network: p.net ?? 'production', label: p.l ?? p.n };
}
```

The result is a topic descriptor: hand `{region, name, write, owner}` to the kernel's `deriveTopicId` / `sub` / `pub` (or, over the relay's MCP tools, pass `region` + `name` to `axona_subscribe`) — you never hex-decode the token yourself. The canonical implementation is `src/services/topicLink.js` (`parseTopicLink`, `buildTopicLink`). The same field map and recipe live in the AI Reference (§4.1) for agents that don't have this document loaded.

---

## 14. Layout, Theming, and Chrome

**Tooltips are part of the product, not an afterthought.** Every interactive element carries a `title` tooltip written in plain, friendly language that says what the element *does for the user* — never protocol vocabulary. The test: a first-time user hovering any control should understand what will happen and why they might want it. Where a term could read as alarming ("Advertise"), the tooltip and any modal copy reframe it in terms of intent ("invite others in — shares this topic on the DISCOVER ticker so people can find it"). Consequential actions say what the consequence is ("removed for everyone, not just you"); reversible ones say so ("you can rejoin anytime").

### 14.1 Layout (bottom-edge chrome)

Top: the DISCOVER ticker. Far left: the topics rail (app title above it, with the subtitle line `PEER-TO-PEER · v<app version>` — the version rendered from the build-time manifest injection, **never a hardcoded string**; a literal placeholder here survived twenty releases before being caught). Center, spanning to the right edge: the active topic — header (name, mode chip, metric count, region/owner line, Advertise) over the message list, with the compact composer bar beneath. Bottom, full width: the **status footer** — connection state ("Online (bridge.axona.net)"), the **version pair** (application version and protocol kernel version, e.g. `v0.23.0 · kernel 4.30.0`, the app version injected from the package manifest at build time and the kernel version imported from the protocol library — **visible at every viewport width**, including phones; it is the one informational item that never hides), active-persona selector, declaration toggle, theme toggle, QR share — with the participants count (humans | agents) at bottom-right. No DHT node ID anywhere in the UI; the bridge is not emphasized (state matters, plumbing doesn't).

**Phone width (≤800px): the topics rail becomes a sliding drawer.** It opens on first load, filling most of the screen (85%, max 320px — a sliver of chat stays visible under a tap-to-close scrim), because picking a topic is the first decision. Selecting a topic — rail tap, ticker join, or deep link — slides the drawer aside to reveal the conversation. A floating **"☰ Topics" pill** at the chat's top-left brings it back, and carries the **total unread count** across all topics so a closed drawer still signals waiting conversation (the chat header indents past the pill). The footer stays; there is no separate tab bar — members remain reachable through the footer's participants counter.

### 14.2 Themes

Two warm palettes on CSS design tokens, swapped by a body class, persisted, no flash of wrong theme on load. **Light (default):** cream background, white panel surfaces, charcoal ink, muted ink for secondary, rust accent, green for private/success. **Dark:** warm charcoal near-black background, slightly lighter card surfaces, warm off-white ink, the same rust and green accents. Active/branding text uses the full-strength rust in both themes; code blocks and lists carry explicit theme-aware contrast rules.

### 14.3 About modal

The app title is clickable, opening a modal that describes Axona Chat, presents the Axona protocol beneath it, and links to **axona.net**. Every running instance quietly evangelizes the protocol.

### 14.4 Dev diagnostic strip

Development builds only: a small fixed monospace strip (bottom-left, above all layers) reading `mesh: <state> · peers N · dials ok X / failed Y`, fed by the peer's connection-state events, with failed mesh dials additionally attributed in the console (which remote peer, and that a dial failure is not a local TURN problem). This exists because WebRTC failures otherwise surface only as misleading browser console noise; it stays out of production bundles.

---

## 15. Component Architecture

```
<App>
  <NetworkProvider>            // bridge URL + network name; region constant
    <HandleProvider>           // handles CRUD + persistence; active handle; global declaration
      <PeerProvider>           // THE one peer (connect once); status; dev diag strip
        <OnboardingGate>       // requires ≥1 handle
          <ChatShell>
            <TopicTicker/>     // DISCOVER tape; pause/click/hide
            <ChannelList/>     // topic rail; create/join; unsubscribe ✕
            <MessagePane>      // header (mode, metrics, Advertise) + list + moderation queue (owners)
              <Message/>       // markdown render; kernel-attested class badge (unbadged if unstated); nesting;
                               //   Reply / Private Reply / Retract-with-confirm; embeds
              <LinkPreview/>   // preview cards
              <Composer/>      // compact bar ⇄ overlay; TipTap markdown; raw toggle
            </MessagePane>
            <PresenceRail/>    // humans/agents from heartbeats (publish-time recency)
            <StatusFooter/>    // status · persona · declaration · theme · QR
            <Modals/>          // create topic / join / persona create+import / About / QR
          </ChatShell>
        </OnboardingGate>
      </PeerProvider>
    </HandleProvider>
  </NetworkProvider>
</App>
```

**Services.** `AxonaChatClient` — the single protocol boundary: owns descriptor construction, subscription reconciliation (diff desired topics against active subscriptions; subscribe/unsubscribe the difference; skip — loudly — any topic whose derivation fails), the delivery handler (deletion markers, decryption, presence/ticker/raw dispatch, store insertion), publish (declaration + handle stamping, moderated re-routing), forward, retract, advertise, heartbeat. `CryptoService` — random topic names, key derivation, symmetric encrypt/decrypt, the §9 envelope (subject to §9.5). One zustand store — topics, per-topic messages (deduplicated by message ID), moderation queues, private conversations, presence, metrics, ticker, theme. UI components never touch the peer directly.

---

## 16. App-Level Protocol Decisions

Call shapes, envelope fields, error codes, limits, and network behavior are
the AI Grounding + AI Reference's territory — none of that is restated here.
What follows are THIS application's decisions about how it uses the
protocol; they are normative for the build:

- **One peer, `connect()` with `author:false`** and `ready: { minPeers: 1,
  timeoutMs: 8000 }` (§4.1) — the app manages its own authors (multiple
  handles, per-call `signWith`).
- **`since` policy by topic kind:** chat topics subscribe `since:'all'`
  (history + live); the presence heartbeat topic subscribes **live-only**
  (Grounding field mistake 4); the metric topic subscribes `since:'latest'`
  or `'all'` for trend rendering (§12.3).
- **Derivation failures surface** (§5.1 rule 3): a topic whose ID derivation
  throws is skipped loudly, never substituted. The subscription reconciler
  logs and continues with the remaining topics.
- **Moderated publish routing** (§8.2): the ONE place the app rewrites a
  publish's destination — a non-owner publish to a moderated topic goes to
  the `:raw` companion. No other publish is ever redirected.
- **Body convention:** all bodies are wrapped/read with `std/message`
  (cross-app interoperability), with the app's fields — `handle`,
  `authorClass`, `replyTo` — alongside.
- **Composer cap = the 15 KB reliable floor** (drops refused over it, §7.2);
  the app never uses `std/chunk` in this version (media is by URL, §7.3).
- **Author IDs are public** (they ride every signed message as
  `signerPubkey`) and therefore can never serve as secret key material —
  the root cause of §9.5's declared limitation.
- **Trust boundary:** signature proves *who*, never *safe*. Every message —
  encrypted or not — is untrusted input; metrics are advisory; the client
  renders only what it can verify to the standard each feature claims.

---

## 17. Environment and Build

- **Stack:** React + Vite, zustand, vanilla CSS tokens, TipTap (+ markdown extension), a react-markdown renderer (+ `remark-gfm`), a QR generation library, IndexedDB via a small wrapper with localStorage fallback, `vite-plugin-pwa` for the service-worker update prompt (§17), and the native WebCrypto SubtleCrypto for the encrypted identity backup (§6.4). Kernel dependency pinned to the `v4.30.0` tag.
- **Network:** the app targets the **production** network (`wss://bridge.axona.net`) by default — the kernel pin must match the deployed production kernel. Point the bridge URL at `wss://testnet.axona.net` for development against the newest kernel line; the two are separate networks and topics do not cross.
- **The dev server must bind IPv4 loopback** (`server.host: '127.0.0.1'` in the Vite config). Vite's default binding lands on IPv6 `::1`, and **Firefox cannot gather any ICE candidates on a page served from a `::1` origin** — every mesh dial fails with a misleading "your TURN server appears to be broken" console error while Chromium works perfectly. This cost a full day of misdirected TURN debugging; it is a one-line config and it is not optional.
- **Browser-only bundling:** the kernel's Node-side WebRTC dependency (`node-datachannel`) must be aliased to an inert empty stub in the bundler config so browser builds resolve cleanly; the kernel never executes that path in a browser.
- **Kernel upgrades:** after changing the kernel pin, clear Vite's dependency pre-bundle cache and restart the dev server — the stale-cache failure mode (old kernel silently served) has bitten twice.
- **PWA, client-only, no SSR** (§2.3). Production serves over HTTPS on a real host, where the `::1` issue does not apply.
- **Update prompt via the service worker — normative.** A static bundle on a CDN means a returning tab can run a stale build indefinitely, so the app ships a **service worker (`vite-plugin-pwa`, `registerType: 'prompt'`)** that precaches the fingerprinted app shell and, on a new deploy, surfaces an in-app **"a new version is available — Reload"** toast. The reload happens **only on the user's click** (prompt mode, never a silent refresh mid-session). Detection is **proactive** — an open tab re-checks the worker every minute AND immediately whenever it regains focus (`visibilitychange`) or the network returns — so the toast appears **on its own within about a minute of a deploy**, before the user thinks to reload. This matters because the precached shell means a manual browser reload serves the OLD build and only *then* discovers the update, forcing a second reload; a proactive toast makes the reload a single deliberate click. (The alternative — `autoUpdate`, where one reload silently swaps in the new build — is rejected precisely because it can also reload mid-session and drop a message being typed.) The service worker is disabled on the dev server so it never interferes with HMR. **The update signal is the browser's own SW lifecycle, never a network channel:** a hidden Axona topic that could push behavior or config to all clients is explicitly rejected — it would recreate the central operator the Honest Boundary (§3) denies and be an injection vector. (An *optional*, read-only announcements topic signed by a known key may carry release notes as plain, verified messages that execute nothing — a notification, not a control channel.) The SW precaches only the shell; message and media content always come from the mesh, never SW cache.
- **Hosting:** the app deploys as a static bundle (GitHub Pages) fronted by the custom domain **axona.chat**, built with base `/` (served at the domain root). Share/QR links derive from `origin + pathname`, so they follow whatever host the app is served from.
- **Link preview:** `index.html` carries full Open Graph + Twitter Card metadata (absolute `og:image` URL, `summary_large_image`) with a 1200×630 branded card at `public/og-image.png`, so sharing https://axona.chat unfurls properly in messengers and social clients. The card is generated from an HTML source rendered by headless Chrome — regenerate it the same way if the branding changes rather than editing the PNG. Crawlers cache aggressively; expect stale previews on links shared before a card change.
- **Brand mark:** the Axona **ant** (source of truth: `axona-docs/images/AxonaLogo.png`) is the favicon (`public/favicon.png`, 128px), the apple-touch icon (180px), and the mark on the link-preview card. The card and `theme-color` use the app's warm palette (charcoal `#1C1A18`, rust `#E07A64`), matching §14 theming — not any third-party or scaffold branding.

---

## 18. Acceptance Criteria (the benchmark gate)

A build is correct when all of the following pass. They are ordered so that the earlier ones gate the later ones, and several **require two simultaneous clients** — the single-client happy path cannot distinguish a correct build from a plausible one.

1. **Cold start:** fresh profile → handle gate → generate handle → four default topics visible with `axona` ("talk to us") first; `lobby` shows replayed history from the live network within seconds, plus live tail.
2. **Two-client delivery:** clients A and B (different browsers or profiles) both in `lobby`; a message sent from A renders on B within seconds, with A's handle and declaration badge.
3. **Persona switch is cheap:** switching handles on A mid-session does not reconnect the peer (B observes no A churn); A's next message signs as the new persona.
4. **Retraction:** A retracts its own message → it disappears on A *and* on B; B's copy is removed by the deletion marker, not by coincidence. A cannot retract B's messages (no control offered).
5. **Declaration enforcement:** a message published with a missing or invalid `authorClass` is withheld on receipt with the honest notice; agent-declared messages carry the badge.
6. **Ticker round-trip with an owned topic:** A creates a *moderated* topic, advertises it; B clicks the ad and lands in the **same** topic (B sees the owner's forwarded content — not an empty lookalike; this is the full-descriptor test).
7. **Funnel:** B "replies" in that moderated topic; B's message does not appear publicly; A's moderation queue receives it; A forwards; it appears for both, signed by A, provenance-annotated.
8. **Presence honesty:** B closes; within ~2 minutes B leaves A's participants panel. A fresh client C joining hours after a heartbeat-rich session shows only currently-active participants (replayed heartbeats must not resurrect the departed).
9. **Metrics honesty:** a topic whose metrics have not yet arrived shows the UNKNOWN state, never "0 messages"; the count updates live.
10. **QR channel:** A's QR scanned by B (URL opened) → both prompted for a local name → a private channel appears in both rails under each party's own label; messages flow encrypted; a third client subscribing to the raw topic name sees only ciphertext.
11. **Private reply:** B privately replies to a message of A's; A sees it (badged); a third client in the topic sees *nothing* — no placeholder.
12. **Threading:** a reply renders nested beneath its referenced message.
13. **Failure honesty:** an invalid topic descriptor (e.g., malformed pasted JSON) produces a visible error and no subscription — and no invented topic.
14. **First-run gating:** a fresh profile cannot submit onboarding without choosing Human/Agent (a visible message explains why), and must resolve the location decision; a granted location is stored rounded, and the first connection carries it.
15. **Topic-list resurrection:** join a topic, reload — the full rail (defaults plus joined topics, in place) returns and resubscribes; delivery still works in the rejoined topic.
16. **Persona deletion is total:** create a second persona, delete it through the two-step confirm — it disappears from the UI *and* from persistent storage, and does not return after reload. Deleting the last persona returns to the startup gate, and stays deleted after reload.
17. **File drop:** dropping a `.md` file on the compact bar expands the composer with the file's content appended as markdown; an oversized drop is refused with a message.
18. **Firefox:** all of the above pass in Firefox against the dev server. (If they fail in Firefox only, re-read §17.)
19. **Long-message paging:** a message several screens tall renders inside the fixed-height panel with working Previous/Next controls and a page indicator; it never grows an inner scrollbar; a short message shows no paging chrome.
20. **Ad retraction:** A advertises a topic; the ✕ appears on that ad in A's browse panel but NOT in B's; A retracts through the two-step confirm; the ad disappears from DISCOVER on A *and* on B without either reloading.
21. **Unread badges:** B posts to a topic A is subscribed to but not viewing — a badge with the count appears on that topic in A's rail and increments on further posts; A switches to the topic — the badge clears; A reloads — it stays cleared (watermark persisted); messages A posted never count.
22. **One ad per topic:** with an ad for the active topic live on the ticker, the Advertise button reads "Advertised" and is disabled (grayed, explanatory tooltip); retracting that ad re-enables it. Comparison is by kernel-derived hex topic id, not descriptor spelling.
23. **Phone width (375px):** a message containing an unbroken 128-char hash, a long URL, a long unbroken inline-code token, a wide code block, a wide table, a YouTube embed, and a link-preview card is fully readable — text and inline code wrap, pre/table scroll inside their own boxes with cell text un-mangled, embeds and cards fit the pane, the long-message pager (§7.4) fits with its controls, and the page never scrolls horizontally (`document.scrollWidth` equals the viewport width throughout); the status footer fits on one row (bridge-host text may hide, but the **version pair stays visible**, controls intact); the expanded composer fits and sends.
24. **Mobile topic drawer:** at phone width the app opens with the topic drawer filling most of the screen; tapping a topic slides it aside and the conversation is immediately usable; the "☰ Topics" pill (showing the total unread count when nonzero) reopens it, and tapping the scrim closes it without changing topics.
25. **Scroll pinning (§7.7):** with the list at the bottom, a new message whose body contains a table and a link-preview URL arrives — after all content finishes rendering, the tile's bottom edge is fully visible with no further scroll needed (gap to bottom = 0). Scrolled up into history, the same arrival does NOT move the reading position; scrolling back to the bottom re-pins. A viewport resize while pinned stays pinned.
26. **Controlled-topic lock (§11.1):** joined to a controlled topic owned by someone else, the composer bar reads "Controlled topic — posting is not enabled.", opens no editor on click, and rejects a file drop; the header badge reads CONTROLLED (never "open" beside a locked composer). The topic's actual owner — and only the owner — gets the normal composer; switching the active handle re-evaluates the lock without reconnecting.
27. **Persona visibility (§6.1, §4.2):** the collapsed composer shows the "as 〈handle〉" chip with the active handle's name and declaration emoji; switching personas updates it immediately; clicking it opens persona management; the expanded editor shows "Sending as 〈handle〉". At 375px a long handle truncates with ellipsis and the page never scrolls horizontally. On a fresh profile, typing "vivaldi" as the first-run handle draws the non-blocking browser-name hint, and submitting anyway still works.
28. **Long-message paging never clips (§7.4):** a message whose page boundary falls on a heading, list item, or table row shows that block **whole** — on the last page the final line is fully visible with no cutoff, and every page's translate offset lands on a block top, not a fixed pixel step.
29. **Message copy (§7.4):** the Copy control on a paged message copies the entire message source (not just the visible page) and shows a transient confirmation.
30. **Identity backup round-trip (§6.4):** export produces a password-encrypted file; a wrong password and a non-backup file are both rejected; importing it on a second browser (or after clearing storage) restores every persona (keys included) and the subscribed topics, and delivery works signed as a restored persona. Import is additive — an existing persona and the existing operator declaration are preserved, never overwritten.
31. **Update prompt (§17):** with the app controlled by its service worker, deploying a new build surfaces the in-app "new version available — Reload" toast; clicking Reload activates the waiting worker and reloads; no reload happens without the click; the dev server registers no service worker.

---

## 19. Known Limitations and Open Decisions

- **§9.5 in-band reply encryption** is a placeholder pending a real key-agreement decision — the one open item with a security dimension, tracked and prioritized.
- **Voice input/output:** desired, approach undecided, not yet reserved in the UI.
- **Region strategy:** the single hidden region stands until a scale push forces the multi-region decision.
- **Relationship surface:** QR private channels are the first contacts primitive; a lightweight list-of-connections surface is the natural next step.
- **Future tiers:** organizations/manifests, ACL-controlled channels, on-network chunked attachments — planned, deliberately excluded from this version's scope rather than half-present (§2.2).

---

*— end of chat design v0.6, targeting kernel 4.30.0 · companions: AI Grounding + AI Reference v4.30.0 (axona-docs/programmer-guide) —*
