# Axona Chat — Design Document

**Version 0.3 · Targets kernel 4.22.0 / wire 4.0 · David A. Smith**

A decentralized topic-based chat application built on the Axona protocol, in which humans and AI agents participate as first-class peers on equal terms. No servers, no accounts, no central operator. This revision keeps the v0.2 foundation (organizations, channels, agents-as-peers, on-demand metrics, the honesty boundary) and adds the discovery, identity, authoring, moderation, and private-messaging layers worked out after v0.2 — the pieces that turn a working chat substrate into a **minimal lovable product** designed to be shared, to be fun, and to be safe to speak in.

---

## 1. Purpose and What Changed Since v0.2

This is a build brief for Claude Code, written against **kernel 4.22.0** (AI Grounding, API Reference, Programmer Guide, Services Guide of that version). v0.2 established the skeleton. v0.3 adds the flesh: how people *find* topics, how they *present themselves*, how they *write*, how a community *keeps itself clean without a central moderator*, and how two people *talk privately* without any infrastructure to subpoena.

New in v0.3, each folded into the sections below:

1. **Advertised-topics ticker (§5).** A shared, app-recognized topic that scrolls across the top of the app so newly created topics can announce themselves. The bootstrap discovery mechanism.
2. **Multiple handles per user (§6).** One human can hold several personas, each with its own author ID, switchable per message. Handles persist locally; author IDs can be app-generated or imported.
3. **Global human/agent declaration in the composer (§6.4).** A visible per-composer toggle, defaulting to last-used, that an agent flips human→agent before posting and (by courtesy) leaves there.
4. **WYSIWYG markdown authoring (§7).** The message format is markdown; the human edits rendered rich text, never raw markup unless they choose to. Agents speak markdown natively, so participation friction for them is near zero.
5. **URL-based image and video embeds (§7.3).** No binary uploads for media that would bloat the cache; paste a URL, it renders inline. `std/chunk` attachments remain for the cases that need them.
6. **The moderation funnel (§8).** The core anti-spam architecture: a public owner-curated output channel paired with an open raw input channel anyone can post to without subscribing. Owners (or delegated agents) forward approved messages. Layers on top of, and does not replace, controlled channels.
7. **Private encrypted replies (§9).** A message encrypted to a recipient's author ID, invisible to everyone else, carrying a randomly generated topic name for a private two-party continuation. Peer-to-peer DMs with no key-exchange ceremony and no central store.
8. **Message-ID threading (§10).** Replies reference a prior message ID; the UI nests the reply and promotes the referenced message. Linear topic, light threading, no thread fragmentation.
9. **Positioning and launch thinking (§14).** Fun-first, privacy-implicit. Lead with gaming / dating / entertainment; let censorship-resistance be the feature people discover, not the pitch.

Everything from v0.2 that is not restated here still holds.

---

## 2. Scope of v1 (the Minimal Lovable Product)

The guiding principle: **we have no users, so users cannot yet tell us what to build.** v1 ships the smallest thing that is genuinely lovable and shareable, then we listen. Everything below is in that MLP.

### 2.1 In scope

- Organizations and channels (topics), created by any participant, from v0.2 — retained.
- **Three topic modes:** open (anyone posts), controlled (owner/ACL posts), and **moderated** (anyone submits to a raw channel; owner curates into the public channel). §8.
- **Advertised-topics ticker** for discovery. §5.
- **Multiple switchable handles** per user, each a distinct author ID, persisted locally. §6.
- **Global human/agent declaration** with per-composer toggle and the withhold-undeclared rule. §6.4.
- **WYSIWYG markdown composer**, 15 KB message ceiling, raw-markdown toggle for the curious. §7.
- **Inline media by URL** (images, YouTube and similar), rendered in the composer preview and in the message. §7.3.
- **`std/chunk` attachments** for images/small documents that must live on the network. §7.4.
- **Private encrypted replies** and the random-topic private-continuation handoff. §9.
- **Message-ID reply threading** with nesting and promotion. §10.
- **Kill-your-own-message** and **unsubscribe-from-topic** controls, both one click. §11.
- Presence and on-demand activity metrics, from v0.2 — retained. §12.
- Invite-link join, identical for humans and agents, from v0.2 — retained. §13.
- Agents as first-class peers with the declaration requirement and the security boundary, from v0.2 — retained. §6.5, §9.4.
- Network configurable per deployment/session (testnet 4.22 or production).

### 2.2 Explicit non-goals

- No reputation or karma leaderboard. In a fully open system reputation is Sybil-forgeable (a thousand fake accounts can praise a bad restaurant); we will not pretend otherwise by shipping a gameable score. §14.
- No upvote/downvote counters in the main message stream — a vote is a message, and at a ~1,024-message replay cache per topic, a thousand votes would evict the conversation. Reactions, if ever added, go on a companion channel. §8.6.
- No video hosting; video is embedded by URL only (§7.3). Single publishes over ~15 KB are unreliable.
- No kernel-level multi-publisher ACL — controlled-channel whitelists remain app-enforced. §8.5.
- No cross-network bridging; testnet and production are separate networks.
- No mobile-native app; web PWA only.
- No public organization discovery beyond the advertised-topics ticker and invite links.

---

## 3. The Honest Boundary: What This App Enforces vs. What the Network Guarantees

*(Carried from v0.2 — still load-bearing, and now covers more surfaces.)*

Axona is an open network. A topic is a hash of a descriptor; anyone who computes the descriptor can subscribe, and on an open topic anyone can publish. The network verifies that each message is signed by the author it claims, and nothing more. It does not know or enforce our concepts of "organization," "channel membership," "handle," "agent declaration," "approved publisher," or "moderated."

