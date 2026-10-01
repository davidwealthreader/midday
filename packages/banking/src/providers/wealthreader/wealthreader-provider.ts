import type { Provider } from "../../interface";
import type {
  DeleteAccountsRequest,
  DeleteConnectionRequest,
  GetAccountBalanceRequest,
  GetAccountBalanceResponse,
  GetAccountsRequest,
  GetAccountsResponse,
  GetConnectionStatusRequest,
  GetInstitutionsRequest,
  GetTransactionsRequest,
  GetTransactionsResponse,
} from "../../types";
import { WealthReaderApi, WealthReaderApiError } from "./wealthreader-api";
import {
  findAccount,
  payloadAccounts,
  transformAccount,
  transformBalance,
  transformInstitution,
  transformTransaction,
} from "./transform";
import type { WealthReaderAccess } from "./types";

function parseAccess(params: {
  id?: string;
  accessToken?: string;
  institutionId?: string;
}): WealthReaderAccess {
  const raw = params.accessToken || params.id;
  if (!raw) {
    throw new Error("Missing Wealth Reader access token");
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WealthReaderAccess>;
    if (parsed.token && parsed.entityCode) {
      return { token: parsed.token, entityCode: parsed.entityCode };
    }
  } catch {
    // Fall through to colon format.
  }

  const separator = raw.indexOf(":");
  if (separator > 0) {
    return {
      entityCode: raw.slice(0, separator),
      token: raw.slice(separator + 1),
    };
  }

  if (params.institutionId && params.accessToken) {
    return { token: params.accessToken, entityCode: params.institutionId };
  }

  throw new Error(
    "Wealth Reader accessToken must be JSON {token, entityCode} or entityCode:token",
  );
}

/**
 * Wealth Reader AIS provider. Not registered in Provider.switch yet:
 * add "wealthreader" to packages/banking/src/types.ts Providers and the
 * jobs/db enums in a follow-up slice.
 */
export class WealthReaderProvider implements Provider {
  #api: WealthReaderApi;

  constructor(apiKey?: string) {
    this.#api = new WealthReaderApi(apiKey);
  }

  async getHealthCheck() {
    return this.#api.getHealthCheck();
  }

  async getInstitutions(params: GetInstitutionsRequest) {
    const entities = await this.#api.listEntities(params.countryCode);
    return entities.map(transformInstitution);
  }

  async getAccounts(params: GetAccountsRequest): Promise<GetAccountsResponse> {
    const access = parseAccess(params);
    const data = await this.#api.refresh(access.token, access.entityCode);
    return payloadAccounts(data)
      .map((account) =>
        transformAccount(account, access.entityCode, access.entityCode),
      )
      .filter((account): account is NonNullable<typeof account> => account !== null);
  }

  async getAccountBalance(
    params: GetAccountBalanceRequest,
  ): Promise<GetAccountBalanceResponse> {
    const access = parseAccess(params);
    const data = await this.#api.refresh(access.token, access.entityCode);
    const account = findAccount(payloadAccounts(data), params.accountId);
    if (!account) {
      throw new Error("Wealth Reader account not found");
    }
    const balance = transformBalance(account, params.accountType);
    if (!balance) {
      throw new Error("Wealth Reader account has no usable balance");
    }
    return balance;
  }

  async getTransactions(
    params: GetTransactionsRequest,
  ): Promise<GetTransactionsResponse> {
    const access = parseAccess(params);
    const dateFrom = params.latest
      ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : undefined;
    const data = await this.#api.refresh(access.token, access.entityCode, dateFrom);
    const account = findAccount(payloadAccounts(data), params.accountId);
    if (!account) return [];

    const fallbackCurrency = account.currency || "EUR";
    return (account.transactions || [])
      .map((transaction) =>
        transformTransaction(
          transaction,
          params.accountId,
          params.accountType,
          fallbackCurrency,
        ),
      )
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  async getConnectionStatus(params: GetConnectionStatusRequest) {
    try {
      const access = parseAccess(params);
      await this.#api.refresh(access.token, access.entityCode);
      return { status: "connected" as const };
    } catch (error) {
      if (
        error instanceof WealthReaderApiError &&
        error.errorType === "invalid_access_token"
      ) {
        return { status: "disconnected" as const };
      }
      throw error;
    }
  }

  deleteAccounts(_params: DeleteAccountsRequest) {}

  deleteConnection(_params: DeleteConnectionRequest) {}
}

export { parseAccess as parseWealthReaderAccess };
