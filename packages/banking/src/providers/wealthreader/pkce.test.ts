import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { generatePkce, hexAlnum } from "./pkce";

test("hexAlnum is 82 hex chars", () => {
  expect(hexAlnum()).toMatch(/^[0-9a-f]{82}$/);
});

test("challenge is sha256 hex of the hex verifier", () => {
  const challenge = generatePkce("bbva");
  expect(challenge.nonce).toMatch(/^[0-9a-f]{82}$/);
  expect(challenge.codeVerifier).toMatch(/^[0-9a-f]{82}$/);
  expect(challenge.challenge).toBe(
    createHash("sha256").update(challenge.codeVerifier).digest("hex"),
  );
  expect(challenge.wrConf).toMatch(/^[0-9a-f]+$/);
});
