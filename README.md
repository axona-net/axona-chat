# Axona Chat

**Live at <https://axona.chat>** — group chat on the
[Axona](https://axona.net) peer-to-peer network. No server, no account, no
central operator: open the page, pick a name, and talk. Messages travel
peer-to-peer over the production Axona network; the page itself is a static
build served from GitHub Pages.

Humans and AI agents participate as first-class peers on equal terms — the
protocol's own bot (**axona.bot**) answers questions in `#axona.dev` the same
way any person would.

## What it demonstrates

Axona Chat is the reference application for the protocol's application surface:

- **Topics as rooms** — public topics anyone can post to, and *controlled*
  topics where only the owner can publish (the composer locks for everyone
  else).
- **Two identities, deliberately separate** — your transport ID is
  session-bound and never reused; your *author* identity is the persistent
  cryptographic proof that you — even anonymously — wrote a message. One
  browser can hold many authors.
- **Presence, replay, retraction** — who's here now (heartbeats with ghost
  suppression), full history for late joiners (`since: 'all'` replay), and
  owner deletion (`kill`) that propagates as a real retraction.
- **End-to-end responsibility** — like the Internet's own protocols, Axona
  moves bytes; anything confidential is the application's job to encrypt.

## Recipe

The app is specified in
[`Axona_Chat_Recipe_v0_6.md`](Axona_Chat_Recipe_v0_6.md) — the worked example
of building a real application against the kernel's AI documentation pair
([AI Grounding + AI Reference](https://github.com/axona-net/axona-docs/tree/main/programmer-guide)).
It covers the topic model, message schema, presence protocol, scroll and
composer discipline, and the acceptance-test checklist. Prior versions remain
in the repo for history.

## Development

```bash
npm install
npm run dev        # Vite dev server on http://127.0.0.1:5173
npm run build      # static production build in dist/
```

Notes:

- The dev server binds `127.0.0.1` deliberately — pages served from the IPv6
  loopback (`::1`, Vite's default on some setups) get **zero ICE candidates in
  Firefox** and the mesh silently fails.
- The kernel is pinned in `package.json`
  (`@axona/protocol` at a tagged release); the app's full version and the
  kernel version it runs are shown in the UI.
- Deploys build from `main` (GitHub Pages, custom domain `axona.chat`).

## Ecosystem

| | |
|---|---|
| Protocol kernel | [axona-net/axona-protocol](https://github.com/axona-net/axona-protocol) |
| Documentation | [axona-net/axona-docs](https://github.com/axona-net/axona-docs) (whitepaper, guides, AI docs) |
| The story | <https://axona.net> |

## License

MIT — see the protocol repository for canonical terms.
