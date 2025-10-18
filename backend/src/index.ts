import "dotenv/config";
import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { WorldRoom } from "./rooms/WorldRoom";
import { initialisePostgres } from "./database/postgres";
import { initialiseRedis } from "./database/redis";

async function bootstrap() {
  await initialisePostgres();
  await initialiseRedis();

  const app = express();
  app.use(express.json());
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  const port = Number(process.env.PORT ?? 2567);
  const server = createServer(app);
  const gameServer = new Server({ server });

  gameServer.define("world", WorldRoom).enableRealtimeListing();

  app.use("/colyseus", monitor());

  server.listen(port, () => {
    console.log(`CoMutiNy backend listening on :${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
