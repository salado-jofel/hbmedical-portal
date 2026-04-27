import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Ship the contract template PDFs to the Vercel serverless runtime — the
  // API route (`app/api/contract-template/[file]/route.ts`) and both stampers
  // read them via `fs.readFile(process.cwd() + '/lib/pdf/templates/*.pdf')`.
  // Without this trace-include entry, Next.js' build tracer leaves them out
  // of the bundle and `fs.readFile` 404s in production.
  outputFileTracingIncludes: {
    "/api/contract-template/[file]": ["./lib/pdf/templates/**"],
    "/invite/[token]/signup": ["./lib/pdf/templates/**"],
  },

  /**
   * HIPAA-relevant security headers applied to every response.
   *
   * - HSTS: forces HTTPS for 2 years; `preload` allows inclusion in the
   *   browser preload list. Only enable preload once you're certain the
   *   site is fully HTTPS — Vercel deployments are.
   * - X-Frame-Options: prevents clickjacking by disallowing iframe embedding.
   * - X-Content-Type-Options: stops MIME sniffing (defense vs. uploaded-
   *   content type confusion).
   * - Referrer-Policy: prevents leaking PHI-bearing URLs to external
   *   domains via the Referer header (e.g. when clicking a carrier
   *   tracking link from an order page).
   * - Permissions-Policy: explicitly disables sensors that the portal does
   *   not use; reduces fingerprint surface.
   *
   * NOT included here:
   * - Content-Security-Policy: needs a per-route nonce strategy for
   *   inline scripts that the Next.js runtime emits. Worth adding in a
   *   follow-up; do report-only first.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
