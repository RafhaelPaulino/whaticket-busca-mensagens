import { Request, Response } from "express";
import { Op } from "sequelize";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Contact from "../models/Contact";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";

type IndexQuery = {
  pageNumber: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
};

const normalizeText = (text: any) => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-\s]+/g, " ")
    .trim();
};

export const searchMessages = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { q, page = 1, limit = 40 } = req.query;

  if (!q || typeof q !== "string" || q.length < 2) {
    return res.status(400).json({
      error: "Termo de busca deve ser uma string com pelo menos 2 caracteres."
    });
  }

  const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
  const parsedLimit = parseInt(limit as string, 10);
  const normalizedQuery = normalizeText(q);

  try {
    const { rows: messages, count } = await Message.findAndCountAll({
      where: {
        ticketId: parseInt(ticketId, 10),
        body: {
          [Op.like]: `%${normalizedQuery}%`
        }
      },
      order: [["createdAt", "DESC"]],
      limit: parsedLimit,
      offset: offset,
      include: [
        {
          model: Ticket,
          as: "ticket",
          attributes: ["id", "contactId"]
        },
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number"]
        }
      ],
      attributes: ["id", "body", "fromMe", "createdAt", "ticketId"]
    });

    const filteredMessages = messages.filter((msg: any) =>
      normalizeText(msg.body).includes(normalizedQuery)
    );

    const hasMoreResults = filteredMessages.length === parsedLimit;

    return res.status(200).json({
      messages: filteredMessages,
      count,
      hasMore: hasMoreResults
    });
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    return res.status(500).json({ error: "Erro interno do servidor ao buscar mensagens." });
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber } = req.query as IndexQuery;

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId
  });

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
    await Promise.all(
      medias.map(async (media: Express.Multer.File) => {
        await SendWhatsAppMedia({ media, ticket });
      })
    );
  } else {
    await SendWhatsAppMessage({ body, ticket, quotedMsg });
  }

  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;

  const message = await DeleteWhatsAppMessage(messageId);

  const io = getIO();
  io.to(message.ticketId.toString()).emit("appMessage", {
    action: "update",
    message
  });

  return res.send();
};
