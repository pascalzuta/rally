import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8788),
  AUTH_TOKEN_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default("http://localhost:5174"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  SCHEDULER_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PRICE_MONTHLY: z.string().optional().default(""),
  STRIPE_PRICE_YEARLY: z.string().optional().default(""),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional()
});

export type AppConfig = z.infer<typeof configSchema>;

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }
  return parsed.data;
}
