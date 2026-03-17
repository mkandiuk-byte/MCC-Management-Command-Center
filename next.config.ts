import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['node-pty', 'better-sqlite3', 'node-llama-cpp', '@tobilu/qmd'],
};

export default nextConfig;
