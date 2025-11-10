import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SSMClient, GetParameterCommand, GetParametersCommand } from "@aws-sdk/client-ssm";

/**
 * Load secrets from AWS Secrets Manager or SSM Parameter Store into process.env at cold start.
 * This is a no-op locally (when neither SECRETS_NAME nor USE_AWS_SECRETS is provided).
 *
 * Secrets Manager mode (SECRETS_NAME):
 * - JWT_SECRET
 * - DATABASE_URL
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - ADMIN_EMAIL (optional)
 * - ADMIN_PASSWORD (optional)
 *
 * Parameter Store mode (USE_AWS_SECRETS=true):
 * - Reads from /helix/prod/* parameters (configurable via PARAMETER_PREFIX)
 * - ADMIN_EMAIL from /helix/prod/ADMIN_EMAIL
 * - ADMIN_PASSWORD from /helix/prod/ADMIN_PASSWORD
 * - JWT_SECRET from /helix/prod/JWT_SECRET (if present)
 */
export async function initSecrets(): Promise<void> {
  // Mode 1: AWS Secrets Manager (existing)
  const secretName = process.env.SECRETS_NAME;
  const useAwsSecrets = process.env.USE_AWS_SECRETS === 'true';
  
  console.log(`[secrets] initSecrets called - SECRETS_NAME: ${secretName}, NODE_ENV: ${process.env.NODE_ENV}`);
  
  if (!secretName && !useAwsSecrets) {
    console.log('[secrets] No SECRETS_NAME or USE_AWS_SECRETS, skipping');
    return; // Nothing to do (local/dev)
  }

  // Mode 2: SSM Parameter Store
  if (useAwsSecrets) {
    await loadFromParameterStore();
    return;
  }

  // If both JWT and DATABASE_URL are already set, skip fetching to avoid extra cold-start cost
  if (process.env.JWT_SECRET && process.env.DATABASE_URL) {
    console.log('[secrets] Both JWT_SECRET and DATABASE_URL already set, skipping fetch');
    return;
  }

  try {
    console.log(`[secrets] Fetching from Secrets Manager: ${secretName}`);
    const client = new SecretsManagerClient({});
    const res = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
    const raw = res.SecretString ?? (res.SecretBinary ? Buffer.from(res.SecretBinary as any).toString("utf-8") : undefined);
    if (!raw) {
      console.error('[secrets] No secret value returned');
      return;
    }
    let parsed: Record<string, string> | undefined;
    try {
      parsed = JSON.parse(raw);
      console.log(`[secrets] Parsed secret keys: ${parsed ? Object.keys(parsed).join(', ') : 'none'}`);
    } catch {
      // Allow plain-text secret containing just the JWT value
      parsed = { JWT_SECRET: raw } as Record<string, string>;
      console.log('[secrets] Using plain-text secret as JWT_SECRET');
    }

    // Set env only if missing to allow overrides
    if (parsed?.JWT_SECRET && !process.env.JWT_SECRET) {
      process.env.JWT_SECRET = parsed.JWT_SECRET;
      console.log('[secrets] Set JWT_SECRET from Secrets Manager');
    }
    if (parsed?.DATABASE_URL && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = parsed.DATABASE_URL;
      console.log('[secrets] Set DATABASE_URL from Secrets Manager');
    }
    if (parsed?.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = parsed.OPENAI_API_KEY;
      console.log('[secrets] Set OPENAI_API_KEY from Secrets Manager');
    }
    if (parsed?.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      process.env.ANTHROPIC_API_KEY = parsed.ANTHROPIC_API_KEY;
      console.log('[secrets] Set ANTHROPIC_API_KEY from Secrets Manager');
    }
    if (parsed?.ADMIN_EMAIL && !process.env.ADMIN_EMAIL) {
      process.env.ADMIN_EMAIL = parsed.ADMIN_EMAIL;
    }
    if (parsed?.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD) {
      process.env.ADMIN_PASSWORD = parsed.ADMIN_PASSWORD;
    }
  } catch (err) {
    // Fail-soft: leave env untouched; downstream routes will surface config errors
    console.error("[secrets] Failed to fetch from Secrets Manager:", (err as Error).message);
  }
}

/**
 * Load secrets from AWS Systems Manager Parameter Store
 */
async function loadFromParameterStore(): Promise<void> {
  try {
    const prefix = process.env.PARAMETER_PREFIX || '/helix/prod';
    const parameterNames = [
      `${prefix}/JWT_SECRET`,
      `${prefix}/ADMIN_EMAIL`,
      `${prefix}/ADMIN_PASSWORD`,
      `${prefix}/DATABASE_URL`
    ];

    const client = new SSMClient({});
    const result = await client.send(new GetParametersCommand({
      Names: parameterNames,
      WithDecryption: true
    }));

    if (result.Parameters) {
      for (const param of result.Parameters) {
        const key = param.Name?.split('/').pop(); // Get last part of path
        if (key && param.Value) {
          // Set env only if missing to allow overrides
          if (!process.env[key]) {
            process.env[key] = param.Value;
          }
        }
      }
    }
  } catch (err) {
    console.error("[secrets] Failed to fetch from Parameter Store:", (err as Error).message);
  }
}
