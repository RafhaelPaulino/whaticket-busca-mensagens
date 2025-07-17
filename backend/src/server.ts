import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import StartAllWhatsAppsSessions from "./services/WbotServices/StartAllWhatsAppsSessions"; 

const server = app.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

initIO(server);
StartAllWhatsAppsSessions(); 

process.on("SIGINT", () => {
  logger.info("Server shutting down...");
  server.close(() => {
    logger.info("Server gracefully shut down.");
    process.exit(0);
  });
});
