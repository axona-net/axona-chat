# Proposed Plan: Transmit and Render Clean Markdown

This plan details the transition of the application from transmitting raw HTML to transmitting clean, standard Markdown on the wire, strictly aligning it with the load-bearing requirements of the design specification (§7).

## User Review Required
> [!IMPORTANT]
> - **Wire Format Change**: The P2P payload will transmit clean Markdown text rather than raw HTML.
> - **TipTap Markdown Extension**: We will add the `@tiptap/markdown` extension to the editor to handle direct markdown serialization (`editor.getMarkdown()`) and parsing.
> - **ReactMarkdown Rendering**: We will render all message contents using the `react-markdown` library inside `Message.jsx` instead of the insecure and non-conforming `dangerouslySetInnerHTML` tag.

## Proposed Changes

### 1. TipTap Composer Updates
#### [MODIFY] [Composer.jsx](file:///Users/croqueteer/Documents/claude/axona-chat/src/components/Composer.jsx)
- Import `Markdown` extension from `@tiptap/markdown`.
- Add `Markdown` to the editor extensions list.
- Modify `handleSend()` to fetch clean markdown using `editor.getMarkdown()` instead of HTML.
- Pass the raw markdown string to `AxonaChatClient.publish()`.

### 2. Message Rendering pipeline
#### [MODIFY] [Message.jsx](file:///Users/croqueteer/Documents/claude/axona-chat/src/components/Message.jsx)
- Import `ReactMarkdown` from `react-markdown`.
- Render the message text inside `<ReactMarkdown className="markdown-content">` instead of using `dangerouslySetInnerHTML={{ __html: displayText }}`.
- Style the markdown output tags (`p`, `ol`, `ul`, `li`, `pre`, `code`, `blockquote`) inside `index.css` to maintain visual aesthetics.

---

## Verification Plan

### Automated Tests
- Verify that standard unit tests compile and run:
  `npm test -- --run`

### Manual Verification
- Send formatted messages (headers, lists, inline code, bold text) in the chat workspace.
- Confirm they render correctly for humans in the message history, and verify that the raw payload sent across the network is clean Markdown.
