# Tasks - Axona Chat Implementation Addendum v0.1

- [x] Install `qrcode` npm package for local QR generation
- [x] Implement Light/Dark Theme support (CSS variables in theme.css + Zustand state/toggle + persistence)
- [x] Reorganize layout (topics to far-left; message pane/composer full width; metadata/declarations/participants to bottom edges; remove DHT Node ID)
- [x] Implement Composer Click-to-Expand Overlay (grow/collapse transition, backdrop click, draft preservation)
- [x] Implement Topic Metrics (subscribe to `metricTopic(T)`, retrieve message count, surface in header; handle UNKNOWN state)
- [x] Fix Persona creation modal z-index layer and Human/Agent toggle overflow styling
- [x] Enhance Ticker (pause scrolling on hover, make entire ad card clickable to join topic)
- [x] Implement clickable Header Title Modal detailing Axona Chat and protocol linking to `axona.net`
- [x] Implement QR code share + private channel generation, auto-connect on invite link URL query, and connections local names labeling
- [x] Styling & Layout Refinements:
  - [x] Position bottom status footer to stretch full screen width under both sidebars
  - [x] Create theme-aware footer background and element styles
  - [x] Ensure high-contrast dark text/icons in light mode footer
  - [x] Soften drop shadows and card overlays in light theme
  - [x] Style composer edit surface with even lighter grey/white
  - [x] Adjust codeblocks and inline code tag backgrounds/text contrast for light/dark themes
- [x] Upgrade `@axona/protocol` to `v4.27.1` (Phase 7 role natures & join-storm hardening support)
  - [x] Add resolver alias stubs for `node-datachannel` browser bundling support
