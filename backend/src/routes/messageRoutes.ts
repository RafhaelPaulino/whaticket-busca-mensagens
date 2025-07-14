import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

// Importamos todas as funções necessárias, incluindo a nova 'getContext'
import {
  index,
  store,
  remove,
  searchMessages,
  getContext
} from "../controllers/MessageController";

const messageRoutes = Router();
const upload = multer(uploadConfig);

// Rota de busca otimizada
messageRoutes.get("/messages/search/:ticketId", isAuth, searchMessages);

// NOVA ROTA para buscar o contexto de uma mensagem
messageRoutes.get("/messages/context/:messageId", isAuth, getContext);

// Suas rotas existentes
messageRoutes.get("/messages/:ticketId", isAuth, index);

messageRoutes.post(
  "/messages/:ticketId",
  isAuth,
  upload.array("medias"),
  store
);

messageRoutes.delete("/messages/:messageId", isAuth, remove);

export default messageRoutes;
