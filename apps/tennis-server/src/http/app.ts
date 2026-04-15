import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import type { AppConfig } from "../config.js";
import {
  InMemoryAuthRepo,
  InMemoryAvailabilityRepo,
  InMemoryDeviceTokenRepo,
  InMemoryMatchRepo,
  InMemoryNotificationDeliveryRepo,
  InMemoryNotificationRepo,
  InMemoryPlayerPhoneRepo,
  InMemoryPlayerRepo,
  InMemoryPoolRepo,
  InMemoryTournamentRepo
} from "../repo/memory.js";
import {
  SupabaseAuthRepo,
  SupabaseAvailabilityRepo,
  SupabaseDeviceTokenRepo,
  SupabaseMatchRepo,
  SupabaseNotificationDeliveryRepo,
  SupabaseNotificationRepo,
  SupabasePlayerPhoneRepo,
  SupabasePlayerRepo,
  SupabasePoolRepo,
  SupabaseTournamentRepo
} from "../repo/supabase.js";
import type { AuthRepo, DeviceTokenRepo, NotificationDeliveryRepo, NotificationRepo, PlayerPhoneRepo, PlayerRepo, AvailabilityRepo, MatchRepo, TournamentRepo, PoolRepo } from "../repo/interfaces.js";
import { TournamentEngine } from "../services/tournamentEngine.js";
import { createRoutes } from "./routes.js";
import { createFrontendRoutes } from "./frontendRoutes.js";
import { seedDemoPlayers, seedDemoTournaments } from "./seed.js";

export async function createApp(config: AppConfig): Promise<ReturnType<typeof express>> {
  const app = express();
  const logger = pino({ level: config.NODE_ENV === "production" ? "info" : "debug" });

  app.disable("x-powered-by");
  app.use(helmet());

  const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
      credentials: false
    })
  );
  app.use(express.json({ limit: "64kb" }));
  const httpLogger = (pinoHttp as unknown as (args: { logger: pino.Logger }) => express.RequestHandler)({ logger });
  app.use(httpLogger);

  // Repos — use Supabase if configured, otherwise fall back to in-memory
  let auth: AuthRepo;
  let players: PlayerRepo;
  let availability: AvailabilityRepo;
  let matches: MatchRepo;
  let tournaments: TournamentRepo;
  let pool: PoolRepo;
  let notifications: NotificationRepo;
  let notificationDeliveries: NotificationDeliveryRepo;
  let playerPhones: PlayerPhoneRepo;
  let deviceTokens: DeviceTokenRepo;

  const useSupabase = config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY;

  if (useSupabase) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!);
    logger.info("Using Supabase database");

    auth = new SupabaseAuthRepo(supabase);
    players = new SupabasePlayerRepo(supabase);
    availability = new SupabaseAvailabilityRepo(supabase);
    matches = new SupabaseMatchRepo(supabase);
    tournaments = new SupabaseTournamentRepo(supabase);
    pool = new SupabasePoolRepo(supabase);
    notifications = new SupabaseNotificationRepo(supabase);
    notificationDeliveries = new SupabaseNotificationDeliveryRepo(supabase);
    playerPhones = new SupabasePlayerPhoneRepo(supabase);
    deviceTokens = new SupabaseDeviceTokenRepo(supabase);
  } else {
    logger.info("Using in-memory database (no SUPABASE_URL set)");

    const memAuth = new InMemoryAuthRepo();
    const memPlayers = new InMemoryPlayerRepo();
    const memAvailability = new InMemoryAvailabilityRepo();
    const memMatches = new InMemoryMatchRepo();
    const memTournaments = new InMemoryTournamentRepo();
    const memPool = new InMemoryPoolRepo();

    auth = memAuth;
    players = memPlayers;
    availability = memAvailability;
    matches = memMatches;
    tournaments = memTournaments;
    pool = memPool;
    notifications = new InMemoryNotificationRepo();
    notificationDeliveries = new InMemoryNotificationDeliveryRepo();
    playerPhones = new InMemoryPlayerPhoneRepo();
    deviceTokens = new InMemoryDeviceTokenRepo();

    // Seed demo data (in-memory only)
    void seedDemoPlayers(memAuth, memPlayers, memAvailability).then(() => {
      void seedDemoTournaments(memTournaments, memMatches, memAuth);
    });
  }

  // Tournament engine (created before routes so routes can trigger activation)
  const engine = new TournamentEngine({ pool, tournaments, matches, players, availability, notifications, notificationDeliveries, playerPhones, deviceTokens, logger });
  engine.start();
  process.on("SIGTERM", () => { engine.stop(); });
  process.on("SIGINT", () => { engine.stop(); });

  // Frontend-compatible routes (work with live Supabase schema)
  // Must be mounted BEFORE /v1 so /v1/fe/* isn't caught by the /v1 auth middleware
  if (useSupabase) {
    const { createClient } = await import("@supabase/supabase-js");
    const frontendSupabase = createClient(config.SUPABASE_URL!, config.SUPABASE_SERVICE_ROLE_KEY!);
    app.use("/v1/fe", createFrontendRoutes({ config, supabase: frontendSupabase }));
    logger.info("Frontend routes mounted at /v1/fe");
  }

  app.use(
    "/v1",
    createRoutes({ config, auth, players, availability, matches, tournaments, pool, engine })
  );

  // Global error handler — catches sync errors and, with express-async-errors,
  // also catches unhandled promise rejections from async route handlers.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // If headers already sent, delegate to Express default handler
    if (res.headersSent) {
      _next(err);
      return;
    }

    logger.error({ err }, "unhandled_error");

    const status = typeof (err as { status?: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
    const message = status < 500 && err instanceof Error ? err.message : "internal_error";

    res.status(status).json({ error: message });
  });

  return app;
}
