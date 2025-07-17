import { Request, Response } from "express";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import database from "../database";
import { QueryTypes } from "sequelize";
import { logger } from "../utils/logger";
import AppError from "../errors/AppError";

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

export const lazyIndex = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { 
    direction = 'initial',
    cursorMessageId,
    cursorCreatedAt,
    limit = '20'
  } = req.query as {
    direction?: 'up' | 'down' | 'initial';
    cursorMessageId?: string;
    cursorCreatedAt?: string;
    limit?: string;
  };

  try {
    logger.info(`📱 Lazy loading messages for ticket ${ticketId}, direction: ${direction}`);
    
    
    const result = await ListMessagesService({
      pageNumber: 1, 
      ticketId: parseInt(ticketId, 10)
    });

    if (direction === 'initial') {
      try {
        const ticket = await ShowTicketService(ticketId);
        await SetTicketMessagesAsRead(ticket);
      } catch (ticketError: any) {
        logger.warn('Could not mark messages as read:', ticketError.message);
      }
    }

    logger.info(`✅ Lazy load completed: ${result.messages.length} messages loaded`);

    return res.json({
      messages: result.messages,
      hasMore: result.count > result.messages.length,
      cursors: {
        before: result.messages.length > 0 ? result.messages[0].id : null,
        after: result.messages.length > 0 ? result.messages[result.messages.length - 1].id : null,
      },
      direction: direction 
    });
    
  } catch (error: any) {
    logger.error(`❌ Error in lazy message loading:`, error);
    return res.status(500).json({ 
      error: "Erro ao carregar mensagens",
      details: error.message 
    });
  }
};

export const lazySearch = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { 
    q: searchTerm, 
    page = '1',
    limit = '40',
    dateFrom,
    dateTo,
    fromMe,
    mediaType
  } = req.query as { 
    q: string;
    page?: string;
    limit?: string;
    dateFrom?: string;
    dateTo?: string;
    fromMe?: string;
    mediaType?: string;
  };

  if (!searchTerm || searchTerm.trim().length < 2) {
    return res.status(400).json({ 
      error: "Termo de busca deve ter pelo menos 2 caracteres" 
    });
  }

  try {
    logger.info(`🔍 Lazy search in ticket ${ticketId}: "${searchTerm}" (page ${page})`);
    
   
    const result = await ListMessagesService({
      ticketId: parseInt(ticketId, 10),
      pageNumber: parseInt(page, 10),
      
    });

    logger.info(`✅ Lazy search completed: ${result.messages.length} results found`);
    
    return res.json({
      messages: result.messages,
      hasMore: result.count > result.messages.length,
      page: parseInt(page, 10)
    });
    
  } catch (error: any) {
    logger.error(`❌ Error in lazy search:`, error);
    return res.status(500).json({ 
      error: "Erro na busca de mensagens",
      details: error.message 
    });
  }
};

export const getMessageContext = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, messageId } = req.params;
  const { contextSize = '10' } = req.query as { contextSize?: string };

  try {
    logger.info(`🎯 Getting context for message ${messageId} in ticket ${ticketId}`);
    
    
    const result = await ListMessagesService({
      ticketId: parseInt(ticketId, 10),
      pageNumber: 1,
    });

    try {
      const ticket = await ShowTicketService(ticketId);
      await SetTicketMessagesAsRead(ticket);
    } catch (ticketError: any) {
      logger.warn('Could not mark messages as read:', ticketError.message);
    }

    logger.info(`✅ Context loaded: ${result.messages.length} messages around target`);

    return res.json({
      messages: result.messages,
      targetMessage: result.messages.find(msg => msg.id === messageId),
      targetIndex: result.messages.findIndex(msg => msg.id === messageId),
      cursors: {
        before: result.messages.length > 0 ? result.messages[0].id : null,
        after: result.messages.length > 0 ? result.messages[result.messages.length - 1].id : null,
      },
      contextInfo: { /* ... */ }
    });
    
  } catch (error: any) {
    logger.error(`❌ Error getting message context:`, error);
    return res.status(500).json({ 
      error: "Erro ao buscar contexto da mensagem",
      details: error.message 
    });
  }
};

