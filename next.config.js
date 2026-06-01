/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  allowedDevOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
};

module.exports = nextConfig;
