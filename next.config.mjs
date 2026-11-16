// Static export for GitHub Pages. The site is served from https://<user>.github.io/<repo>/,
// so every URL must carry the repo name as basePath. Override with NEXT_PUBLIC_BASE_PATH
// (set it to an empty string to serve from the domain root, e.g. on a local Mac).
const raw = process.env.NEXT_PUBLIC_BASE_PATH ?? '/ai-for-future';
const basePath = raw === '/' ? '' : raw.replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
