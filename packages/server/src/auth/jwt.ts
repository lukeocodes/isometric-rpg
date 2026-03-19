import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { config } from "../config.js";

export function createGameJwt(accountId: string, email: string): string {
  return jwt.sign(
    { sub: accountId, email, jti: randomUUID() },
    config.jwt.secret,
    { expiresIn: `${config.jwt.expiryHours}h` },
  );
}

export function decodeGameJwt(token: string): { sub: string; email: string; jti: string } {
  return jwt.verify(token, config.jwt.secret) as any;
}
