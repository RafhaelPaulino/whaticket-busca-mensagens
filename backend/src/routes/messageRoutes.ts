import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

// ✅ IMPORTAÇÕES ATUALIZADAS
import {
  index,
  store,
  remove,
  searchMessages,
  getTicketInfo,
  lazyIndex,
  lazySearch,
  getMessageContext
} from "../controllers/MessageController";

const messageRoutes = Router();
const upload = multer(uploadConfig);

// 🚀 NOVAS ROTAS OTIMIZADAS (lazy loading)
messageRoutes.get("/messages/:ticketId/lazy", isAuth, lazyIndex);
messageRoutes.get("/messages/:ticketId/lazy-search", isAuth, lazySearch);
messageRoutes.get("/messages/:ticketId/context/:messageId", isAuth, getMessageContext);
messageRoutes.get("/messages/:ticketId/info", isAuth, getTicketInfo);

// 🔄 ROTAS DE COMPATIBILIDADE (redirecionadas para versões otimizadas)
messageRoutes.get("/messages/search/:ticketId", isAuth, searchMessages);
messageRoutes.get("/messages/:ticketId", isAuth, index);

// ✅ ROTAS EXISTENTES MANTIDAS
messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  upload.array("medias"),
  store
);

messageRoutes.delete("/messages/:messageId", isAuth, remove);

export default messageRoutes;