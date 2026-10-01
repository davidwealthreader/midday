import { expect, test } from "bun:test";
import {
  findAccount,
  transformAccount,
  transformBalance,
  transformTransaction,
} from "./transform";

test("skips accounts without uuid or iban", () => {
  expect(transformAccount({ name: "orphan" }, "BBVA", "bbva")).toBeNull();
});

test("skips non-numeric balances", () => {
  expect(
    transformAccount(
      { uuid: "a1", name: "Main", currency: "EUR", balances: { available: "n/a" } },
      "BBVA",
      "bbva",
    ),
  ).toBeNull();
});

test("maps a checking account", () => {
  const account = transformAccount(
    {
      uuid: "acc-1",
      code: "ES123",
      name: "Nómina",
      currency: "EUR",
      subtype: "checking",
      balances: { available: "12.50", current: "10" },
    },
    "BBVA",
    "bbva",
  );

  expect(account).toMatchObject({
    id: "acc-1",
    name: "Nómina",
    currency: "EUR",
    type: "depository",
    iban: "ES123",
    balance: { amount: 10, currency: "EUR" },
    available_balance: 12.5,
  });
});

test("normalizes negative credit balances", () => {
  expect(
    transformBalance(
      { balances: { current: "-80.25" }, currency: "EUR" },
      "credit",
    ),
  ).toEqual({
    amount: 80.25,
    currency: "EUR",
    available_balance: null,
    credit_limit: null,
  });
});

test("matches accounts by uuid or IBAN", () => {
  const accounts = [
    { uuid: "acc-1", code: "ES123" },
    { uuid: "acc-2", code: "ES999" },
  ];
  expect(findAccount(accounts, "ES123")?.uuid).toBe("acc-1");
  expect(findAccount(accounts, "acc-2")?.code).toBe("ES999");
});

test("skips transactions without amount or date", () => {
  expect(
    transformTransaction({ description: "x" }, "acc-1", "depository", "EUR"),
  ).toBeNull();
  expect(
    transformTransaction(
      { amount: "10", description: "x" },
      "acc-1",
      "depository",
      "EUR",
    ),
  ).toBeNull();
});

test("maps a posted income transaction", () => {
  expect(
    transformTransaction(
      {
        uuid: "tx-1",
        date: "2026-08-01",
        amount: "25.00",
        currency: "EUR",
        description: "Payroll",
      },
      "acc-1",
      "depository",
      "EUR",
    ),
  ).toMatchObject({
    id: "tx-1",
    amount: 25,
    date: "2026-08-01",
    status: "posted",
    category: "income",
    name: "Payroll",
  });
});
