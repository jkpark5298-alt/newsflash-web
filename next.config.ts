import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flexible.img.hani.co.kr',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
