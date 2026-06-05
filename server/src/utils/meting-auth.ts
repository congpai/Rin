export async function createMetingAuthToken(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildMetingAuthToken(
  secret: string,
  server: string,
  type: string,
  id: string,
): Promise<string> {
  return createMetingAuthToken(secret, `${server}${type}${id}`);
}
