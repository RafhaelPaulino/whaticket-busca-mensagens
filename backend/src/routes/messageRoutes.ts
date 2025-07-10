        import { Router } from "express";
        import multer from "multer";
        import isAuth from "../middleware/isAuth";
        import uploadConfig from "../config/upload";

        // Importa as funções específicas do MessageController como named exports
        import {
          index,
          store,
          remove,
          searchMessages // <-- Adicione searchMessages aqui
        } from "../controllers/MessageController";

        const messageRoutes = Router();

        const upload = multer(uploadConfig);

        // Rota para buscar mensagens dentro de um ticket específico
        // Ex: GET /messages/search/123?q=termo&page=1&limit=40
        messageRoutes.get("/messages/search/:ticketId", isAuth, searchMessages);

        messageRoutes.get("/messages/:ticketId", isAuth, index);

        messageRoutes.post(
          "/messages/:ticketId",
          isAuth,
          upload.array("medias"),
          store
        );

        messageRoutes.delete("/messages/:messageId", isAuth, remove);

        export default messageRoutes;
        