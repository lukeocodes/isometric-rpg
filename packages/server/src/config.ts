import "dotenv/config";

export const config = {
  oauth: {
    issuer: process.env.OAUTH_ISSUER || "https://id.dx.deepgram.com",
    clientId: process.env.OAUTH_CLIENT_ID || "",
    redirectUri: process.env.OAUTH_REDIRECT_URI || "http://localhost:5173/auth/callback",
  },
  postgres: {
    url: process.env.DATABASE_URL ||
      `postgresql://${process.env.POSTGRES_USER || "game"}:${process.env.POSTGRES_PASSWORD || "game_dev_password"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5433"}/${process.env.POSTGRES_DB || "game"}`,
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
  jwt: {
    secret: process.env.JWT_SECRET || "change_me_in_production",
    expiryHours: parseInt(process.env.JWT_EXPIRY_HOURS || "24"),
  },
  server: {
    host: process.env.SERVER_HOST || "0.0.0.0",
    port: parseInt(process.env.SERVER_PORT || "8000"),
  },
} as const;
