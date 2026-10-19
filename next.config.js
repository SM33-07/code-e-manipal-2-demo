/** @type {import('next').NextConfig} */
const isVercelDemo =
  Boolean(process.env.VERCEL_URL?.toLowerCase().includes('demo')) ||
  Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase().includes('demo')) ||
  Boolean(process.env.NEXT_PUBLIC_VERCEL_URL?.toLowerCase().includes('demo')) ||
  Boolean(process.env.VERCEL_GIT_REPO_SLUG?.toLowerCase().includes('testing')) ||
  process.env.DEMO_MODE === 'true' ||
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const nextConfig = {
  reactStrictMode: false,
  env: isVercelDemo
    ? {
        NEXT_PUBLIC_DEMO_MODE: 'true',
        DEMO_MODE: 'true',
      }
    : {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ihnclawnbtkwvbfqwxfe.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'ggmwribwynonpsvsmpyz.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;


