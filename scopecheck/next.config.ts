import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js rendering options: serve a prerendered static shell first, and prefetch
  // the static parts of routes. Next's docs say to enable these two together.
  cacheComponents: true,
  partialPrefetching: true,
  // Run CSS files through Tailwind when building with Turbopack.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
