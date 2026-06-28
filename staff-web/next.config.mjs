/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    // Appointments moved from /access to /appointments — keep old links working.
    return [{ source: "/access", destination: "/appointments", permanent: true }];
  }
};

export default nextConfig;
