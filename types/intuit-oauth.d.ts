// types/intuit-oauth.d.ts
declare module "intuit-oauth" {
  interface OAuthClientConfig {
    clientId: string;
    clientSecret: string;
    environment: "sandbox" | "production";
    redirectUri: string;
    logging?: boolean;
  }

  interface Token {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in: number;
    id_token?: string;
    realmId?: string;
    createdAt?: number;
  }

  interface AuthResponse {
    token: Token;
    getJson(): Token;
    get(key: string): unknown;
    getToken(): Token;
    text(): string;
    status: number;
    headers: Record<string, string>;
    json: unknown;
    body: string;
  }

  class OAuthClient {
    constructor(config: OAuthClientConfig);

    authorizeUri(params: { scope: string | string[]; state: string }): string;

    createToken(url: string): Promise<AuthResponse>;

    refresh(): Promise<AuthResponse>;

    refreshUsingToken(refreshToken: string): Promise<AuthResponse>;

    revoke(params?: { token: string }): Promise<AuthResponse>;

    getToken(): Token;

    setToken(token: Partial<Token>): OAuthClient;

    isAccessTokenValid(): boolean;

    isRefreshTokenValid(): boolean;

    makeApiCall(params: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }): Promise<AuthResponse>;

    getUserInfo(): Promise<AuthResponse>;

    validateIdToken(params?: { idToken: string }): Promise<boolean>;

    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
      Intuit_name: string;
    };

    static environment: {
      sandbox: string;
      production: string;
    };
  }

  export = OAuthClient;
}
