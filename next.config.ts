import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' covers WASM execution; cdn.jsdelivr.net needed for
              // @huggingface/transformers dynamic WASM backend import
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              // HuggingFace model hub + LFS CDNs for model weights; jsdelivr for WASM runtime files
              "connect-src 'self' https://api.anthropic.com https://api.openai.com https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://cas-bridge.xethub.hf.co https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              // ONNX Runtime Web spawns blob: workers for WASM inference
              "worker-src blob: 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  // Turbopack is the default bundler in Next.js 16; empty config silences the webpack-fallback warning
  turbopack: {},
  // Webpack config used when building with --webpack flag
  webpack: (config, { isServer }) => {
    // Exclude server-only native packages that Transformers.js / ONNX Runtime may reference
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    config.externals = config.externals ?? [];
    if (isServer) {
      config.externals.push('sharp', 'onnxruntime-node');
    }
    return config;
  },
};

export default nextConfig;
