import { Request, Response } from "express";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";

// Serviços que o controller utiliza
import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import MessageSearchService from "../services/MessageServices/MessageSearchService";
import GetMessageContextService from "../services/MessageServices/GetMessageContextService"; // Importado

type IndexQuery = {
  pageNumber: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

// Função de busca otimizada
export const searchMessages = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { q: searchTerm, limit = "40", page = "1" } = req.query as { q: string, limit?: string, page?: string };

  if (!searchTerm || searchTerm.trim().length < 2) {
    return res.status(400).json({ error: "O termo de busca deve ter pelo menos 2 caracteres." });
  }

  try {
    const result = await MessageSearchService.searchMessages(
      parseInt(ticketId, 10),
      searchTerm,
      parseInt(limit, 10),
      parseInt(page, 10)
    );
    return res.status(200).json(result);
  } catch (error) {
    console.error("Falha na busca de mensagens:", error);
    return res.status(500).json({ error: "Ocorreu um erro interno ao buscar as mensagens." });
  }
};

// NOVA FUNÇÃO PARA BUSCAR O CONTEXTO
export const getContext = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { ticketId } = req.query;

  try {
    const result = await GetMessageContextService({
      messageId: parseInt(messageId, 10),
      ticketId: parseInt(ticketId as string, 10)
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro ao buscar contexto da mensagem." });
  }
};

// Suas outras funções
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber } = req.query as IndexQuery;
  const { count, messages, ticket, hasMore } = await ListMessagesService({ pageNumber, ticketId });
  SetTicketMessagesAsRead(ticket);
  return res.json({ count, messages, ticket, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
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
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const message = await DeleteWhatsAppMessage(messageId);
  const io = getIO();
  io.to(message.ticketId.toString()).emit("appMessage", { action: "update", message });
  return res.send();
};
