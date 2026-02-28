import cors from "cors";
import express from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import type { AppConfig } from "../config.js";
import {
  InMemoryAccountabilityRepo,
  InMemoryChargeHistoryRepo,
  InMemoryGoalReportRepo,
  InMemoryLedgerRepo,
  InMemoryUserRepo,
  InMemoryWindowRepo
} from "../repo/memory.js";
import { createRoutes } from "./routes.js";

export function createApp(config: AppConfig): ReturnType<typeof express> {
  const app = express();
  const logger = pino({ level: config.NODE_ENV === "production" ? "info" : "debug" });

  app.disable("x-powered-by");
  app.use(helmet());
  const allowedOrigins = config.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins, credentials: false }));
  app.use(express.json({ limit: "64kb" }));
  const httpLogger = (pinoHttp as unknown as (args: { logger: pino.Logger }) => express.RequestHandler)({ logger });
  app.use(httpLogger);

  const users = new InMemoryUserRepo();
  const windows = new InMemoryWindowRepo();
  const ledger = new InMemoryLedgerRepo();
  const accountability = new InMemoryAccountabilityRepo();
  const goalReports = new InMemoryGoalReportRepo();
  const chargeHistory = new InMemoryChargeHistoryRepo();

  app.use(
    "/v1",
    createRoutes({
      config,
      users,
      windows,
      ledger,
      accountability,
      goalReports,
      chargeHistory
    })
  );

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "unhandled_error");
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
