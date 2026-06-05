import { createRequire } from "node:module";
import nodeCrypto from "node:crypto";

type PatchedCrypto = typeof nodeCrypto & { __rinMetingCryptoShim?: boolean };

function normalizeCipherIv(algorithm: string, iv: unknown) {
  if (iv == null && algorithm.toLowerCase().includes("ecb")) {
    return Buffer.alloc(0);
  }
  return iv;
}

function applyMetingCryptoCompat(cryptoModule: PatchedCrypto) {
  if (cryptoModule.__rinMetingCryptoShim) {
    return;
  }

  const patch = (factory: (...args: unknown[]) => unknown) => {
    const bound = factory.bind(cryptoModule);
    return (algorithm: string, key: unknown, iv: unknown, options?: unknown) =>
      bound(algorithm, key, normalizeCipherIv(algorithm, iv), options);
  };

  cryptoModule.createCipheriv = patch(
    cryptoModule.createCipheriv as (...args: unknown[]) => unknown,
  ) as typeof cryptoModule.createCipheriv;
  cryptoModule.createDecipheriv = patch(
    cryptoModule.createDecipheriv as (...args: unknown[]) => unknown,
  ) as typeof cryptoModule.createDecipheriv;
  cryptoModule.__rinMetingCryptoShim = true;
}

applyMetingCryptoCompat(nodeCrypto as PatchedCrypto);

try {
  applyMetingCryptoCompat(createRequire(import.meta.url)("crypto") as PatchedCrypto);
} catch {
  // Workers bundle may not expose a separate CommonJS crypto entry.
}

export {};
