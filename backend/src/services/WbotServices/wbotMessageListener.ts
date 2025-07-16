import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import {
  WAMessage,
  WASocket,
  proto,
  jidNormalizedUser,
  extractMessageContent,
  getContentType,
  downloadContentFromMessage
} from '@whiskeysockets/baileys';

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import User from "../../models/User";

import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { debounce } from "../../helpers/Debounce";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CreateContactService from "../ContactServices/CreateContactService";
import GetContactService from "../ContactServices/GetContactService";
import formatBody from "../../helpers/Mustache";
import GetNextUserService from "../DistributionService/GetNextUserService";

const processedMessageIds = new Set<string>();

const writeFileAsync = promisify(writeFile);

const getNumberFromJid = (jid: string) => {
  return jid.replace(/\D/g, "");
};

const verifyContact = async (msg: WAMessage, wbot: WASocket): Promise<Contact> => {
  logger.info(`[verifyContact] Iniciando verificação/criação de contato para mensagem ID: ${msg.key.id}`);
  
  const contactJid = msg.key.fromMe ? msg.key.remoteJid! : msg.key.participant || msg.key.remoteJid!;
  const number = getNumberFromJid(contactJid);
  
  let contactName = msg.pushName || number; // Nome inicial do pushName ou número
  let profilePicUrl = '';

  // Tentar obter informações de contato mais detalhadas
  try {
    // Baileys não tem wbot.contacts[jid] diretamente para obter todos os dados de uma vez.
    // As informações primárias vêm da própria mensagem ou do pushName.
    // Para foto de perfil, usamos wbot.profilePictureUrl
    profilePicUrl = await wbot.profilePictureUrl(contactJid).catch(() => '');
    logger.info(`[verifyContact] Foto de perfil obtida para JID: ${contactJid}. URL: ${profilePicUrl ? 'Sim' : 'Não'}`);
  } catch (err) {
    logger.warn(`[verifyContact] Não foi possível obter foto de perfil para JID: ${contactJid}. Err: ${err}`);
  }

  const contactData = {
    name: contactName,
    number: number,
    profilePicUrl: profilePicUrl,
    isGroup: contactJid.endsWith('@g.us') // Verifica se é grupo pelo JID
  };
  logger.info(`[verifyContact] Dados do contato para DB: Nome: ${contactData.name}, Número: ${contactData.number}, É grupo: ${contactData.isGroup}`);

  const contact = await CreateOrUpdateContactService(contactData);
  logger.info(`[verifyContact] Contato DB verificado/criado. ID: ${contact.id}, Nome: ${contact.name}`);
  return contact;
};

const verifyQuotedMessage = async (
  msg: WAMessage
): Promise<Message | null> => {
  logger.info(`[verifyQuotedMessage] Verificando mensagem citada para ID: ${msg.key.id}`);
  const quotedMsgContent = extractMessageContent(msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);

  if (!quotedMsgContent) {
    logger.info(`[verifyQuotedMessage] Nenhuma mensagem citada encontrada para ID: ${msg.key.id}`);
    return null;
  }

  const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
  logger.info(`[verifyQuotedMessage] Mensagem citada encontrada. ID da citação: ${quotedMsgId}`);

  const message = await Message.findOne({
    where: { id: quotedMsgId }
  });

  if (!message) {
    logger.warn(`[verifyQuotedMessage] Mensagem citada não encontrada no DB para ID: ${quotedMsgId}`);
    return null;
  }
  logger.info(`[verifyQuotedMessage] Mensagem citada encontrada no DB. ID: ${message.id}`);
  return message;
};

function makeRandomId(length: number) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