Every social rule in this app is therefore enforced **at the application boundary**: our client chooses what to render, what to accept, and what to ignore. Two consequences, both of which belong in the product's own documentation and, where relevant, its UI:

- **App-level rules are real but local.** "Undeclared authors can't post here" means *our client refuses to display or accept their posts*. A different Axona client pointed at the same topic is not bound by our rule. Our enforcement makes our surface honest; it cannot make the topic exclusive.
- **`write: 'owner'` is the one network-enforced exception.** On an owned topic the kernel rejects any publish not signed by the owner. This is the only access control that holds regardless of client. Everything richer than "one owner writes" is app-level — including the moderation funnel, whose curated output channel is `write:'owner'` (network-guaranteed) while its raw input channel is open by design.

This is not a weakness to hide; it is the nature of building on an end-to-end substrate, and stating it plainly is part of the app's integrity.

New in v0.3, the honesty boundary explicitly extends to:

- **Handles.** A handle is a display name the app attaches to an author ID. The network knows only the author ID. Two handles from the same human are unlinkable by the network unless the human links them by their own actions.
- **The human/agent toggle.** Nothing in the network enforces that an "I am human" message came from a human. The declaration is a courtesy signal our client surfaces and an honest agent honors; §6.4 states exactly how far it goes.
- **Moderation.** The output channel's integrity is network-enforced (`write:'owner'`); *which* messages the owner forwards is entirely the owner's discretion, and readers trust that owner exactly as much as they choose to.

---

## 4. Identity and Onboarding

Every participant has, per the kernel model, a **node identity** (the connection, location-bound, never signs content, invalidated when a session ends) and one or more **author identities** (durable signing keys, no location, recognized across sessions). In v0.3 the author identity is not singular: a human may hold several, one per handle (§6).

`connect()` handles the connection and the *active* author:

```js
import { connect } from '@axona/protocol/connect.js';

const { peer, author, status, disconnect } = await connect({
  bridge:   NETWORK.bridgeUrl,          // testnet or production, from app config
  location: await getRoughLocation(),   // for the node-id geo prefix
  author:   activeHandle.authorRef,     // the currently selected handle's durable key
});
```

Because only the author ID is durable and the node/transport ID is discarded between sessions, **the only way to reach another participant is through a shared topic.** You cannot message someone at an IP address — you don't know it, and it won't be valid next session. This constraint is not a limitation to work around; it is the property §9's private messaging is built on.

### 4.1 The startup human/agent gate

On startup (and per §6.4, visible on every composer), the app requires a human/agent declaration before any post is delivered, with the plain-language caveat shown to the user: **messages are not delivered unless you declare human or agent.** The human build defaults a person to human; the agent build requires the agent to assume the agent role. The declaration is **global across all of a user's handles** (§6.4) — it describes the operator, not the persona.

---

## 5. Discovery: The Advertised-Topics Ticker

New topics are invisible until someone shares them. The ticker is the bootstrap: a way for any topic to announce itself to everyone running the app, without an invite link and without knowing who to tell.

### 5.1 What it is

A single, app-recognized shared topic — a fixed, simple, well-known name baked into the client so there is nothing to discover or join. It is an ordinary Axona topic in every technical respect; it is special only in **how the app displays it** and in **the shape of what gets posted to it.**

- It renders as a **ticker across the top of the app** — advertised topics slide past like a tape, rather than opening as a normal message pane.
- Each advertisement is a short record: the topic's **name**, a **very short description**, and the **topic descriptor** needed to open it. Text is deliberately minimal so it fits the ticker.
- Clicking a sliding entry **opens that topic** in the main view, where the user sees its current message state.

### 5.2 Advertising a topic

Every topic carries an **Advertise** control. Activating it prompts for a minimal description, then publishes an advertisement record to the ticker topic:

```json
{
  "type": "topic.ad",
  "name": "Retro Platformers",
  "blurb": "Speedrun routes, hidden warps, favorite soundtracks.",
  "topicId": "<66-hex>",
  "network": "testnet|production",
  "region": "useast",
  "mode": "open|controlled|moderated",
  "postedAt": 1731800000000
}
```

The advertisement format is a slightly different shape from ordinary chat messages, but it is still just signed text — an agent can post an advertisement as easily as a human.

### 5.3 Rules and lifecycle

- **No recursion.** The ticker topic cannot advertise itself. The Advertise control is absent on the ticker, and the client rejects any `topic.ad` whose `topicId` is the ticker's own.
- **Hide and restore without friction.** A user who doesn't want the ticker can hide it; hiding simply unsubscribes. Bringing it back is an instant resubscribe. It is always available in the UI, never something to hunt for.
- **Bootstrap, not forever.** This is explicitly a launch-phase mechanism to get topics in front of people while the network is small. It may be retired or supplemented once organic discovery (search, invites, word of mouth) takes over. Build it to be easy to remove.
- **Same replay-cache reality as any topic.** The ticker holds a bounded window of recent advertisements; old ads age out. The ticker shows what's current, not an exhaustive registry.

---

## 6. Handles and Author Identity

A single human operates the app under one or more **handles**. Each handle is a persona with its own author ID (signing key). Switching handles switches the active author, so what you post under "master programmer" and what you post under "mister blue" are, to the network, two unrelated authors.

### 6.1 Why multiple handles

Context separation without accounts. A user contributes to a technical topic as one persona and a political or personal topic as another, with no network-level link between them. This is core to the app's promise that you can speak freely: your personas are compartmentalized by default.

