/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a self-contained server (.next/standalone) for small Docker images.
  output: "standalone",
  // Lint runs via `npm run lint` / CI, not as an image-build gate.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Prescription uploads flow through a Server Action; phone photos routinely
    // exceed the 1 MB default. Raise the cap so uploads don't 413 → error boundary.
    serverActions: { bodySizeLimit: "10mb" }
  }
};

export default nextConfig;
