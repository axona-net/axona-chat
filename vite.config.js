import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command }) => ({
  // Production builds deploy to GitHub Pages at /axona-chat/; dev stays at /.
  base: command === 'build' ? '/axona-chat/' : '/',
  plugins: [react()],
  server: {
    // Bind IPv4 loopback explicitly. Vite's default localhost binding lands on
    // IPv6 ::1 (modern Node dns order), and Firefox cannot gather ANY ICE
    // candidates on a page served from a ::1 origin — every WebRTC dial fails
    // instantly ("ICE failed, your TURN server appears to be broken") and the
    // mesh never forms. Chromium is unaffected, which is why this only bit
    // Firefox users. Served from 127.0.0.1 the same code works everywhere.
    host: '127.0.0.1'
  },
  resolve: {
    alias: {
      'node-datachannel/polyfill': path.resolve('./src/stubs/node-datachannel-stub.js'),
      'node-datachannel': path.resolve('./src/stubs/node-datachannel-stub.js')
    }
  }
}))
