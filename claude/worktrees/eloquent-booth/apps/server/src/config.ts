import { z } from "zod";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  AUTH_TOKEN_SECRET: z.string().min(32),
  WINDOW_TOKEN_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  COACH_API_TIMEOUT_MS: z.coerce.number().int().positive().default(4500),
  GRACE_MISSES_PER_MONTH: z.coerce.number().int().nonnegative().default(2),
  MONTHLY_CHARGE_CAP_CENTS: z.coerce.number().int().positive().default(1500),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default("")
});

export type AppConfig = z.infer<typeof configSchema>;

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }
  return parsed.data;
}
