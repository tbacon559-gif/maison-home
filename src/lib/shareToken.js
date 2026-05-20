// 256-bit cryptographic random token, base64url-encoded (no padding).
// Used to identify a share_links row in the URL. Generated client-side;
// the row is owner-inserted via Supabase with RLS enforcing owner_id.

export function generateShareToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url: standard base64 with + → -, / → _, and no = padding
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
