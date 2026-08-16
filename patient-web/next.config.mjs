/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a self-contained server (.next/standalone) for small Docker images.
  output: "standalone",
  // Lint runs via `npm run lint` / CI, not as an image-build gate.
  eslint: { ignoreDuringBuilds: true }
};

export default nextConfig;
