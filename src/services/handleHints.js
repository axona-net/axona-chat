// Handle names are always typed by the user — never prefilled or derived
// from the environment (§4.2). This hint exists because people defeat that
// by hand: on 2026-07-21 one person appeared on #axona.dev as "David",
// "vivaldi", and "firefox" after typing throwaway browser names at first-run
// in different browsers. The name stuck silently, and attribution broke.
const BROWSER_NAMES = new Set([
  'chrome', 'chromium', 'firefox', 'safari', 'edge', 'vivaldi',
  'brave', 'opera', 'arc', 'tor', 'ie', 'internet explorer', 'browser'
]);

export const looksLikeBrowserName = (name) =>
  BROWSER_NAMES.has((name || '').trim().toLowerCase());