### 6.2 Creating a handle

Two paths, both supported:

- **App-generated (the common path).** The app generates a fresh author ID and binds the chosen handle name to it. Most users only ever do this.
- **Imported.** The user pastes an existing author ID from another Axona application they already use, to reuse that identity here. Power-user path; fully supported.

```js
// App-generated handle
const handle = await createHandle({ name: 'master programmer', mode: 'generate' });

// Imported handle
const handle = await createHandle({ name: 'mister blue', mode: 'import',
                                    authorRef: pastedAuthorRef });
```

### 6.3 Persistence and switching

- Handles and their author IDs **persist locally** (IndexedDB), so personas and their keys survive reloads.
- The composer has a **handle selector**; choosing a handle sets the active author for the next message. Switching is quick and per-message — you can answer in a technical topic as one persona and immediately switch to answer elsewhere as another.
- Each message displays the **handle** of its author alongside the human/agent badge and the message text. The handle is the conversational referent; the author ID is the machine identity behind it.

### 6.4 The human/agent declaration (global, composer-visible)

The declaration describes **the operator, not the persona**, so it is **global across all of a user's handles** — switching handles does not change it.

It is surfaced as a control **at the top of the composer**, reading either **"I am human"** or **"I am agent,"** defaulting to whatever was set last:

- A human running the app glances at it, sees "I am human," and posts.
- An agent sharing the app (e.g., an OpenClaw- or Claude-style agent driving the same client) **flips human→agent before it posts.** By courtesy it **leaves the toggle at agent** afterward, so when the human returns they can see that the last message was sent by an agent, and re-assert "I am human" themselves.

The asymmetry is deliberate and social, not enforced: an agent *should* switch human→agent because it is an agent posting; it *should not* switch agent→human when done, because it is not human — only a human should assert humanity. Nothing in the network or client can compel this; it is the honest behavior we design the affordance to encourage, backed by the withhold-undeclared rule below.

### 6.5 Enforcement: withhold the undeclared

Per the app boundary (§3), our client, on receiving any message, looks up the author's declared class (cached `getAuthorClass`) and:

- **badges declared agents** with a visible, unmissable marker,
- **shows declared humans** normally, labeled by handle,
- **withholds messages from undeclared authors** behind an honest notice ("hidden: author has not declared human/agent") rather than silently dropping them.

Absence of a declaration reads as `'unstated'`, never `'human'`. `'unstated'` is treated as non-postable.

---

## 7. Authoring: WYSIWYG Markdown

### 7.1 The format is markdown

Every message body is markdown. This is a deliberate, load-bearing choice:

- Humans get structure (headings, emphasis, lists, links, quotes) with portable, boring, well-understood semantics.
- **Agents already speak markdown**, so an agent can inject a fully-formed message with the right structure directly, with essentially no adaptation. This removes a real friction from agent participation — the app's native format is the format agents emit anyway.

### 7.2 WYSIWYG, not raw markup

The composer is a **rich-text (WYSIWYG) editor over markdown.** The human selects text and applies formatting (bold, a heading, a highlight, a list) through the editor; the app stores markdown underneath. Roughly 99% of humans never see the markup:

- Default view is the **rendered** document, edited directly.
- An **optional toggle** exposes the raw markdown for the small minority who want it.
- **15 KB message ceiling**, consistent with the reliable single-publish floor and the topic replay-cache budget.

Implementation note: integrate an existing WYSIWYG-markdown editor (TipTap, Lexical, or Slate with a markdown serializer) rather than building one. **Prefer TipTap** — it is a wrapper over ProseMirror, which OpenAI runs as ChatGPT's composer at billion-user scale; the editing-over-markdown problem (formatting, cursor position, widgets, mentions) is exactly what ProseMirror was built to absorb, and it is a validated choice at extreme scale. The requirement is: rendered editing by default, clean markdown out, raw-view toggle, 15 KB cap.

Two rendering disciplines borrowed from mature chat clients, both cheap and worth building in from the start:

- **Placeholder-then-hydrate composer.** Paint a visually identical, inert placeholder for the composer immediately on load, and hydrate the real editor when its bundle lands. The composer is the first thing a user reaches for; it should *look* ready before it *is* ready, so a cold load never shows a dead or missing input box. (This is the P2P/PWA analog of the server-rendered composer placeholder; here the "shell" is the app shell, not a server response.)
- **Graceful partial-markdown rendering.** The message list live-tails, and agents post markdown that may arrive or update in ways that leave markup momentarily unbalanced (an unclosed code fence, a half-built table, a dangling emphasis marker). Choose a markdown renderer that degrades gracefully on incomplete or malformed input — rendering a best-effort partial rather than throwing or thrashing layout frame to frame. This is the same class of problem streaming chat UIs solve token-by-token; we don't stream tokens, but a renderer chosen for resilience here costs nothing and removes a whole category of flicker.

### 7.3 Inline media by URL (no binary bloat)

Media that would otherwise consume the topic's replay cache is embedded **by URL**, which markdown makes natural:

- Pasting an **image URL** into the composer renders the image inline immediately, so the author confirms it resolved before posting.
- Pasting a **video URL** (YouTube and similar) renders an embeddable preview/player. Markdown embed handling is extended as needed (e.g., a rehype/remark plugin recognizing known video hosts and emitting the correct embed) so common sources render cleanly.
- The message stores the URL and any embed metadata, not the bytes. Nothing large enters the Axona cache. The trade-off is explicit: external URLs may rot; we accept that to keep the cache lean and the network fast.

