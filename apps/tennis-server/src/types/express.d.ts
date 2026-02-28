import type { Player } from "@rally/core";

declare global {
  namespace Express {
    interface Request {
      player: Player;
    }
  }
}