const verifyMediaMessage = async (
  msg: WAMessage,
  ticket: Ticket,
  contact: Contact
): Promise<Message> => {
  logger.info(`[verifyMediaMessage] Iniciando processamento de mídia para mensagem ID: ${msg.key.id}`);
  const quotedMsg = await verifyQuotedMessage(msg);
  const messageContent = extractMessageContent(msg.message);
  const contentType = getContentType(messageContent);
  logger.info(`[verifyMediaMessage] ContentType da mídia: ${contentType}`);

  let mediaData: Buffer | undefined;
  let mediaMimeType: string | undefined;
  let filename: string | undefined;

  try {
    if (contentType && msg.message) {
      // Baixar mídia do Baileys
      const stream = await downloadContentFromMessage(msg.message[contentType as keyof proto.IMessage] as any, contentType.split('Message')[0] as any);
      mediaData = Buffer.from([]);
      for await (const chunk of stream) {
        mediaData = Buffer.concat([mediaData, chunk]);
      }
      mediaMimeType = msg.message[contentType as keyof proto.IMessage]?.mimetype || undefined;
      filename = msg.message[contentType as keyof proto.IMessage]?.fileName || undefined;
      logger.info(`[verifyMediaMessage] Mídia baixada com sucesso. Tamanho: ${mediaData.length}, MimeType: ${mediaMimeType}, Filename: ${filename}`);
    }
  } catch (err) {
    logger.error(`[verifyMediaMessage] Erro ao baixar mídia da mensagem ${msg.key.id}: ${err}`);
    Sentry.captureException(err);
  }

  if (!mediaData || !mediaMimeType) {
    logger.error(`[verifyMediaMessage] Mídia ou MimeType ausentes após download para ID: ${msg.key.id}`);
    throw new Error("ERR_WAPP_DOWNLOAD_MEDIA");
  }

  let randomId = makeRandomId(5);
  let finalFilename = filename || `${randomId}-${new Date().getTime()}`;

  if (!finalFilename.includes('.')) {
    const ext = mediaMimeType.split("/")[1]?.split(";")[0] || 'bin';
    finalFilename = `${finalFilename}.${ext}`;
  } else {
    const parts = finalFilename.split('.');
    const ext = parts.pop();
    finalFilename = `${parts.join('.')}.${randomId}.${ext}`;
  }
  logger.info(`[verifyMediaMessage] Nome de arquivo final para mídia: ${finalFilename}`);

  try {
    await writeFileAsync(
      join(__dirname, "..", "..", "..", "public", finalFilename),
      mediaData
    );
    logger.info(`[verifyMediaMessage] Mídia salva em disco: public/${finalFilename}`);
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[verifyMediaMessage] Erro ao salvar mídia em disco para ID: ${msg.key.id}. Err: ${err}`);
  }

  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: msg.message?.extendedTextMessage?.text || finalFilename,
    fromMe: msg.key.fromMe,
    read: !msg.key.fromMe,
    mediaUrl: finalFilename,
    mediaType: mediaMimeType.split("/")[0],
    quotedMsgId: quotedMsg?.id
  };
  logger.info(`[verifyMediaMessage] Dados da mensagem de mídia para DB: ID: ${messageData.id}, TicketID: ${messageData.ticketId}, FromMe: ${messageData.fromMe}`);

  await ticket.update({ lastMessage: msg.message?.extendedTextMessage?.text || finalFilename });
  const newMessage = await CreateMessageService({ messageData });
  logger.info(`[verifyMediaMessage] Mensagem de mídia criada no DB. ID: ${newMessage.id}`);

  return newMessage;
};


const verifyMessage = async (
  msg: WAMessage,
  ticket: Ticket,
  contact: Contact
) => {
  logger.info(`[verifyMessage] Iniciando verificação de mensagem de texto para ID: ${msg.key.id}`);
  const messageContent = extractMessageContent(msg.message);
  const body = messageContent?.conversation || messageContent?.extendedTextMessage?.text || '';
  logger.info(`[verifyMessage] Corpo da mensagem extraído: ${body}`);

  const quotedMsg = await verifyQuotedMessage(msg);
  const messageData = {
    id: msg.key.id,
    ticketId: ticket.id,
    contactId: msg.key.fromMe ? undefined : contact.id,
    body: body,
    fromMe: msg.key.fromMe,
    mediaType: getContentType(messageContent) || 'chat',
    read: !msg.key.fromMe,
    quotedMsgId: quotedMsg?.id
  };
  logger.info(`[verifyMessage] Dados da mensagem de texto para DB: ID: ${messageData.id}, TicketID: ${messageData.ticketId}, FromMe: ${messageData.fromMe}`);

  await ticket.update({ lastMessage: body });
  logger.info(`[verifyMessage] lastMessage do Ticket ${ticket.id} atualizado.`);
  await CreateMessageService({ messageData });
  logger.info(`[verifyMessage] Mensagem de texto criada no DB. ID: ${messageData.id}`);
};

const verifyQueue = async (
  wbot: WASocket,
  msg: WAMessage,
  ticket: Ticket,
  contact: Contact
) => {
  logger.info(`[verifyQueue] Verificando fila para ticket ${ticket.id}.`);
  const { queues, greetingMessage } = await ShowWhatsAppService(wbot.id!);
  logger.info(`[verifyQueue] WhatsApp ${wbot.id} tem ${queues.length} filas.`);

  if (queues.length === 1) {
    logger.info(`[verifyQueue] Apenas uma fila encontrada. Atribuindo ticket ${ticket.id} à fila ${queues[0].id}.`);
    await UpdateTicketService({
      ticketData: { queueId: queues[0].id },
      ticketId: ticket.id
    });

    return;
  }

  const selectedOption = extractMessageContent(msg.message)?.conversation;
  logger.info(`[verifyQueue] Opção selecionada pelo usuário: ${selectedOption}`);

  const choosenQueue = queues[+selectedOption! - 1];

  if (choosenQueue) {
    logger.info(`[verifyQueue] Fila escolhida: ${choosenQueue.name} (ID: ${choosenQueue.id}). Atribuindo ticket.`);
    await UpdateTicketService({
      ticketData: { queueId: choosenQueue.id },
      ticketId: ticket.id
    });

    const body = formatBody(`\u200e${choosenQueue.greetingMessage}`, contact);
    logger.info(`[verifyQueue] Enviando mensagem de saudação para fila escolhida.`);
    await wbot.sendMessage(contact.number + '@s.whatsapp.net', { text: body });

    const sentMsgForVerification: WAMessage = {
      key: {
        remoteJid: contact.number + '@s.whatsapp.net',
        fromMe: true,
        id: `msg-${Date.now()}`
      },
      message: {
        conversation: body
      },
      messageTimestamp: Date.now() / 1000,
      pushName: 'Bot',
      messageStubType: proto.WebMessageInfo.StubType.NONE,
      broadcast: false,
      status: proto.WebMessageInfo.Status.PENDING
    };
    await verifyMessage(sentMsgForVerification, ticket, contact);
    logger.info(`[verifyQueue] Mensagem de saudação registrada no DB.`);

  } else {
    logger.info(`[verifyQueue] Opção de fila inválida ou não escolhida. Apresentando menu de filas.`);
    let options = "";

    queues.forEach((queue, index) => {
      options += `*${index + 1}* - ${queue.name}\n`;
    });

    const body = formatBody(`\u200e${greetingMessage}\n${options}`, contact);

    const debouncedSentMessage = debounce(
      async () => {
        logger.info(`[verifyQueue] Enviando menu de filas para o contato.`);
        await wbot.sendMessage(contact.number + '@s.whatsapp.net', { text: body });
        const sentMsgForVerification: WAMessage = {
          key: {
            remoteJid: contact.number + '@s.whatsapp.net',
            fromMe: true,
            id: `msg-${Date.now()}`
          },
          message: {
            conversation: body
          },
          messageTimestamp: Date.now() / 1000,
          pushName: 'Bot',
          messageStubType: proto.WebMessageInfo.StubType.NONE,
          broadcast: false,
          status: proto.WebMessageInfo.Status.PENDING
        };
        verifyMessage(sentMsgForVerification, ticket, contact);
        logger.info(`[verifyQueue] Menu de filas registrado no DB.`);
      },
      3000,
      ticket.id
    );

    debouncedSentMessage();
  }
};

const isValidMsg = (msg: WAMessage): boolean => {
  logger.info(`[isValidMsg] Verificando validade da mensagem ID: ${msg.key.id}, Tipo: ${getContentType(msg.message)}`);
  if (msg.key.remoteJid === 'status@broadcast') {
    logger.info(`[isValidMsg] Mensagem de status@broadcast, inválida.`);
    return false;
  }

  const contentType = getContentType(msg.message);
  logger.info(`[isValidMsg] ContentType final para validação: ${contentType}`);

  // Tipos de mensagem que queremos processar
  if (
    contentType === "conversation" || // Texto simples
    contentType === "extendedTextMessage" || // Texto com citação, link, etc.
    contentType === "imageMessage" ||
    contentType === "videoMessage" ||
    contentType === "audioMessage" ||
    contentType === "documentMessage" ||
    contentType === "stickerMessage" ||
    contentType === "locationMessage" ||
    contentType === "contactMessage" || // vCard
    contentType === "contactsArrayMessage" || // Multi vCard
    contentType === "reactionMessage" // Reações a mensagens
  ) {
    logger.info(`[isValidMsg] Mensagem ID: ${msg.key.id} é um tipo válido: ${contentType}`);
    return true;
  }

  // Tipos de mensagem que queremos ignorar explicitamente ou que não são relevantes para tickets
  if (
    contentType === "protocolMessage" || // Mensagens de protocolo internas (ex: mensagens apagadas, mudanças de grupo)
    contentType === "callNotificationMessage" || // Notificações de chamada
    contentType === "unknown" // Tipos desconhecidos
  ) {
    logger.info(`[isValidMsg] Mensagem ID: ${msg.key.id} é um tipo inválido/ignorado: ${contentType}`);
    return false;
  }
  
  logger.warn(`[isValidMsg] Mensagem ID: ${msg.key.id} tem um ContentType não mapeado: ${contentType}. Considerado inválido.`);
  return false;
};

export const handleMessage = async (
  msg: WAMessage,
  wbot: WASocket
): Promise<void> => {
  logger.info(`[handleMessage] INÍCIO - Processando mensagem. ID: ${msg.key.id}, Tipo: ${getContentType(msg.message)}, De: ${msg.key.remoteJid}, Para: ${msg.key.participant || msg.key.remoteJid}`);

  if (processedMessageIds.has(msg.key.id!)) {
    logger.info(`[handleMessage] Mensagem já processada (ID duplicado). ID: ${msg.key.id}. Ignorando.`);
    return;
  }
  processedMessageIds.add(msg.key.id!);
  setTimeout(() => processedMessageIds.delete(msg.key.id!), 5000); // Limpa o ID após 5s

  try {
    const io = getIO();
    
    const isGroup = msg.key.remoteJid?.endsWith('@g.us') || false;
    if (isGroup) {
      logger.info(`[handleMessage] Mensagem de grupo ignorada. ID: ${msg.key.id}, Grupo JID: ${msg.key.remoteJid}`);
      return;
    }
    logger.info(`[handleMessage] Chat da mensagem. É grupo? ${isGroup}`); 

    if (!isValidMsg(msg)) {
      logger.info(`[handleMessage] Mensagem inválida após isValidMsg. ID: ${msg.key.id}, Tipo: ${getContentType(msg.message)}. Ignorando.`);
      return;
    }

    let msgContact: Contact;
    let groupContact: Contact | undefined; 

    if (msg.key.fromMe) {
      logger.info(`[handleMessage] Mensagem enviada por mim. ID: ${msg.key.id}`);
      if (msg.message?.conversation?.startsWith('\u200e') || msg.message?.extendedTextMessage?.text?.startsWith('\u200e')) {
        logger.info(`[handleMessage] Mensagem automática já processada (inicia com \\u200e). ID: ${msg.key.id}. Ignorando.`);
        return;
      }
      msgContact = await verifyContact(msg, wbot);
      logger.info(`[handleMessage] Contato da mensagem (fromMe): ${msgContact.number}`);
    } else {
      logger.info(`[handleMessage] Mensagem recebida de outro contato. ID: ${msg.key.id}`);
      msgContact = await verifyContact(msg, wbot);
      logger.info(`[handleMessage] Contato da mensagem (notFromMe): ${msgContact.number}`);
      try {
        // CORREÇÃO: Usar wbot.readMessages para marcar como lida
        await wbot.readMessages(msg.key.remoteJid!, [msg.key.id!]);
        logger.info(`[handleMessage] Mensagem ${msg.key.id} marcada como lida.`);
      } catch (err) {
        logger.warn(`[handleMessage] Não foi possível marcar mensagem ${msg.key.id} como lida. Err: ${err}`);
      }
    }

    const whatsapp = await ShowWhatsAppService(wbot.id!);
    logger.info(`[handleMessage] WhatsApp ID: ${whatsapp.id}, Nome: ${whatsapp.name}`);

    // Para Baileys, simplificamos unreadMessages para 1 se for recebida, 0 se for enviada.
    const unreadMessages = msg.key.fromMe ? 0 : 1;
    logger.info(`[handleMessage] Mensagens não lidas (estimado): ${unreadMessages}`);

    const contact = await verifyContact(msg, wbot); // Re-verificar contato para garantir que seja o remetente real
    logger.info(`[handleMessage] Contato verificado/criação: ${contact.id}, Nome: ${contact.name}`);

    const ticket = await FindOrCreateTicketService(
      contact,
      wbot.id!,
      unreadMessages,
      groupContact
    );
    logger.info(`[handleMessage] Ticket encontrado/criado: ${ticket.id}, Status: ${ticket.status}, É novo? ${ticket.isNewRecord}, Fila: ${ticket.queueId || 'Nenhuma'}`);

    if (ticket.isNewRecord && ticket.queueId) {
      logger.info(`[handleMessage] Ticket é novo e tem fila. Verificando distribuição automática para fila ${ticket.queueId}`);
      const queue = await Queue.findByPk(ticket.queueId, {
        include: [{ model: User, as: "users", through: { attributes: [] } }],
      });

      if (queue && queue.autoDistribution) {
        logger.info(`[handleMessage] Distribuição automática ATIVA para fila ${queue.id}. Buscando próximo usuário.`);
        const nextUser = await GetNextUserService({ queueId: queue.id });
        if (nextUser && nextUser.id) {
          logger.info(`[handleMessage] Próximo usuário para distribuição: ${nextUser.id}, Nome: ${nextUser.name}. Atribuindo ticket.`);
          await ticket.update({ userId: nextUser.id, status: "open" });
          io.to(ticket.status).emit(`ticket-${ticket.id}`, {
            action: "update",
            ticket,
          });
          io.to(ticket.status).emit(`ticket`, {
            action: "update",
            ticket,
          });
          logger.info(`[handleMessage] Ticket ${ticket.id} atribuído ao usuário ${nextUser.id}.`);
        } else {
          logger.warn(`[handleMessage] Não foi possível encontrar o próximo usuário para a fila ${queue.id}.`);
        }
      } else {
        logger.info(`[handleMessage] Distribuição automática INATIVA ou fila não encontrada para fila ${ticket.queueId}.`);
      }
    } else {
      logger.info(`[handleMessage] Ticket não é novo ou não tem fila, pulando verificação de distribuição automática.`);
    }

    const messageContentType = getContentType(msg.message);
    if (messageContentType && (messageContentType.includes('Message') && messageContentType !== 'conversation' && messageContentType !== 'extendedTextMessage')) {
      logger.info(`[handleMessage] Mensagem com mídia. ID: ${msg.key.id}, Tipo: ${messageContentType}`);
      await verifyMediaMessage(msg, ticket, contact);
    } else {
      logger.info(`[handleMessage] Mensagem de texto. ID: ${msg.key.id}, Tipo: ${messageContentType}`);
      await verifyMessage(msg, ticket, contact);
    }

    const createdMessage = await Message.findByPk(msg.key.id!, {
      include: ["contact", "ticket", { model: Message, as: "quotedMsg", include: ["contact"] }]
    });
    logger.info(`[handleMessage] Mensagem criada no DB para emissão. ID: ${createdMessage?.id}, Corpo: ${createdMessage?.body}, FromMe: ${createdMessage?.fromMe}`);

    if (createdMessage) {
      io.to(ticket.id.toString()).emit("appMessage", {
        action: "create",
        message: createdMessage,
        ticket,
        contact
      });
      io.to(ticket.status).emit(`ticket-${ticket.id}`, {
        action: "update",
        ticket,
      });
      io.to(ticket.status).emit(`ticket`, {
        action: "update",
        ticket,
      });
      io.to(contact.id).emit("contact", {
        action: "update",
        contact,
      });
      logger.info(`[handleMessage] Eventos 'appMessage' (create) e 'ticket' (update) emitidos para ticket ${ticket.id} e contato ${contact.id}.`);
    } else {
      logger.warn(`[handleMessage] Mensagem recém-criada não encontrada no DB para emissão. ID: ${msg.key.id}`);
    }

    if (
      !ticket.queueId &&
      !isGroup &&
      !msg.key.fromMe &&
      !ticket.userId &&
      whatsapp.queues.length >= 1
    ) {
      logger.info(`[handleMessage] Ticket sem fila/usuário e com múltiplas filas no WhatsApp. Verificando fila para menu de seleção.`);
      await verifyQueue(wbot, msg, ticket, contact);
    } else if (!ticket.queueId && whatsapp.queues.length === 1 && !msg.key.fromMe) {
        logger.info(`[handleMessage] Ticket sem fila e apenas uma fila configurada. Atribuindo automaticamente à fila ${whatsapp.queues[0].id}.`);
        await UpdateTicketService({
            ticketData: { queueId: whatsapp.queues[0].id },
            ticketId: ticket.id
        });
        io.to(ticket.status).emit(`ticket-${ticket.id}`, { action: "update", ticket });
        io.to(ticket.status).emit(`ticket`, { action: "update", ticket });
    }

    if (messageContentType === "contactMessage") {
      logger.info(`[handleMessage] Mensagem tipo vCard (contactMessage). ID: ${msg.key.id}`);
      try {
        const vcard = msg.message?.contactMessage?.vcard;
        if (vcard) {
          const nameMatch = vcard.match(/FN:(.*?)\n/);
          const numberMatch = vcard.match(/waid=(\d+):/);
          const name = nameMatch ? nameMatch[1] : "Contato Desconhecido";
          const number = numberMatch ? numberMatch[1] : "";

          if (number) {
            await CreateContactService({
              name: name,
              number: number
            });
            logger.info(`[handleMessage] vCard processado com sucesso. Contato: ${name} (${number}).`);
          }
        }
      } catch (error) {
        logger.error(`[handleMessage] Erro ao processar vCard. ID: ${msg.key.id}, Erro: ${error}`);
        Sentry.captureException(error);
      }
    }


  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[handleMessage] Erro geral ao lidar com a mensagem. ID: ${msg.key.id}, Erro: ${err}`);
  }
};

