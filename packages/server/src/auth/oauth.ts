import { config } from "../config.js";

export async function exchangeCode(code: string, codeVerifier: string): Promise<any> {
  const res = await fetch(`${config.oauth.issuer}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.oauth.redirectUri,
      client_id: config.oauth.clientId,
      code_verifier: codeVerifier,
    }),
  });
  if (!res.ok) throw new Error("Token exchange failed");
  return res.json();
}

export async function getUserinfo(accessToken: string): Promise<any> {
  const res = await fetch(`${config.oauth.issuer}/oauth2/userInfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Userinfo fetch failed");
  return res.json();
}