export const getTicketInfo = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  try {
    const ticket = await ShowTicketService(ticketId);
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM Messages
      WHERE ticketId = ?
    `;
    
    const countResult = await database.query(countQuery, {
      type: QueryTypes.SELECT,
      replacements: [ticketId]
    }) as Array<{total: number}>;

    return res.json({
      ticket,
      messageCount: countResult[0]?.total || 0,
      hasMessages: (countResult[0]?.total || 0) > 0
    });
    
  } catch (error: any) {
    return res.status(500).json({ 
      error: "Erro ao buscar informações do ticket" 
    });
  }
};


export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  
  try {
    const ticket = await ShowTicketService(ticketId);
    await SetTicketMessagesAsRead(ticket); 
    
    if (medias && medias.length > 0) {
      logger.info(`[MessageController] Enviando m├¡dia(s) para ticket ${ticket.id}. Quantidade: ${medias.length}`);
      await Promise.all(medias.map(async (media: Express.Multer.File) => {
        await SendWhatsAppMedia({ 
          whatsappId: ticket.whatsappId,
          contactId: ticket.contact.number, 
          media: {
            data: media.buffer,
            mimetype: media.mimetype,
            filename: media.originalname
          },
          caption: body 
        });

     
        const messageData = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
          ticketId: ticket.id,
          contactId: ticket.contact.id,
          body: body || media.originalname,
          fromMe: true,
          mediaUrl: media.filename,
          mediaType: media.mimetype.split("/")[0],
          quotedMsgId: quotedMsg ? quotedMsg.id : undefined,
          read: true,
          ack: 0 
        };
        const newMessage = await CreateMessageService({ messageData });
        const io = getIO();
        io.to(ticket.id.toString()).emit("appMessage", { action: "create", message: newMessage, ticket });
        io.to(ticket.status).emit(`ticket-${ticket.id}`, { action: "update", ticket });
        logger.info(`[MessageController] Mensagem de m├¡dia ${newMessage.id} criada no DB e emitida para frontend.`);
      }));
    } else {
      logger.info(`[MessageController] Enviando mensagem de texto para ticket ${ticket.id}. Corpo: ${body}`);
      await SendWhatsAppMessage({ 
        whatsappId: ticket.whatsappId,
        contactId: ticket.contact.number, 
        body: body,
        quotedMsgId: quotedMsg ? quotedMsg.id : undefined 
      });

     
      const messageData = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, 
        ticketId: ticket.id,
        contactId: ticket.contact.id,
        body: body,
        fromMe: true,
        quotedMsgId: quotedMsg ? quotedMsg.id : undefined,
        read: true,
        ack: 0 
      };
      const newMessage = await CreateMessageService({ messageData });
      const io = getIO();
      io.to(ticket.id.toString()).emit("appMessage", { action: "create", message: newMessage, ticket });
      io.to(ticket.status).emit(`ticket-${ticket.id}`, { action: "update", ticket });
      logger.info(`[MessageController] Mensagem de texto ${newMessage.id} criada no DB e emitida para frontend.`);
    }
    
    return res.json({ id: ticket.id }); 
  } catch (error: any) {
    logger.error(`[MessageController] Erro ao enviar mensagem: ${error.message || error}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  
  try {
    const message = await DeleteWhatsAppMessage(messageId);
    const io = getIO();
    io.to(message.ticketId.toString()).emit("appMessage", { 
      action: "update", 
      message 
    });
    
    return res.send();
  } catch (error: any) {
    logger.error(`[MessageController] Erro ao remover mensagem: ${error.message || error}`);
    return res.status(500).json({ error: "Erro ao remover mensagem" });
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  logger.warn("⚠️ Using deprecated endpoint. Please migrate to /lazy");
  req.query.direction = 'initial';
  return lazyIndex(req, res);
};

export const searchMessages = async (req: Request, res: Response): Promise<Response> => {
  logger.warn("⚠️ Using deprecated search endpoint. Please migrate to /lazy-search");
  return lazySearch(req, res);
};