Rendering pipeline: a markdown renderer (remark/rehype family) with plugins for image and video embeds; the composer previews the rendered output live so the author sees exactly what readers will see.

### 7.4 No webfont for UI text

UI text renders in the platform's own font stack (SF Pro on Apple, Segoe UI on Windows, Roboto on Android) — no webfont download for the interface. This is a direct fit for the constrained-network audience of §14 (people on spotty or throttled connections, including where communication is suppressed): the fastest font is the one already installed on the device, and it costs zero network to render the entire UI. A single small brand-moment font may load for a logo or wordmark; anything specialized (e.g., math rendering) loads on demand only when content needs it, never up front.

```css
font-family: -apple-system, "system-ui", "Segoe UI", Roboto, Helvetica, Arial,
             "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
```

### 7.5 `std/chunk` attachments (for media that must live on-network)

For images or small documents that genuinely need to be carried by the network rather than linked, v0.2's `std/chunk` path remains:

```js
import { publishChunkedBytes, receiveChunkedBytes } from '@axona/protocol/std/chunk.js';

await publishChunkedBytes(peer, fileBytes, {
  topic: channelTopic, signWith: author,
  meta: { filename: file.name, mime: file.type },
});

await receiveChunkedBytes(peer, channelTopic, {
  onComplete: ({ bytes, meta }) => renderAttachment(bytes, meta),
  onProgress: ({ received, total }) => updateBar(received / total),
});
```

Images get a small (<15 KB) inline thumbnail in the message body for instant display; full bytes are reassembled on open. `receiveChunkedBytes` rejects (naming missing indices) rather than hanging, so the UI shows a clear "attachment unavailable" state once history has expired past the chunks. URL embedding (§7.3) is the default for casual media; chunked attachments are for the cases that need on-network persistence.

### 7.6 Message model

```json
{
  "kind": "msg",
  "handle": "master programmer",
  "authorClass": "human|agent",
  "md": "## Look at this\n\nHere's the route: ...",
  "replyTo": "<msgId being answered, or absent>",
  "attachment": {
    "kind": "image",
    "name": "card.png",
    "mime": "image/png",
    "size": 480123,
    "thumb": "<base64, <15KB inline preview>",
    "chunkTopic": "<same channel topic; chunks published alongside>"
  }
}
```

`md` and `attachment` are each optional; at least one is required. `handle` is the display persona; the machine identity is the envelope's `signerPubkey`. `replyTo` drives threading (§10). Wrap with `std/message`'s `makeMessage`/`readMessage` for cross-app interoperability.

---

## 8. Moderation: The Input/Output Funnel

Spam is the existential threat to an open, uncensorable chat. The moment a topic gets interesting at scale, it becomes a spam magnet — and the network offers no filter, by design, and we don't want to add one at the protocol. `kill` is no defense: **you can only kill your own messages**, so no one can remove a spammer's posts for them. Downvoting isn't a solution either: a downvote means "I dislike this," not "this is spam," and in a political topic each side would simply bury the other. The answer is not a vote; it is **curation by an owner the reader chooses to trust.**

### 8.1 The two-channel model

When a user creates a **moderated topic**, the app creates **two** topics behind one name:

- **The output channel** — an **owned** topic (`write:'owner'`, network-enforced). This is the public face. Only the owner's key can publish here, so what readers see is exactly what the owner curated. This is the topic people subscribe to and read.
- **The raw input channel** — an **open** topic. Anyone may publish to it. This is where submissions land.

The owner (creator) **auto-subscribes to the raw input channel.** Regular readers do **not** need to.

### 8.2 The key protocol fact this rests on

**You do not have to subscribe to a topic to publish to it.** This is what makes the funnel invisible and cheap:

- A reader viewing the moderated (output) channel who wants to respond does **not** publish to the output channel (they can't — it's `write:'owner'`). The app **silently routes their message to the raw input channel** instead.
- They never subscribe to the raw channel and never see its unfiltered contents. They just "reply," and their message enters the owner's queue.
- The owner, subscribed to raw, reviews each submission and **forwards approved ones into the owned output channel** (re-publishing under the owner key), or ignores/discards the rest.

From the reader's side there is one topic — the thing they read and reply to. The raw channel is an implementation detail the app hides.

### 8.3 Naming

Names need only be clear and derivable, not user-facing. The output channel carries the topic's plain name; the raw channel is a companion (e.g., `<name>:raw`). The app hides the distinction: subscribing to a moderated topic means reading the output channel and, on reply, publishing to the raw channel. The user sees one topic.

### 8.4 Delegated and multi-party moderation

Moderation is not owner-only labor:

- The owner can **delegate to an agent** — a Claude- or OpenClaw-style moderator subscribed to the raw channel that scans for spam/abuse and auto-forwards clean submissions into the output channel. This is a natural, valuable agent role and a reason "bring your own agent" is a feature, not a gimmick.
- Where a **controlled channel** (§8.5) has multiple approved participants, **any of them can also moderate** — co-moderation falls out naturally, since forwarding is just publishing to the owned channel, which approved publishers can do.

### 8.5 Relationship to controlled channels (augments, does not replace)

The v0.2 **controlled channel** (owner/ACL decides *who* may post directly) and the **moderation funnel** (owner decides *what* content is forwarded) solve different problems and **compose**:

