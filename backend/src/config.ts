import { z } from 'zod';
const optionalUrl = z.preprocess(
  value => (value === '' ? undefined : value),
  z.string().url().optional()
);
const booleanValue = z.preprocess(
  value => value === true || value === 'true',
  z.boolean().default(false)
);
const positiveInteger = z.coerce.number().int().positive().optional();
const ConfigSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:3001'),
    OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
    OPENAI_API_KEY: z.string().default(''),
    OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
    GITHUB_APP_ID: z.string().default(''),
    GITHUB_APP_SLUG: z.string().default(''),
    GITHUB_INSTALLATION_ID: z.string().default(''),
    GITHUB_PRIVATE_KEY_PATH: z.string().default(''),
    GITHUB_WEBHOOK_SECRET: z.string().default(''),
    GITHUB_WEBHOOK_PROXY_URL: optionalUrl,
    GITHUB_TARGET_URL: optionalUrl,
    CONVEX_URL: z.string().url().or(z.literal('')).default(''),
    AUTH_SECRET: z.string().default('dev-secret-change-me'),
    AUTH_BRIDGE_SECRET: z.string().default(''),
    USERS_DB_PATH: z.string().default('./data/users.db'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    ARTIFACT_DIR: z.string().default('./data/artifacts'),
    PLANNER_AGENTS: z.string().default('smoke,functional,accessibility'),
    DAYTONA_API_KEY: z.string().default(''),
    DAYTONA_API_URL: optionalUrl,
    DAYTONA_TARGET: z.string().optional(),
    DAYTONA_SNAPSHOT: z.string().optional(),
    DAYTONA_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(900),
    GCS_BUCKET: z.string().default(''),
    GCS_PREFIX: z.string().default('freebug'),
    GCS_PUBLIC_BASE_URL: optionalUrl,
    SMTP_URL: z.string().default(''),
    SMTP_FROM: z.string().default('Freebug <noreply@freebug.local>'),
    BILLING_ENABLED: booleanValue,
    DODO_API_KEY: z.string().default(''),
    DODO_WEBHOOK_KEY: z.string().default(''),
    DODO_ENVIRONMENT: z.enum(['test_mode', 'live_mode']).default('test_mode'),
    DODO_STARTER_PRODUCT_ID: z.string().default(''),
    DODO_SCALE_PRODUCT_ID: z.string().default(''),
    DODO_STARTER_CREDITS: positiveInteger,
    DODO_SCALE_CREDITS: positiveInteger,
    RUN_CREDIT_COST: positiveInteger,
    DODO_RETURN_URL: optionalUrl,
  })
  .superRefine((config, context) => {
    if (!config.BILLING_ENABLED) return;
    for (const key of [
      'DODO_API_KEY',
      'DODO_WEBHOOK_KEY',
      'DODO_STARTER_PRODUCT_ID',
      'DODO_SCALE_PRODUCT_ID',
      'DODO_STARTER_CREDITS',
      'DODO_SCALE_CREDITS',
      'RUN_CREDIT_COST',
      'DODO_RETURN_URL',
    ] as const)
      if (!config[key])
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'required when billing is enabled',
        });
  });
export type Config = z.infer<typeof ConfigSchema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config =>
  ConfigSchema.parse(env);
