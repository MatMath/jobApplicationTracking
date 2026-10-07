import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits a self-contained server (server.js + only the node_modules it uses)
  // so the container image carries no dev dependencies and no npm install.
  output: 'standalone',
  typedRoutes: true,
  // `next build` writes to the same .next that `next dev` serves from, which
  // corrupts a running dev server's chunks. Let the verification build target
  // its own directory instead.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    serverActions: {
      // Document uploads arrive as Server Action form data. The default cap is
      // 1 MB for the whole body, which a file of exactly the allowed 1 MB
      // exceeds once the multipart framing is added. The real limit is enforced
      // on the file itself, in lib/documents/files.ts.
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
