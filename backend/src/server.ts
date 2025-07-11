import gracefulShutdown from "http-graceful-shutdown";
import { createServer } from "http";
import app from "./app";
import { initIO } from "./libs/socket";
import { logger } from "./utils/logger";
import { StartAllWhatsAppsSessions } from "./services/WbotServices/StartAllWhatsAppsSessions";

// Criar servidor HTTP explicitamente
const server = createServer(app);

// Inicializar Socket.IO com CORS
initIO(server);

// Iniciar servidor
server.listen(process.env.PORT, () => {
  logger.info(`Server started on port: ${process.env.PORT}`);
});

// Inicializar WhatsApp sessions
StartAllWhatsAppsSessions();

// Graceful shutdown
gracefulShutdown(server);