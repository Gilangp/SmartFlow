/** @type {import('next').NextConfig} */
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: false,
  },
  async rewrites() {
    return [
      { source: '/login',   destination: '/auth/login'    },
      { source: '/daftar',  destination: '/auth/register' },
    ];
  },
};

module.exports = withPWA(nextConfig);
