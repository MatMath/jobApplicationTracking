import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  // `next build` writes to the same .next that `next dev` serves from, which
  // corrupts a running dev server's chunks. Let the verification build target
  // its own directory instead.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
