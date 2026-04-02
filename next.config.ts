import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  // Expands the allowed root for Turbopack resolution
  turbopack: {
    root: path.resolve(__dirname, "../../.."), 
  },
  outputFileTracingRoot: path.resolve(__dirname, "../../.."),
};

export default nextConfig;
