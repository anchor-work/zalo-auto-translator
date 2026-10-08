import { createApiServer } from "./app.mjs";

const port = Number.parseInt(process.env.PORT || "8787", 10);
const host = process.env.HOST || (process.env.K_SERVICE ? "0.0.0.0" : "127.0.0.1");
const server = createApiServer();

server.listen(port, host, () => {
  console.log(`Zalo translation API listening on http://${host}:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
