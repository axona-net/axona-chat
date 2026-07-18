import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig(() => ({
  // Served at the domain root: the custom domain axona.chat fronts the
  // GitHub Pages deployment (the old axona-net.github.io/axona-chat URL
  // redirects there).
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [react()],
  server: {
    // Bind IPv4 loopback explicitly. Vite's default localhost binding lands on
    // IPv6 ::1 (modern Node dns order), and Firefox cannot gather ANY ICE
    // candidates on a page served from a ::1 origin — every WebRTC dial fails
    // instantly ("ICE failed, your TURN server appears to be broken") and the
    // mesh never forms. Chromium is unaffected, which is why this only bit
    // Firefox users. Served from 127.0.0.1 the same code works everywhere.
    host: '127.0.0.1',
    // Honor an assigned port (launch harness autoPort) so parallel sessions
    // don't fight over one hardcoded port; vite's default otherwise.
    ...(process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {})
  },
  resolve: {
    alias: {
      'node-datachannel/polyfill': path.resolve('./src/stubs/node-datachannel-stub.js'),
      'node-datachannel': path.resolve('./src/stubs/node-datachannel-stub.js')
    }
  }
}))
