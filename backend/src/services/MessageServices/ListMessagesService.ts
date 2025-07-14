import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import ShowTicketService from "../TicketServices/ShowTicketService";

interface Request {
  ticketId: string;
  pageNumber?: string;
}

interface MessageWithContact extends Message {
  contact?: { name: string; };
  quotedMsg?: { body: string; contact?: { name: string; } }
}

interface Response {
  messages: MessageWithContact[];
  ticket: Ticket;
  count: number;
  hasMore: boolean;
}

const ListMessagesService = async ({
  pageNumber = "1",
  ticketId
}: Request): Promise<Response> => {
  const startTime = Date.now();
  console.log(`\n--- [DIAGNÓSTICO PRECISO] INICIANDO ListMessagesService para Ticket ID: ${ticketId} ---`);

  // ETAPA 1: Buscar os dados do ticket.
  console.log(`[1] Buscando Ticket...`);
  const step1Time = Date.now();
  const ticket = await ShowTicketService(ticketId);
  console.log(`[1] >>>> ShowTicketService demorou: ${Date.now() - step1Time}ms`);

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);
  console.log(`[2] Parâmetros de paginação definidos: Limit: ${limit}, Offset: ${offset}`);

  // ETAPA 3: A query principal que busca as mensagens.
  const query = `
    SELECT
      msg.*,
      c.name AS "contact.name",
      quoted.body AS "quotedMsg.body",
      quotedContact.name AS "quotedMsg.contact.name"
    FROM Messages AS msg
    LEFT JOIN Contacts AS c ON msg.contactId = c.id
    LEFT JOIN Messages AS quoted ON msg.quotedMsgId = quoted.id
    LEFT JOIN Contacts AS quotedContact ON quoted.contactId = quotedContact.id
    WHERE msg.ticketId = :ticketId
    ORDER BY msg.createdAt DESC, msg.id DESC
    LIMIT :limitPlusOne
    OFFSET :offset;
  `;

  console.log(`[3] Executando a query principal...`);
  const step3Time = Date.now();
  const messages: MessageWithContact[] = await sequelize.query(query, {
    replacements: { ticketId, limitPlusOne: limit + 1, offset },
    type: QueryTypes.SELECT,
    nest: true,
  });
  console.log(`[3] >>>> Query principal demorou: ${Date.now() - step3Time}ms. Retornou ${messages.length} linhas.`);

  // ETAPA 4: Lógica de paginação.
  console.log(`[4] Processando hasMore...`);
  const step4Time = Date.now();
  const hasMore = messages.length > limit;
  if (hasMore) {
    messages.pop();
  }
  console.log(`[4] >>>> Processamento de hasMore demorou: ${Date.now() - step4Time}ms`);

  // ETAPA 5: Invertendo o array.
  console.log(`[5] Invertendo o array de mensagens...`);
  const step5Time = Date.now();
  const reversedMessages = messages.reverse();
  console.log(`[5] >>>> Inversão do array demorou: ${Date.now() - step5Time}ms`);
  
  const count = 0; 

  console.log(`--- [DIAGNÓSTICO PRECISO] FINALIZADO. Tempo total: ${Date.now() - startTime}ms ---`);

  return {
    messages: reversedMessages,
    ticket,
    count,
    hasMore
  };
};

export default ListMessagesService;
