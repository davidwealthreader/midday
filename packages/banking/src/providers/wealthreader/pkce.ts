import { createHash, randomBytes, randomInt } from "node:crypto";

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomAlnum(length = 41): string {
  let value = "";
  for (let i = 0; i < length; i++) {
    value += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return value;
}

export function hexAlnum(length = 41): string {
  return Buffer.from(randomAlnum(length), "ascii").toString("hex");
}

export type WealthReaderPkce = {
  nonce: string;
  wrState: string;
  codeVerifier: string;
  challenge: string;
  wrConf: string;
};

export function generatePkce(entityCode: string): WealthReaderPkce {
  const nonce = hexAlnum();
  const wrState = hexAlnum();
  const codeVerifier = hexAlnum();
  const challenge = createHash("sha256").update(codeVerifier).digest("hex");
  const wrConf = Buffer.from(
    JSON.stringify({
      operation_id: `op_${randomBytes(8).toString("hex")}`,
      entities_to_display: entityCode ? [entityCode] : [],
      wait_full_response: true,
    }),
    "utf8",
  ).toString("hex");

  return { nonce, wrState, codeVerifier, challenge, wrConf };
}
