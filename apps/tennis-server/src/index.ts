import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import { createApp } from "./http/app.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(currentDir, "../.env") });

const config = getConfig();
const app = await createApp(config);

app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`@rally/server listening on http://localhost:${config.PORT}`);
});
