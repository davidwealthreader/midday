import { generatePkce } from "./pkce";

const API_BASE = "https://api.wealthreader.com";
const OAUTH_BASE = "https://oauth.wealthreader.com";
const AUTH_ERROR_CODES = new Set([1010, 1020, 2010, 2020]);

export class WealthReaderApiError extends Error {
  constructor(
    public readonly errorType: "invalid_access_token" | "rate_limited" | "internal",
    message: string,
  ) {
    super(message);
    this.name = "WealthReaderApiError";
  }
}

export class WealthReaderApi {
  #apiKey: string;

  constructor(apiKey = process.env.WEALTHREADER_API_KEY ?? "") {
    this.#apiKey = apiKey;
  }

  async listEntities(country?: string) {
    const url = new URL(`${API_BASE}/entities/`);
    if (country) url.searchParams.set("country_code", country.toUpperCase());
    const data = await this.#interpret(await fetch(url, { headers: { Accept: "application/json" } }), "GET /entities/");
    const raw = (data.payload || data.entities || []) as Array<Record<string, unknown>>;
    return raw
      .filter((item) => typeof item.code === "string" && item.code)
      .map((item) => ({
        id: String(item.code),
        name: String(item.name || item.code),
        logo: typeof item.logo === "string" ? item.logo : null,
        country: String(item.country_code || item.country || "").toUpperCase(),
      }));
  }

  buildAuthorizeUrl(redirectUri: string, state: string, entityCode: string) {
    const challenge = generatePkce(entityCode);
    const query = new URLSearchParams({
      challenge_code: challenge.challenge,
      code_challenge_method: "S256",
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      nonce: challenge.nonce,
      wr_conf: challenge.wrConf,
    });
    return { url: `${OAUTH_BASE}/oauth2/?${query}`, challenge };
  }

  async exchangeCode(code: string, redirectUri: string, codeVerifier: string) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    });
    return this.#interpret(
      await fetch(`${OAUTH_BASE}/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      }),
      "POST /token/",
    );
  }

  async refresh(token: string, entityCode: string, dateFrom?: string) {
    const body = new URLSearchParams({
      api_key: this.#apiKey,
      code: entityCode,
      token,
      product_types: "accounts",
    });
    if (dateFrom) body.set("date_from", dateFrom);
    return this.#interpret(
      await fetch(`${API_BASE}/entities/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      }),
      "POST /entities/",
    );
  }

  async getHealthCheck() {
    try {
      await this.listEntities("ES");
      return true;
    } catch {
      return false;
    }
  }

  async #interpret(res: Response, path: string) {
    if (res.status === 429) {
      throw new WealthReaderApiError("rate_limited", `Wealth Reader ${path} → 429`);
    }
    if (res.status === 401 || res.status === 410) {
      throw new WealthReaderApiError("invalid_access_token", `Wealth Reader ${path} → ${res.status}`);
    }
    if (!res.ok) {
      throw new WealthReaderApiError("internal", `Wealth Reader ${path} → ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (data.success === false) {
      const error = (data.error || {}) as { code?: number; message?: string };
      const code = Number(error.code || 0);
      const message = error.message || "success=false";
      if (AUTH_ERROR_CODES.has(code)) {
        throw new WealthReaderApiError("invalid_access_token", `Wealth Reader error ${code}: ${message}`);
      }
      throw new WealthReaderApiError("internal", `Wealth Reader error ${code}: ${message}`);
    }
    return data;
  }
}
