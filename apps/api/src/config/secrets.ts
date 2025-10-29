import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

/**
 * Load secrets from AWS Secrets Manager into process.env at cold start.
 * This is a no-op locally (when SECRETS_NAME is not provided).
 *
 * Supported keys in the secret JSON:
 * - JWT_SECRET
 * - DATABASE_URL (optional)
 */
export async function initSecrets(): Promise<void> {
  const secretName = process.env.SECRETS_NAME;
  if (!secretName) return; // Nothing to do (local/dev)

  // If JWT is already set, skip fetching to avoid extra cold-start cost
  if (process.env.JWT_SECRET) return;

  try {
    const client = new SecretsManagerClient({});
    const res = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    const raw = res.SecretString ?? (res.SecretBinary ? Buffer.from(res.SecretBinary as any).toString("utf-8") : undefined);
    if (!raw) return;
    let parsed: Record<string, string> | undefined;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Allow plain-text secret containing just the JWT value
      parsed = { JWT_SECRET: raw } as Record<string, string>;
    }

    // Set env only if missing to allow overrides
    if (parsed?.JWT_SECRET && !process.env.JWT_SECRET) {
      process.env.JWT_SECRET = parsed.JWT_SECRET;
    }
    if (parsed?.DATABASE_URL && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = parsed.DATABASE_URL;
    }
  } catch (err) {
    // Fail-soft: leave env untouched; downstream routes will surface config errors
    console.error("[secrets] Failed to fetch from Secrets Manager:", (err as Error).message);
  }
}
