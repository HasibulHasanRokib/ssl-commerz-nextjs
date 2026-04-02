const requiredEnvVars = [
  "BASE_URL",
  "SSL_STORE_ID",
  "SSL_STORE_PASSWORD",
  "SSL_IS_LIVE",
  "DATABASE_URL",
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(` Missing environment variable: ${key}`);
  }
}

export const env = {
  BASE_URL: process.env.BASE_URL!,
  SSL_STORE_ID: process.env.SSL_STORE_ID!,
  SSL_STORE_PASSWORD: process.env.SSL_STORE_PASSWORD!,
  SSL_IS_LIVE: process.env.SSL_IS_LIVE === "true",
};
