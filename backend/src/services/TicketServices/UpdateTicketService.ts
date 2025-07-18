import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowTicketService from "./ShowTicketService";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId
}: Request): Promise<Response> => {
  logger.info(`[UpdateTicketService] INÍCIO - Atualizando ticket ${ticketId}. Dados: ${JSON.stringify(ticketData)}`);

  const { status, userId, queueId, whatsappId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
  await SetTicketMessagesAsRead(ticket);

  if(whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.user?.id;

  if (oldStatus === "closed") {
    await CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId);
  }

  let finalQueueId = queueId;
  if (status === "closed") {
    logger.info(`[UpdateTicketService] Ticket ${ticketId} sendo FECHADO. Resetando fila para null para futuras reaberturas.`);
    finalQueueId = null;
  }

  await ticket.update({
    status,
    queueId: finalQueueId,
    userId
  });

  if(whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  await ticket.reload();

  logger.info(`[UpdateTicketService] Ticket ${ticketId} atualizado. Status: ${oldStatus} -> ${ticket.status}, Usuário: ${oldUserId} -> ${ticket.user?.id}, Fila: ${ticket.queueId}`);

  const io = getIO();

  if (ticket.status !== oldStatus || ticket.user?.id !== oldUserId) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: ticket.id
    });
  }

  io.to(ticket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit("ticket", {
      action: "update",
      ticket
    });

  logger.info(`[UpdateTicketService] FIM - Eventos emitidos para ticket ${ticketId}`);

  return { ticket, oldStatus, oldUserId };
};

export default UpdateTicketService;