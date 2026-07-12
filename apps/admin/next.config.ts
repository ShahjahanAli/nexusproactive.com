import type { NextConfig } from 'next';
import path from 'path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(path.join(__dirname, '../..'));

const nextConfig: NextConfig = {};

export default nextConfig;