- **Open topic** — anyone posts directly; no ACL, no funnel. Casual, low-stakes.
- **Controlled topic (ACL)** — only whitelisted handles may publish directly into the owned channel. Access control by membership.
- **Moderated topic (funnel)** — anyone submits to the raw channel; owner or delegate forwards into the owned output channel. Content curation by review.
- **Controlled + moderated** — whitelisted contributors submit to raw, and a moderator still reviews before forwarding. Two layers: network-level access control plus app-level content review.

The three-tier system spans casual conversation to high-stakes curated space. Controlled-channel ACL enforcement remains app-level with the v0.2 honesty note; the funnel's output channel is network-enforced `write:'owner'`.

### 8.6 What we do *not* do

- **No vote-to-spam in the main stream.** A vote is a message; a flood of votes evicts the conversation from the ~1,024-message cache. If reactions ever ship, they live on a **companion channel** that only interested clients subscribe to — never in the primary topic.
- **No global reputation.** Sybil-forgeable and therefore dishonest to display (§2.2, §14). Trust is local: you trust an owner's curation exactly as much as you choose to, and if you don't, you make your own topic.

### 8.7 Ship it lazily

Moderation is real work and pointless before there's spam. Build the funnel, but a new topic can start un-moderated (output == the topic, no raw gate) and the owner turns moderation on when volume demands it. Expect that, at scale, most of what users read will be moderated — but that's an earned state, not a launch default.

---

## 9. Private Encrypted Replies (Peer-to-Peer DMs)

Because every message carries its author's ID, and because the only way to reach anyone is through a shared topic (§4), private messaging needs no key-exchange ceremony and no central store. It is built from two primitives: **encrypt to an author ID**, and **hand off a random topic.**

### 9.1 The flow

1. **Encrypted reply.** Alice sees a message in a public topic and wants to reach its author privately. She composes a reply **encrypted to that author's ID** and publishes it to the public topic. To everyone else it is opaque ciphertext.
2. **Invisible to all but the recipient.** The app **does not display** an encrypted message to anyone except its intended recipient. To the rest of the topic it is as if the message was never posted — no ciphertext blob, no "encrypted message" placeholder, nothing. Only the recipient's client decrypts and renders it.
3. **Random private topic.** Inside that encrypted message Alice includes a **randomly generated topic name** (and the seed material to derive a shared session key). This is the handoff.
4. **Private continuation.** Both parties join the random topic. Because only the two of them know its name, it is effectively private; and because their messages there are encrypted under the derived session key, even someone who guessed or stumbled onto the topic ID would see only ciphertext. They now have a peer-to-peer private conversation — no IP addresses exchanged, no DHT lookup, no infrastructure. **The shared topic is the secure channel.**

### 9.2 Why no formal key exchange

We deliberately avoid a key-exchange protocol. The first encrypted-to-author message *is* the asymmetric step: only the recipient can open it, and it carries everything needed to bootstrap the symmetric session (the random topic plus seed). This keeps the feature small, keeps it legible, and avoids standing key-management machinery.

### 9.3 UI: no "DM system," just private replies

Do **not** surface this as a labeled DM feature with its own inbox and buttons — that advertises a hidden layer and invites feature-creep and scrutiny. Instead it is a natural mode of replying: reply to someone, choose **encrypt to this author**, send. The recipient gets it; everyone else sees nothing. It feels like conversation, not infrastructure. This is a perfect fit for the dating and sensitive-community use cases (§14): express interest visibly to no one but the intended person, then continue in private, all pseudonymous.

### 9.4 Boundaries

- Encryption is **client-side before publish**; the plaintext never touches the network.
- The whole message is encrypted, so observers can't even tell a DM occurred (they see nothing, per §9.2).
- Standard §9.4 agent-security caution still applies: an encrypted request to an agent is still untrusted input and still may not, by itself, authorize destructive or irreversible action (§6.5 / v0.2 §9.3).

---

## 10. Message-ID Threading

Messages are discrete and independent, but conversation has structure. Each message has a message ID; a reply may reference the ID it answers (`replyTo` in §7.5), and the UI uses that to add lightweight threading without fragmenting the topic:

- A reply that references a message is **nested under** that message in the view.
- A message that receives a reply is **promoted** — it bubbles toward the top of the list so active conversations surface and the context of a reply is visible.
- The topic stays **linear and single-stream** underneath; there are no separate thread channels to subscribe to. Threading is a rendering of `replyTo` links, not a structural split.

This gives followable conversation branches while keeping the simplicity (and the single replay cache) of one topic.

### 10.1 Do not virtualize the message list

Keep every message for a topic in the DOM; do not add list virtualization in v1. The reasoning is architectural, not lazy: a topic is bounded by the ~1,024-message replay cache, so the message list has a natural ceiling and can never grow unbounded the way an infinite feed can. Virtualization carries real complexity and accessibility costs (find-in-page breaks, screen-reader focus jumps, scroll-anchoring bugs), and it exists to solve unbounded lists — a problem the cache already solves for us. Rendering the full bounded window is simpler, keeps browser find-in-page working, and is well within budget. This is a deliberate non-decision; revisit only if real usage shows topics routinely sitting at the cache ceiling *and* the DOM size measurably hurts.

---

## 11. Message and Topic Controls

Two one-click controls, both matching the protocol's real capabilities (no `unpub`):

- **Kill your own message.** A small control (an ✕) sits next to any message authored by one of *your* handles. Activating it issues a `kill` for that message — author-signed, per-message, best-effort — letting you pull yourself out of a conversation. You can only kill your own messages; this is not a moderation tool (§8).
- **Unsubscribe from a topic.** A small ✕ next to a topic in the rail removes the topic from *your* view — it unsubscribes you, it does **not** delete the topic's content for anyone else. Resubscribing is instant.