export const handleMsgAck = async (update: { key: proto.IMessageKey; update: { status: proto.WebMessageInfo.Status | null | undefined; }; }, ackStatus: proto.WebMessageInfo.Status) => {
  logger.info(`[handleMsgAck] INÍCIO - ACK recebido. Mensagem ID: ${update.key.id}, ACK Status: ${ackStatus}`);
  await new Promise(r => setTimeout(r, 500));

  const io = getIO();

  try {
    const messageToUpdate = await Message.findByPk(update.key.id!, {
      include: [
        "contact",
        {
          model: Message,
          as: "quotedMsg",
          include: ["contact"]
        }
      ]
    });
    if (!messageToUpdate) {
      logger.warn(`[handleMsgAck] Mensagem não encontrada para atualização de ACK. ID: ${update.key.id}. Retornando.`);
      return;
    }
    logger.info(`[handleMsgAck] Mensagem ${messageToUpdate.id} encontrada no DB. Atualizando ACK para ${ackStatus}.`);
    await messageToUpdate.update({ ack: ackStatus });
    logger.info(`[handleMsgAck] Mensagem ${messageToUpdate.id} atualizada com ACK ${ackStatus}.`);

    io.to(messageToUpdate.ticketId.toString()).emit("appMessage", {
      action: "update",
      message: messageToUpdate
    });
    logger.info(`[handleMsgAck] Evento 'appMessage' (update) emitido para ticket ${messageToUpdate.ticketId} para ACK. FIM.`);

  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[handleMsgAck] Erro ao lidar com ACK da mensagem. ID: ${update.key.id}, Err: ${err}. FIM.`);
  }
};

export { handleMessage, handleMsgAck };
