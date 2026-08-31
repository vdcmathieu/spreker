import type { NextConfig } from 'next';

/**
 * The site is served from a sub-path of vandecatsije.com (lab.vandecatsije.com
 * proxies /spreker to this project), so the build needs to know its base path.
 * `basePath` rewrites Next's own routes and assets; hand-written `<a href>` and
 * `fetch` calls would not be covered, and there are none.
 *
 * Unset locally, so `pnpm dev` serves from the root.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  // The dev overlay sits in the bottom-left corner, which is exactly where the
  // rail's sound control lives and where every screenshot pass looks.
  devIndicators: false,
};

export default nextConfig;