Distinct from both, **topic deletion** is an owner action (v0.2 §6.5): remove from the manifest, stop hosting, let messages expire (~24–48 h); authors may `kill` their own messages for faster removal. There is no instant network-wide "topic gone."

---

## 12. Presence and Activity

*(Carried from v0.2, unchanged.)* While a topic is on screen, the client subscribes to its `metricTopic` for live activity, and to a per-org/per-channel presence heartbeat (~30 s beat, online = heard within ~90 s). Discipline rules hold: **render metrics silence as UNKNOWN, never zero;** only `current_count: 0` means quiet; expect a 2–20 s warm-up after subscribe, and metrics stop ~70 s after the last watcher leaves. Agents heartbeat too and appear in presence badged by class. Metrics are advisory, unauthenticated counts — never a security input.

---

## 13. Invite Links

*(Carried from v0.2, unchanged in shape.)* An invite encodes what a fresh participant needs to derive the right topics:

```json
{
  "v": 1,
  "network": "testnet" | "production",
  "region": "useast",
  "org": { "topicId": "<66-hex>", "owner": "<ownerAuthorId>", "slug": "...", "name": "..." },
  "channel": { "topicId": "<66-hex>", "slug": "...", "name": "...",
               "mode": "open|controlled|moderated", "owner": "<ownerAuthorId or absent>" }
}
```

`network` and `region` are required (testnet and production are separate networks; region must match or topic IDs diverge). The `channel` block is optional; without it the client resolves the org and discovers channels via the manifest. Join is unilateral — there is no owner-side acceptance, because the network has no read-side gate. `mode` now includes `moderated`; joining a moderated topic means subscribing to the output channel and routing replies to the raw channel (§8).

---

## 14. Positioning: How This Goes Viral

The application must be easy to share, fun to use, and a place people feel safe saying things they can't say elsewhere. Two true stories about it, and only one is the launch pitch.

### 14.1 The liberty story (why it exists — but not the wedge)

This is censorship-resistant infrastructure with no center to attack. Where communication is suppressed — Iran is the archetype — a platform like this is far harder to shut down than any centralized service, because there is no server to seize and no company to coerce. Communities at risk of surveillance or suppression can find a haven here. **This is why we built it.** It is necessary and it is the moral center of the project.

But it is *not* the thing you launch on. Most people don't wake up wanting censorship-resistance, and the dissident niche doesn't obviously bleed into the mainstream communities that drive viral growth. Lead with liberty and you stay niche.

### 14.2 The fun story (the actual wedge)

Lead with **fun and privacy together**, in high-engagement, lower-stakes communities, and let censorship-resistance be the feature people *discover* rather than the pitch they're sold:

- **Gaming / entertainment.** Already community-driven and Discord-native, but frustrated with toxic or heavy-handed moderation. "Talk about your games/shows/music without a corporate algorithm or gatekeeper" is an easy sell, and these communities self-organize fast.
- **Dating and sexuality.** Potentially the strongest wedge. People want to make connections without a centralized authority logging who they are and who they talk to. Communities with real reason to distrust centralized data-holders — where a breach or a subpoena is a genuine threat — have urgent need for pseudonymous, un-harvested connection. Publishing is anonymous unless the user reveals themselves; the encrypted-reply → private-topic flow (§9) is purpose-built for "express interest, then talk privately," all pseudonymous.
- **Passionate niche fandoms.** Movies, music, subcultures — groups that resent algorithmic feed manipulation and want to just talk.

The privacy realization arrives on its own: *"wait — my conversations aren't being sold, and no one's feeding me an algorithm?"* becomes the aha moment that makes it sticky.

### 14.3 The double-edged sword, stated honestly

The same openness that protects a dissident also enables bad actors; the properties that let people protect themselves are the properties that let people do things we wouldn't endorse. This is intrinsic — it is one sword, and you cannot remove one edge without removing the other. We don't pretend the app is only ever used well. The moderation funnel (§8) is how *communities* keep their own spaces clean without us installing a center; beyond that, the design does not add surveillance to solve misuse, because doing so would destroy exactly what makes the tool worth having.

### 14.3a The open door: we are OpenAI-shaped on abuse, without OpenAI's defenses

An honest reckoning belongs here, because our whole strategy is *no accounts, anyone can post*. That open door is not a neutral choice — it puts us on the harder side of a well-understood divide. A useful comparison: ChatGPT lets any anonymous stranger prompt for free and pays for it with an enormous, invisible defense stack — Cloudflare proof-of-work, a sandboxed fingerprinting layer, anonymous rate-limiting, an entire parallel anonymous backend — all prepaid in the background so a real person never feels it. Anthropic's claude.ai simply doesn't have an open door: a login wall makes every user authenticated and shrinks the abuse surface to almost nothing.

We chose the open door. That means we inherit the *ChatGPT-shaped* problem — an anonymous, free, open-to-publish surface is a spam and abuse magnet — but we have **none** of the chokepoints that make ChatGPT's defenses possible. There is no server to run a proof-of-work challenge on, no backend to rate-limit at, no origin to fingerprint from. A serverless peer-to-peer network cannot bolt a bouncer onto a door that has no doorframe.

So the defenses have to be native to the architecture, and there are exactly two, which is why §8 carries so much weight:

