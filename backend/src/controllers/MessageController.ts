import { Request, Response } from "express";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";

// ✅ NOVOS SERVIÇOS OTIMIZADOS
import LazyListMessagesService from "../services/MessageServices/LazyListMessagesService";
import LazySearchService from "../services/MessageServices/LazySearchService";
import MessageContextService from "../services/MessageServices/MessageContextService";

// Serviços existentes
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import database from "../database";
import { QueryTypes } from "sequelize";

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

// =================================================================
// NOVAS FUNÇÕES OTIMIZADAS
// =================================================================

// 📱 CHAT COM SCROLL INFINITO
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
    console.log(`📱 Lazy loading messages for ticket ${ticketId}, direction: ${direction}`);
    
    const result = await LazyListMessagesService({
      ticketId: parseInt(ticketId, 10),
      direction,
      cursorMessageId,
      cursorCreatedAt,
      limit: parseInt(limit, 10)
    });

    if (direction === 'initial') {
      try {
        const ticket = await ShowTicketService(ticketId);
        SetTicketMessagesAsRead(ticket);
      } catch (ticketError: any) {
        console.warn('Could not mark messages as read:', ticketError.message);
      }
    }

    console.log(`✅ Lazy load completed: ${result.messages.length} messages loaded`);

    return res.json({
      messages: result.messages,
      hasMore: result.hasMore,
      cursors: result.cursors,
      direction: result.direction
    });
    
  } catch (error: any) {
    console.error(`❌ Error in lazy message loading:`, error);
    return res.status(500).json({ 
      error: "Erro ao carregar mensagens",
      details: error.message 
    });
  }
};

// 🔍 BUSCA COM SCROLL INFINITO
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
    console.log(`🔍 Lazy search in ticket ${ticketId}: "${searchTerm}" (page ${page})`);
    
    // ✅ O serviço agora retorna { messages, hasMore }
    const result = await LazySearchService({
      ticketId: parseInt(ticketId, 10),
      searchParam: searchTerm.trim(),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      dateFrom,
      dateTo,
      fromMe: fromMe ? fromMe === 'true' : undefined,
      mediaType
    });

    console.log(`✅ Lazy search completed: ${result.messages.length} results found`);
    
    // ✅ A resposta para o frontend agora é mais enxuta, sem o `count` total.
    return res.json({
      messages: result.messages,
      hasMore: result.hasMore,
      page: parseInt(page, 10)
    });
    
  } catch (error: any) {
    console.error(`❌ Error in lazy search:`, error);
    return res.status(500).json({ 
      error: "Erro na busca de mensagens",
      details: error.message 
    });
  }
};

// 🎯 NAVEGAR PARA MENSAGEM ESPECÍFICA
export const getMessageContext = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, messageId } = req.params;
  const { contextSize = '10' } = req.query as { contextSize?: string };

  try {
    console.log(`🎯 Getting context for message ${messageId} in ticket ${ticketId}`);
    
    const result = await MessageContextService({
      ticketId: parseInt(ticketId, 10),
      messageId,
      contextSize: parseInt(contextSize, 10)
    });

    try {
      const ticket = await ShowTicketService(ticketId);
      SetTicketMessagesAsRead(ticket);
    } catch (ticketError: any) {
      console.warn('Could not mark messages as read:', ticketError.message);
    }

    console.log(`✅ Context loaded: ${result.messages.length} messages around target`);

    return res.json({
      messages: result.messages,
      targetMessage: result.targetMessage,
      targetIndex: result.targetIndex,
      cursors: result.cursors,
      contextInfo: result.contextInfo
    });
    
  } catch (error: any) {
    console.error(`❌ Error getting message context:`, error);
    return res.status(500).json({ 
      error: "Erro ao buscar contexto da mensagem",
      details: error.message 
    });
  }
};

// 📊 METADADOS DO TICKET (info rápida sem carregar mensagens)
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
    console.error(`❌ Error getting ticket info:`, error);
    return res.status(500).json({ 
      error: "Erro ao buscar informações do ticket" 
    });
  }
};

// =================================================================
// FUNÇÕES EXISTENTES MANTIDAS
// =================================================================

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  
  try {
    const ticket = await ShowTicketService(ticketId);
    SetTicketMessagesAsRead(ticket);
    
    if (medias) {
      await Promise.all(medias.map(async (media: Express.Multer.File) => {
        await SendWhatsAppMedia({ media, ticket });
      }));
    } else {
      await SendWhatsAppMessage({ body, ticket, quotedMsg });
    }
    
    return res.send();
  } catch (error) {
    console.error("❌ Error storing message:", error);
    return res.status(500).json({ error: "Erro ao enviar mensagem" });
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
  } catch (error) {
    console.error("❌ Error removing message:", error);
    return res.status(500).json({ error: "Erro ao remover mensagem" });
  }
};

// =================================================================
// COMPATIBILIDADE: Endpoints antigos redirecionados
// =================================================================

export const index = async (req: Request, res: Response): Promise<Response> => {
  console.log("⚠️ Using deprecated endpoint. Please migrate to /lazy");
  req.query.direction = 'initial';
  return lazyIndex(req, res);
};

export const searchMessages = async (req: Request, res: Response): Promise<Response> => {
  console.log("⚠️ Using deprecated search endpoint. Please migrate to /lazy-search");
  return lazySearch(req, res);
};
