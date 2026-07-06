import type { NextConfig } from 'next';
import path from 'path';
import { loadEnvConfig } from '@next/env';

// Load monorepo root .env so NEXT_PUBLIC_API_URL is shared with the API
loadEnvConfig(path.join(__dirname, '../..'));

const nextConfig: NextConfig = {};

export default nextConfig;