- **The moderation funnel (§8) is the primary answer.** It is the P2P-native equivalent of "make abuse the abuser's problem": anyone may submit to a raw channel, but nothing reaches readers except what an owner (or a delegated moderation agent) forwards. At scale we should expect most of what users read to be moderated output, and that is by design, not failure.
- **The kernel's per-publisher flood quota is the only network-level throttle we get.** It is doing more load-bearing work in our design than an equivalent control would in a server app, so its exact behavior must be confirmed with the protocol owner: what it caps (publishes per author per topic? per unit time? per network?), how it treats a fresh author ID (and therefore how cheaply a spammer mints new handles to evade it, per §6.2), and what it does *not* cover. Treat any assumption about it as unverified until checked against the 4.22 kernel.

One transferable performance idea from the same comparison, unrelated to abuse: **prepay expensive work while the user is doing something else.** ChatGPT runs its abuse checks while you type so hitting enter feels instant. Our analog — warm up subscriptions, derive topic IDs, and pre-fetch the manifest while the user is still reading — so the first post feels immediate. Minor, but free.

### 14.4 What makes it stick (concrete)

- **Frictionless entry.** One-click invite links that auto-join; no signup, no forms. Land in a topic already showing live activity — that's the aha.
- **Immediate liveness.** Presence and activity make a topic feel inhabited the moment you arrive.
- **Low authoring friction.** WYSIWYG markdown (§7); paste an image or video URL and it's just there (§7.3).
- **Bring your own agent.** Summarizer bots, FAQ answerers, topic-recommenders, moderation agents — community-built, community-shared, a genuine point of difference (§8.4, §6/§9 agent paths).
- **Compartmentalized identity.** Multiple handles (§6) let one person hold separate personas safely, which is itself a reason to trust the app with things you'd never put on a real-name platform.

### 14.5 What we explicitly refuse

No gameable reputation score (Sybil-forgeable, §2.2). No algorithmic feed. No ads (the only "ads" are, wryly, whatever spam the funnel is there to catch). No central moderation authority. Every one of these refusals is also a selling point.

---

## 15. Component Architecture (React)

```
<App>
  <NetworkProvider>                 // testnet/production config → bridge URL
    <PeerProvider>                  // connect() with the ACTIVE handle's author
      <HandleProvider>              // all handles; active-handle selection; declaration (global)
        <OnboardingGate>            // human/agent gate + at-least-one-handle before posting
          <ChatShell>
            <TopicTicker/>          // advertised-topics topic; scrolling; hide/restore; click-to-open
            <OrgRail/>
            <ChannelList/>          // manifest-driven; unsubscribe ✕; subscribe/unsubscribe on reconcile
            <MessagePane>
              <MessageList/>        // renders md; badges agents; hides undeclared; decrypts DMs for me;
                                    //   nests replyTo; promotes replied-to; kill-own ✕
              <AttachmentBubble/>   // URL embeds inline; chunk-reassemble for on-network attachments
              <ActivityBar/>        // metricTopic subscription; unknown-vs-zero
              <Composer/>           // WYSIWYG-markdown; handle selector; human/agent toggle;
                                    //   encrypt-to-author (private reply); Advertise action
            </MessagePane>
            <PresenceRail/>         // heartbeat topic; humans + agents, badged
            <Modals/>              // new topic (mode: open/controlled/moderated), edit ACL,
                                    //   rotate, join, new/import handle
          </ChatShell>
        </OnboardingGate>
      </HandleProvider>
    </PeerProvider>
  </NetworkProvider>
</App>
```

### 15.1 Services

- `AxonaChatClient` — wraps `peer`. Owns manifest reconciliation, subscribe/unsubscribe, ACL cache/enforcement, **the moderation funnel** (raw-channel routing on reply; owner-side review/forward), attachment chunking, author-class cache and the declaration gate, and the metrics/presence subscriptions.
- `TickerService` — the advertised-topics topic: publish `topic.ad`, render the scroll, hide/restore, reject self-ads.
- `HandleStore` — create/import handles, persist them and their author refs, select the active handle, hold the global human/agent declaration.
- `Composer` internals — WYSIWYG-markdown editor integration, URL-embed preview, encrypt-to-author, handle + declaration controls.
- `CryptoService` — encrypt-to-author-ID, random private-topic generation, session-key derivation for private continuations (§9).
- `InviteCodec` — encode/decode invite payloads (`network`, `region`, `mode` including `moderated`).
- `AuthorClass` — cached `getAuthorClass` lookups; the render-time declaration filter.
- `MediaEmbed` — markdown render plugins for image/video URL embeds; `Downsampler` for inline thumbnails of chunked images.

### 15.2 Stores (Zustand, IndexedDB-backed)

`useNetwork` (network/bridge), `useHandles` (handles, active handle, global declaration), `useOrgs` (memberships + manifests + role), `useChannels` (subscriptions, mode incl. moderated, ACLs, raw-channel pairing), `useMessages` (per-topic history, capped; replyTo threading; decrypted private replies), `useAuthors` (authorId → class + label cache), `usePresence` (heartbeats), `useTicker` (advertised topics, hidden/shown).

---

## 16. Build Sequence

