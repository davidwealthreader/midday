import { createHash } from "node:crypto";
import { capitalCase } from "change-case";
import type {
  Account,
  GetAccountBalanceResponse,
  Institution,
  Transaction,
} from "../../types";
import type { AccountType } from "../../utils/account";
import { isValidCurrency } from "../../utils/currency";
import { getLogoURL } from "../../utils/logo";
import type {
  WealthReaderAccount,
  WealthReaderTransaction,
} from "./types";

function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function accountTypeFromSubtype(subtype?: string): AccountType {
  const value = (subtype || "").toLowerCase();
  if (value.includes("card") || value.includes("credit")) return "credit";
  if (value.includes("loan") || value.includes("mortgage")) return "loan";
  return "depository";
}

export function transformInstitution(entity: {
  id: string;
  name: string;
  logo: string | null;
}): Institution {
  return {
    id: entity.id,
    name: entity.name,
    logo: entity.logo || getLogoURL(entity.name, "png"),
    // Cast until "wealthreader" is added to the Providers union.
    provider: "wealthreader" as Institution["provider"],
  };
}

export function transformAccount(
  account: WealthReaderAccount,
  institutionName: string,
  institutionId: string,
): Account | null {
  const id = account.uuid || account.code;
  if (!id) return null;

  const type = accountTypeFromSubtype(account.subtype);
  const current = parseAmount(account.balances?.current);
  const available = parseAmount(account.balances?.available);
  const rawAmount = current ?? available;
  if (rawAmount === null) return null;

  const amount =
    type === "credit" && rawAmount < 0 ? Math.abs(rawAmount) : rawAmount;
  const currency = isValidCurrency(account.currency)
    ? account.currency
    : "EUR";

  return {
    id,
    name: account.name || "Account",
    currency,
    type,
    institution: {
      id: institutionId,
      name: institutionName,
      logo: getLogoURL(institutionName, "png"),
      provider: "wealthreader" as Institution["provider"],
    },
    balance: { amount, currency },
    enrollment_id: null,
    resource_id: account.code || account.uuid || null,
    expires_at: null,
    iban: account.code || null,
    subtype: account.subtype?.toLowerCase() || null,
    bic: null,
    routing_number: null,
    wire_routing_number: null,
    account_number: null,
    sort_code: null,
    available_balance:
      available !== null && type === "credit" && available < 0
        ? Math.abs(available)
        : available,
    credit_limit: null,
  };
}

export function transformBalance(
  account: WealthReaderAccount,
  accountType?: string,
): GetAccountBalanceResponse | null {
  const current = parseAmount(account.balances?.current);
  const available = parseAmount(account.balances?.available);
  const rawAmount = current ?? available;
  if (rawAmount === null) return null;

  const amount =
    accountType === "credit" && rawAmount < 0 ? Math.abs(rawAmount) : rawAmount;
  const currency = isValidCurrency(account.currency) ? account.currency : "EUR";
  const availableBalance =
    available !== null && accountType === "credit" && available < 0
      ? Math.abs(available)
      : available;

  return {
    amount,
    currency,
    available_balance: availableBalance,
    credit_limit: null,
  };
}

function transactionId(
  transaction: WealthReaderTransaction,
  accountId: string,
): string {
  if (transaction.uuid) return transaction.uuid;
  if (transaction.id) return transaction.id;

  const input = [
    accountId,
    transaction.date || transaction.booking_date || "",
    transaction.amount ?? "",
    transaction.currency || "",
    transaction.description || transaction.name || "",
  ].join("-");
  return createHash("md5").update(input).digest("hex");
}

export function transformTransaction(
  transaction: WealthReaderTransaction,
  accountId: string,
  accountType: AccountType,
  fallbackCurrency: string,
): Transaction | null {
  const amount = parseAmount(transaction.amount);
  if (amount === null) return null;

  const date =
    transaction.date || transaction.booking_date || transaction.value_date;
  if (!date) return null;

  const rawName =
    transaction.name ||
    transaction.description ||
    transaction.counterpart ||
    transaction.counterparty ||
    "No information";
  const name = capitalCase(rawName);
  const description =
    transaction.description && transaction.description !== rawName
      ? capitalCase(transaction.description)
      : null;
  const status =
    transaction.status?.toLowerCase() === "pending" ? "pending" : "posted";

  return {
    id: transactionId(transaction, accountId),
    amount,
    currency: isValidCurrency(transaction.currency)
      ? transaction.currency
      : fallbackCurrency,
    date,
    status,
    balance: null,
    category:
      accountType === "depository" && amount > 0 ? "income" : null,
    counterparty_name: transaction.counterpart || transaction.counterparty || null,
    merchant_name: null,
    method: amount > 0 ? "payment" : "other",
    name,
    description,
    currency_rate: null,
    currency_source: null,
  };
}

export function findAccount(
  accounts: WealthReaderAccount[],
  accountId: string,
): WealthReaderAccount | undefined {
  return accounts.find(
    (account) => account.uuid === accountId || account.code === accountId,
  );
}

export function payloadAccounts(data: {
  payload?: { accounts?: WealthReaderAccount[] };
  accounts?: WealthReaderAccount[];
}): WealthReaderAccount[] {
  const raw = data.payload?.accounts || data.accounts || [];
  return Array.isArray(raw) ? raw : [];
}
