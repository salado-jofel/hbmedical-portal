import { afterEach, describe, expect, it, vi } from "vitest";

/* The guard is the only thing standing between a local convenience and a
   production auth bypass, so each lock gets a test. `headers()` is mocked
   because these run outside a request. */
vi.mock("next/headers", () => ({
  headers: async () => new Map([["host", mockHost]]),
}));

let mockHost = "localhost:3000";

/* NODE_ENV is typed read-only; these tests exist to prove the guard reacts
   to it, so they need to set it. */
const setNodeEnv = (value: string) => {
  // Read `process.env` fresh each time: afterEach rebinds it to a new object,
  // so a reference captured at module load would go stale.
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};

const load = async () => {
  vi.resetModules();
  return import("@/lib/dev/dev-login-guard");
};

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  mockHost = "localhost:3000";
});

describe("isDevLoginConfigured", () => {
  it("is off unless explicitly enabled", async () => {
    setNodeEnv("development");
    delete process.env.ENABLE_DEV_LOGIN;
    const { isDevLoginConfigured } = await load();
    expect(isDevLoginConfigured()).toBe(false);
  });

  it("is on in development with the opt-in set", async () => {
    setNodeEnv("development");
    process.env.ENABLE_DEV_LOGIN = "true";
    const { isDevLoginConfigured } = await load();
    expect(isDevLoginConfigured()).toBe(true);
  });

  it("is OFF in production even with the opt-in set", async () => {
    // The lock that matters: Vercel sets NODE_ENV=production on every
    // deployment, so a leaked env var still cannot open this.
    setNodeEnv("production");
    process.env.ENABLE_DEV_LOGIN = "true";
    const { isDevLoginConfigured } = await load();
    expect(isDevLoginConfigured()).toBe(false);
  });

  it("rejects truthy-but-not-true opt-in values", async () => {
    setNodeEnv("development");
    for (const value of ["1", "yes", "TRUE", " true"]) {
      process.env.ENABLE_DEV_LOGIN = value;
      const { isDevLoginConfigured } = await load();
      expect(isDevLoginConfigured()).toBe(false);
    }
  });
});

describe("isDevLoginAllowed", () => {
  it("allows loopback hosts", async () => {
    setNodeEnv("development");
    process.env.ENABLE_DEV_LOGIN = "true";
    for (const host of ["localhost:3000", "127.0.0.1:3000", "localhost", "[::1]:3000"]) {
      mockHost = host;
      const { isDevLoginAllowed } = await load();
      expect(await isDevLoginAllowed(), host).toBe(true);
    }
  });

  it("rejects non-loopback hosts even when configured", async () => {
    setNodeEnv("development");
    process.env.ENABLE_DEV_LOGIN = "true";
    for (const host of [
      "meridianportal.io",
      "192.168.1.20:3000",
      "abc.ngrok.io",
      "localhost.evil.com",
      "notlocalhost:3000",
      "",
    ]) {
      mockHost = host;
      const { isDevLoginAllowed } = await load();
      expect(await isDevLoginAllowed(), host).toBe(false);
    }
  });

  it("rejects a loopback host when not configured", async () => {
    setNodeEnv("production");
    process.env.ENABLE_DEV_LOGIN = "true";
    mockHost = "localhost:3000";
    const { isDevLoginAllowed } = await load();
    expect(await isDevLoginAllowed()).toBe(false);
  });
});

describe("isDevLoginAllowedQuiet", () => {
  // Same locks as isDevLoginAllowed — it only differs by not logging, and the
  // MFA gate calls it on every dashboard render.
  it("agrees with the logging variant", async () => {
    const cases: Array<[string, string | undefined, string, boolean]> = [
      ["development", "true", "localhost:3000", true],
      ["development", undefined, "localhost:3000", false],
      ["production", "true", "localhost:3000", false],
      ["development", "true", "meridianportal.io", false],
    ];
    for (const [nodeEnv, flag, host, expected] of cases) {
      setNodeEnv(nodeEnv);
      if (flag === undefined) delete process.env.ENABLE_DEV_LOGIN;
      else process.env.ENABLE_DEV_LOGIN = flag;
      mockHost = host;
      const { isDevLoginAllowed, isDevLoginAllowedQuiet } = await load();
      const label = `${nodeEnv}/${flag}/${host}`;
      expect(await isDevLoginAllowedQuiet(), label).toBe(expected);
      expect(await isDevLoginAllowed(), label).toBe(expected);
    }
  });

  it("does not log", async () => {
    setNodeEnv("development");
    delete process.env.ENABLE_DEV_LOGIN;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { isDevLoginAllowedQuiet } = await load();
    await isDevLoginAllowedQuiet();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
