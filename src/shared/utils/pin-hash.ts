// SHA-256 hash of a client-portal PIN, computed client-side via the Web
// Crypto API so the plaintext PIN is never sent anywhere except at the
// moment it's typed — both the admin (setting a PIN) and the customer
// (logging in) hash it the same way before it touches the network, and only
// the hash is ever compared (see verify_portal_pin RPC).
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin.trim());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
