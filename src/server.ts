import { log } from "console";
import { createServer, Server } from "http";
import app from "./app/app";
import config from "./app/config";
import { isSwaggerEnabled } from "./app/docs";
import { getServerIp } from "./app/utils/getServerIp";

let server: Server;

const main = () => {
  server = createServer(app);

  server.listen(config.port, () => {
    const baseUrl = `http://${getServerIp()}:${config.port}`;
    console.log(`Server running on port: ${config.port}`);
    console.log(`API base URL: ${baseUrl}/api/v1`);
    if (isSwaggerEnabled()) console.log(`Swagger docs: ${baseUrl}/api-docs`);
  });
};

main();

process.on("uncaughtException", error => {
  log(error);
  if (server) {
    server.close(() => {
      console.log("Server closed due to uncaught exception");
      process.exit(1);
    });
  }
});

process.on("unhandledRejection", error => {
  log(error);
  if (server) {
    server.close(() => {
      console.log("Server closed due to unhandled rejection");
      process.exit(1);
    });
  }
});
