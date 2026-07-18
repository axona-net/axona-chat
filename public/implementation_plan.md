# Axona Chat Application Build Plan

## Goal Description
Build the Axona Chat web application as described in the design document (v0.3). The app will be a PWA built with React (via Vite) and vanilla CSS, featuring premium UI aesthetics, WYSIWYG markdown composition, multiple handles, discovery ticker, moderation funnel, private encrypted replies, and other features outlined.

## User Review Required
> [!IMPORTANT]
> Please review the open questions below. Your answers are needed before we can proceed with repository creation and implementation.

## Open Questions
> [!WARNING]
> 1. **UI Framework Preference** – Do you want to use plain React with Vite, or would you prefer a different framework (e.g., Next.js) for server‑side rendering? The design calls for a PWA; Vite + React is the lightweight choice.
> 2. **WYSIWYG Editor** – The design recommends TipTap. Is TipTap acceptable, or would you prefer Lexical or Slate?
> 3. **Color Palette / Branding** – Any specific brand colors, fonts (Google Fonts), or logo assets you would like incorporated? If none, we will craft a harmonious dark‑mode palette with Inter font.
> 4. **Repository Visibility** – Should the GitHub repository be public or private?
> 5. **Deployment Target** – Do you plan to host on GitHub Pages, Vercel, Netlify, or another platform? This influences the build scripts.
> 6. **Agent Integration** – Will you provide an existing MCP agent implementation, or should we stub a simple mock agent for initial development?
> 7. **Testing Strategy** – Do you need automated unit/integration tests now, or can we focus on manual verification for the MVP?

## Proposed Changes
---
### Repository Setup
- **[NEW]** /Users/croqueteer/.gemini/antigravity-ide/scratch/axona-chat – Create folder for the project.
- Initialize a Vite React app (`npx -y create-vite@latest ./ --template react`).
- Add a `README.md` with project description and setup instructions.
- Create a `.gitignore` suitable for Node projects.

---
### Core Packages & Configuration
- Install dependencies: `react`, `react-dom`, `zustand`, `@axona/protocol` (placeholder), `tiptap` (or chosen editor), `crypto-js` for client‑side encryption, `rehype-react` for markdown rendering, `axios` for invite codec.
- Configure TypeScript (optional) for stronger typing.
- Set up ESLint & Prettier for code quality.

---
### Architecture (per Design Section 15)
- **NetworkProvider** – Context that holds bridge URL, network/region selection.
- **PeerProvider** – Manages `connect()` from `@axona/protocol` using the active handle.
- **HandleProvider** – Handles create/import, persistence (IndexedDB via `idb-keyval`), active‑handle selection, and global human/agent declaration.
- **OnboardingGate** – Enforces at least one handle and declaration before posting.
- **ChatShell** – Layout containing:
  - `TopicTicker`
  - `OrgRail`
  - `ChannelList`
  - `MessagePane` (MessageList, AttachmentBubble, ActivityBar)
  - `Composer`
  - `PresenceRail`
  - `Modals`
- Implement services: `AxonaChatClient`, `TickerService`, `CryptoService`, `InviteCodec`, `MediaEmbed`.
- Implement stores using Zustand with IndexedDB persistence.

---
### UI / Design (Premium Aesthetics)
- Use a dark‑mode base with a curated HSL palette (e.g., primary: hsl(210, 40%, 55%)).
- Apply glassmorphism to modal backgrounds and ticker.
- Add subtle micro‑animations (hover lifts, fade‑in, slide‑in for ticker entries).
- Load `Inter` font from Google Fonts for body text, `Outfit` for headings.
- Ensure responsive layout with CSS Grid/Flex.
- Create placeholder images via `generate_image` tool for UI mockups (logo, ticker demo).

---
### Feature Implementation Milestones
1. **Bootstrap & Handles** – `connect()`, handle generation/import, persistence, declaration toggle.
2. **Open Topic + Composer** – WYSIWYG markdown (TipTap), raw markdown toggle, 15 KB limit, live preview.
3. **Declaration Enforcement** – Hide undeclared messages, render human/agent badges.
4. **Advertised‑Topics Ticker** – Service publishing `topic.ad`, scrolling UI, hide/restore.
5. **Media Embeds** – URL preview for images/video, `std/chunk` attachment support.
6. **Threading & Controls** – `replyTo` nesting, promotion, kill‑own, unsubscribe.
7. **Controlled Channels & ACL** – UI for ACL edit, enforcement.
8. **Moderation Funnel** – Raw‑input & owned output topics, owner review UI, delegated agent stub.
9. **Private Encrypted Replies** – Encryption to author ID, random private topic generation, invisible rendering.
10. **Presence & Activity Bar** – Heartbeat subscription, metric display.
11. **Invite Links** – Encode/decode, auto‑join flow.
12. **PWA Packaging** – `manifest.json`, service worker via Vite plugin.
13. **Testing & CI** – Basic Jest/React Testing Library setup (optional per Q6).

---
## Verification Plan
- **Automated Tests** – Run `npm test` after implementation of each milestone.
- **Manual Verification** – Use Chrome devtools to inspect UI, simulate multiple handles, verify encryption visibility, test ticker scrolling.
- **End‑to‑End Demo** – Deploy to a temporary Netlify preview URL and walk through core flows.

---
*Once the above questions are answered, we will create the repository and begin implementation.*
