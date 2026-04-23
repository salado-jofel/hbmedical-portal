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
};

export default nextConfig;
