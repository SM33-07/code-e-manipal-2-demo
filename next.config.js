/** @type {import('next').NextConfig} */
const isVercelDemo =
  Boolean(process.env.VERCEL_URL?.toLowerCase().includes('demo')) ||
  Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase().includes('demo')) ||
  Boolean(process.env.NEXT_PUBLIC_VERCEL_URL?.toLowerCase().includes('demo')) ||
  Boolean(process.env.VERCEL_GIT_REPO_SLUG?.toLowerCase().includes('testing')) ||
  process.env.DEMO_MODE === 'true' ||
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

if (isVercelDemo) {
  process.env.DEMO_MODE = 'true';
  process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
  process.env.DEMO_DATA_SOURCE = 'synthetic';
  process.env.DATABASE_URL = 'postgresql://mock:mock@127.0.0.1:5432/mock';
  process.env.SUPABASE_URL = 'https://demo-mock.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo-mock.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'demo-mock-anon-key';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'demo-mock-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'demo-mock-service-role-key';
}

const nextConfig = {
  reactStrictMode: false,
  env: isVercelDemo
    ? {
        NEXT_PUBLIC_DEMO_MODE: 'true',
        DEMO_MODE: 'true',
        DEMO_DATA_SOURCE: 'synthetic',
        DATABASE_URL: 'postgresql://mock:mock@127.0.0.1:5432/mock',
        SUPABASE_URL: 'https://demo-mock.supabase.co',
        NEXT_PUBLIC_SUPABASE_URL: 'https://demo-mock.supabase.co',
        SUPABASE_ANON_KEY: 'demo-mock-anon-key',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'demo-mock-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'demo-mock-service-role-key',
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


