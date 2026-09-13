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
  },
  async redirects() {
    // Appointments moved from /access to /appointments — keep old links working.
    return [{ source: "/staff/access", destination: "/staff/appointments", permanent: true }];
  },
  async rewrites() {
    // Patient (/care) makes core-api calls from the BROWSER (confirm/reschedule/
    // upload). Proxy them same-origin so core-api stays private on the internal
    // network. Baked at build; defaults to the compose service name.
    const core = process.env.CORE_API_INTERNAL_URL || "http://core-api:4100";
    // Meta's WhatsApp webhook is served by the integration-gateway, not this app.
    // Proxy /webhooks/meta/whatsapp/* to it same-origin so each hospital points Meta
    // at the app's OWN domain — no separate gateway host and no ALB rule needed. The
    // proxy streams the RAW body + x-hub-signature-256 through unchanged (same as the
    // /care upload proxy), so the gateway→core-api HMAC check still verifies.
    const gateway = process.env.GATEWAY_INTERNAL_URL || "http://integration-gateway:4105";
    return [
      { source: "/care/api/core/:path*", destination: `${core}/:path*` },
      { source: "/webhooks/meta/whatsapp/:path*", destination: `${gateway}/webhooks/meta/whatsapp/:path*` }
    ];
  }
};

export default nextConfig;