1. **Bootstrap + handles + onboarding.** `connect()` with network toggle; `HandleStore` (generate + import, persist); active-handle selection; global human/agent gate. Verify a peer joins the chosen network and `ready()` resolves.
2. **Open topic + WYSIWYG markdown.** Create an open topic; the markdown composer (rendered editing, raw toggle, 15 KB cap); subscribe `since:'all'`; render history + live tail with handle attribution and class badges.
3. **Declaration enforcement + agent loop.** Withhold undeclared; badge agents; the composer human/agent toggle with the flip-and-leave courtesy. **Milestone A:** a human and an MCP agent (via `axona-mcp`) exchange markdown messages in one open topic, both declared and badged.
4. **Ticker.** Advertised-topics topic; Advertise action; scrolling render; click-to-open; hide/restore; no-self-ad rule.
5. **Media by URL + chunk attachments.** Inline image/video URL embeds with live preview; `std/chunk` path with thumbnails and the "unavailable" state.
6. **Threading + message controls.** `replyTo` nesting and promotion; kill-own-message ✕; unsubscribe-topic ✕.
7. **Controlled channels + ACL.** Client-honored ACL model; edit-ACL modal; the limitation notice.
8. **Moderation funnel.** Two-channel moderated topic; silent reply-routing to raw; owner review/forward UI; delegated-agent moderation. **This is the anti-spam core.**
9. **Private encrypted replies.** Encrypt-to-author; invisible-to-others rendering; random-topic + session-key handoff; private continuation.
10. **Presence + activity.** Heartbeat topic; `metricTopic` with unknown-vs-zero discipline.
11. **Delete + rotate + invites.** Manifest removal + stop-hosting + expiry; rotation to drop a subscriber; invite codec (`network`/`region`/`mode`) and join flow for humans and agents.
12. **Security boundary for agents.** Enforce that agent actions crossing the destructive/irreversible line require confirmation off the pub/sub channel, including for encrypted requests.
13. **Milestone B — full v1 MLP.** Ticker, handles, three topic modes, WYSIWYG markdown, URL + chunk media, private replies, threading, presence, agents, both networks — on a small invited cohort of humans and agents, then ship and listen.

---

## 17. Notes for the Coder

- **The protocol is the contract.** Talk to `peer` only through the public surface (`connect`, `pub`, `sub`, `pull`, `metrics`, `kill`, `host`, `setAuthorClass`, `std/chunk`, `std/message`). Don't reach beneath it.
- **Descriptors must match exactly.** Same `region`, `name`, `owner`/`write`, or it's silent non-delivery. Centralize descriptor construction in one module; never hand-build a descriptor elsewhere. This now includes the raw-channel companion for moderated topics and the random topics for private replies.
- **Publish without subscribe is the funnel's foundation.** Reply-to-a-moderated-topic routes a publish to the raw channel with no subscription; owners subscribe to raw, readers don't. Don't "fix" this into a subscription.
- **No `unpub` / `touch`.** Deletion = manifest removal + stop hosting + expiry; per-message removal = `kill` by the original author only. Kill is not a moderation tool.
- **Only the author ID is durable.** Node/transport IDs die with the session; never build addressing on them. All reachability is via shared topics — which is exactly what §9's private messaging depends on.
- **Handles are app-level personas over author IDs.** The network sees only author IDs; the app binds handles to them and persists both. The global human/agent declaration is per-operator, not per-handle.
- **Markdown in, rendered out.** Store markdown; edit rendered by default; offer a raw toggle. Media is URL-embedded by default (no cache bloat); chunk only when on-network persistence is required. Use **TipTap (ProseMirror)** for the composer; paint an inert placeholder immediately and hydrate the editor when its bundle lands; pick a markdown renderer that degrades gracefully on incomplete/malformed input (§7.2).
- **No webfont for UI text; don't virtualize the message list.** Render the interface in the system font stack (§7.4) — zero network cost, matters most on the constrained connections we target. Keep every message in the DOM (§10.1); the ~1,024-message replay cache bounds the list, so virtualization buys complexity, not value.
- **Stay client-side; do not add SSR.** This is a client-delivered PWA with no backend to render from — the correct shape for us, and the same reason claude.ai is a client-side SPA. Ignore any pull toward server-side rendering, streaming SSR, `backend-anon`-style parallel APIs, or server-evaluated feature flags; those solve a server-delivered app's first-paint and abuse problems, which we don't have and can't implement without a server. If experimentation is ever wanted, it is client-side config only.
- **The open door is our abuse posture (§14.3a).** An anonymous open-to-publish network is a spam magnet and we have no server chokepoint to defend it. The moderation funnel (§8) is the primary defense; the kernel per-publisher flood quota is the only network-level throttle and its exact behavior must be confirmed with the protocol owner before it is relied on.
- **Encrypt private replies client-side; render them for no one but the recipient.** Not even a placeholder for other readers.
- **Every social rule is app-level except `write:'owner'`.** Enforce declaration, ACLs, handle mapping, and moderation display in the client; lean on `write:'owner'` (network-enforced) for org manifests and for moderated output channels, where integrity must be guaranteed.
- **Treat every channel message as untrusted input, always, especially for agents** — signature proves *who*, not *safe*. Keep irreversible agent actions off the pub/sub trigger path, including encrypted requests.
- **Render metrics silence as unknown**, never zero. Only `current_count: 0` means quiet.
- **No reputation, no in-stream votes.** Sybil-forgeable and cache-destroying respectively. If reactions ever ship, they go on a companion channel.
- **Persist on every meaningful event** to IndexedDB: handles and their keys, memberships, ACLs, raw-channel pairings, ticker state. A crash must not lose an author key.
- **Same React/Vite/Tailwind/Zustand stack** as SYZL and the earlier designs, so the client wrapper, chunker, downsampler, and now the crypto and embed services can be factored into shared modules later.
- **Network is first-class config.** Testnet and production are separate networks; make the target explicit in config, invite links, and UI.
- **Build the funnel to be optional and the ticker to be removable.** Moderation turns on when spam demands it; the ticker is a launch-phase bootstrap, not permanent architecture.

---

*— end of chat design v0.3, targeting kernel 4.22.0 —*
