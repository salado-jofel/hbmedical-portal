// utils/quickbooks/config.ts  ← CREATE THIS FILE

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[QB Config] Missing required env var: ${key}`);
  return val;
}

const environment = process.env.QB_ENVIRONMENT ?? "sandbox";

export const QB_CONFIG = {
  clientId: requireEnv("QB_CLIENT_ID"),
  clientSecret: requireEnv("QB_CLIENT_SECRET"),
  redirectUri: requireEnv("QB_REDIRECT_URI"),
  authUrl: requireEnv("QB_AUTH_URL"),
  tokenUrl: requireEnv("QB_TOKEN_URL"),
  environment,
  companyUrl: requireEnv(
    environment === "production"
      ? "QB_COMPANY_URL_PRODUCTION"
      : "QB_COMPANY_URL_SANDBOX",
  ),
} as const;
