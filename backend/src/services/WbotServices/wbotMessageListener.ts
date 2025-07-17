import { join } from "path";
import { promisify } from "util";
import { writeFile } from "fs";
import * as Sentry from "@sentry/node";

import {
    WAMessage,
    WASocket,
    proto,
    extractMessageContent,
    getContentType,
    downloadContentFromMessage
} from '@whiskeysockets/baileys';

import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Queue from "../../models/Queue";
import Distribution from "../../models/Distribution";

import { getIO } from "../../libs/socket";
import CreateMessageService from "../MessageServices/CreateMessageService";
import { logger } from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { debounce } from "../../helpers/Debounce";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CreateContactService from "../ContactServices/CreateContactService";
import formatBody from "../../helpers/Mustache";
import GetNextUserService from "../DistributionService/GetNextUserService";

const processedMessageIds = new Set<string>();

const writeFileAsync = promisify(writeFile);

const getNumberFromJid = (jid: string) => {
    return jid.replace(/\D/g, "");
};

const verifyContact = async (msg: WAMessage, wbot: WASocket): Promise<Contact> => {
    const contactJid = msg.key.fromMe ? msg.key.remoteJid! : msg.key.participant || msg.key.remoteJid!;
    const number = getNumberFromJid(contactJid);

    let contactName = msg.pushName || number;
    let profilePicUrl = '';

    try {
        profilePicUrl = await wbot.profilePictureUrl(contactJid).catch(() => '');
    } catch (err) {
        // Silent error
    }

    const contactData = {
        name: contactName,
        number: number,
        profilePicUrl: profilePicUrl,
        isGroup: contactJid.endsWith('@g.us')
    };

    const contact = await CreateOrUpdateContactService(contactData);
    return contact;
};

const verifyQuotedMessage = async (
    msg: WAMessage
): Promise<Message | null> => {
    const quotedMsgContent = extractMessageContent(msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);

    if (!quotedMsgContent) {
        return null;
    }

    const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const message = await Message.findOne({
        where: { id: quotedMsgId }
    });

    if (!message) {
        return null;
    }
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
    const quotedMsg = await verifyQuotedMessage(msg);
    const messageContent = extractMessageContent(msg.message);
    const contentType = getContentType(messageContent);

    let mediaData: Buffer | undefined;
    let mediaMimeType: string | undefined;
    let filename: string | undefined;

    try {
        if (contentType && msg.message) {
            const stream = await downloadContentFromMessage(msg.message[contentType as keyof proto.IMessage] as any, contentType.split('Message')[0] as any);
            mediaData = Buffer.from([]);
            for await (const chunk of stream) {
                mediaData = Buffer.concat([mediaData, chunk]);
            }
            mediaMimeType = msg.message[contentType as keyof proto.IMessage]?.mimetype || undefined;
            filename = msg.message[contentType as keyof proto.IMessage]?.fileName || undefined;
        }
    } catch (err) {
        Sentry.captureException(err);
    }

    if (!mediaData || !mediaMimeType) {
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

    try {
        await writeFileAsync(
            join(__dirname, "..", "..", "..", "public", finalFilename),
            mediaData
        );
    } catch (err) {
        Sentry.captureException(err);
    }

    let caption = msg.message?.extendedTextMessage?.text || finalFilename;
    if (!msg.key.fromMe && caption.startsWith('0')) {
        caption = caption.substring(1);
    }

    const messageData = {
        id: msg.key.id,
        ticketId: ticket.id,
        contactId: msg.key.fromMe ? undefined : contact.id,
        body: caption,
        fromMe: msg.key.fromMe,
        read: !msg.key.fromMe,
        mediaUrl: finalFilename,
        mediaType: mediaMimeType.split("/")[0],
        quotedMsgId: quotedMsg?.id
    };

    await ticket.update({ lastMessage: caption });
    const newMessage = await CreateMessageService({ messageData });

    return newMessage;
};

const verifyMessage = async (
    msg: WAMessage,
    ticket: Ticket,
    contact: Contact
) => {
    const messageContent = extractMessageContent(msg.message);
    
    let body = messageContent?.conversation || messageContent?.extendedTextMessage?.text || '';
    if (!msg.key.fromMe && body.startsWith('0')) {
        body = body.substring(1);
    }
    
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

    await ticket.update({ lastMessage: body });
    await CreateMessageService({ messageData });
};

const verifyQueue = async (
    wbot: WASocket,
    msg: WAMessage,
    ticket: Ticket,
    contact: Contact
) => {
    const { queues, greetingMessage } = await ShowWhatsAppService(wbot.id!);

    if (queues.length === 1) {
        await UpdateTicketService({
            ticketData: { queueId: queues[0].id },
            ticketId: ticket.id
        });

        const singleQueueDistribution = await Distribution.findOne({
            where: { queueId: queues[0].id, isActive: true }
        });

        if (singleQueueDistribution) {
            try {
                const nextUser = await GetNextUserService({ queueId: queues[0].id });
                if (nextUser) {
                    await UpdateTicketService({
                        ticketData: { userId: nextUser.id },
                        ticketId: ticket.id
                    });
                }
            } catch (error) {
                logger.error(`[verifyQueue] Erro ao buscar próximo usuário para fila ${queues[0].id}: ${error}`);
            }
        }
        return;
    }

    const messageContent = extractMessageContent(msg.message);
    const selectedOption = messageContent?.conversation || messageContent?.extendedTextMessage?.text;

    const numbers = selectedOption?.match(/\d+/g);
    const lastNumber = numbers ? numbers[numbers.length - 1] : null;
    
    const isValidSelection = lastNumber && parseInt(lastNumber) >= 1 && parseInt(lastNumber) <= queues.length;

    if (isValidSelection) {
        const queueIndex = parseInt(lastNumber) - 1;
        const choosenQueue = queues[queueIndex];

        if (choosenQueue) {
            await UpdateTicketService({
                ticketData: { queueId: choosenQueue.id },
                ticketId: ticket.id
            });
            
            const distribution = await Distribution.findOne({
                where: { queueId: choosenQueue.id, isActive: true }
            });

            if (distribution) {
                try {
                    const nextUser = await GetNextUserService({ queueId: choosenQueue.id });
                    if (nextUser) {
                        await UpdateTicketService({
                            ticketData: { userId: nextUser.id },
                            ticketId: ticket.id
                        });
                    }
                } catch (error) {
                    logger.error(`[verifyQueue] Erro ao buscar próximo usuário para fila ${choosenQueue.id}: ${error}`);
                }
            }
        }
    } else {
        let options = "";
        queues.forEach((queue, index) => {
            options += `*${index + 1}* - ${queue.name}\n`;
        });

        const menuMessage = greetingMessage || "Selecione uma opção:";
        const body = formatBody(`\u200e${menuMessage}\n\n${options}`, contact);

        const debouncedSentMessage = debounce(
            async () => {
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
            },
            3000,
            ticket.id
        );

        debouncedSentMessage();
    }
};

const isValidMsg = (msg: WAMessage): boolean => {
    if (msg.key.remoteJid === 'status@broadcast') {
        return false;
    }

    const contentType = getContentType(msg.message);

    const validTypes = [
        "conversation", "extendedTextMessage", "imageMessage", "videoMessage", 
        "audioMessage", "documentMessage", "stickerMessage", "locationMessage", 
        "contactMessage", "contactsArrayMessage", "reactionMessage"
    ];

    const ignoredTypes = ["protocolMessage", "callNotificationMessage", "unknown"];

    if (validTypes.includes(contentType!)) {
        return true;
    }

    if (ignoredTypes.includes(contentType!)) {
        return false;
    }

    return false;
};

export const handleMessage = async (
    msg: WAMessage,
    wbot: WASocket
): Promise<void> => {
    if (processedMessageIds.has(msg.key.id!)) {
        return;
    }
    processedMessageIds.add(msg.key.id!);
    setTimeout(() => processedMessageIds.delete(msg.key.id!), 5000);

    try {
        const io = getIO();
        const isGroup = msg.key.remoteJid?.endsWith('@g.us') || false;

        if (isGroup || !isValidMsg(msg)) {
            return;
        }

        let msgContact: Contact;
        let groupContact: Contact | undefined;

        if (msg.key.fromMe) {
            if (msg.message?.conversation?.startsWith('\u200e') || msg.message?.extendedTextMessage?.text?.startsWith('\u200e')) {
                return;
            }
            msgContact = await verifyContact(msg, wbot);
        } else {
            msgContact = await verifyContact(msg, wbot);
            try {
                await wbot.readMessages([msg.key]);
            } catch (err) {
                // Silent error
            }
        }

        const whatsapp = await ShowWhatsAppService(wbot.id!);
        const unreadMessages = msg.key.fromMe ? 0 : 1;
        const contact = await verifyContact(msg, wbot);

        const ticket = await FindOrCreateTicketService(
            contact,
            wbot.id!,
            unreadMessages,
            groupContact
        );

        if (!ticket.isNewRecord && ticket.status === 'pending' && ticket.queueId) {
            await UpdateTicketService({
                ticketData: { queueId: null },
                ticketId: ticket.id
            });
            ticket.queueId = null;
        }

        if (ticket.isNewRecord && ticket.queueId) {
            const distribution = await Distribution.findOne({
                where: { queueId: ticket.queueId, isActive: true }
            });

            if (distribution) {
                try {
                    const nextUser = await GetNextUserService({ queueId: ticket.queueId });
                    if (nextUser && nextUser.id) {
                        await UpdateTicketService({
                            ticketData: { userId: nextUser.id },
                            ticketId: ticket.id
                        });
                        
                        io.to(ticket.status).emit(`ticket-${ticket.id}`, { action: "update", ticket });
                        io.to(ticket.status).emit(`ticket`, { action: "update", ticket });
                    }
                } catch (error) {
                    logger.error(`[handleMessage] Erro ao buscar próximo usuário para fila ${ticket.queueId}: ${error}`);
                }
            }
        }

        const messageContentType = getContentType(msg.message);
        if (messageContentType && (messageContentType.includes('Message') && messageContentType !== 'conversation' && messageContentType !== 'extendedTextMessage')) {
            await verifyMediaMessage(msg, ticket, contact);
        } else {
            await verifyMessage(msg, ticket, contact);
        }

        const createdMessage = await Message.findByPk(msg.key.id!, {
            include: ["contact", "ticket", { model: Message, as: "quotedMsg", include: ["contact"] }]
        });

        if (createdMessage) {
            io.to(ticket.id.toString()).emit("appMessage", { action: "create", message: createdMessage, ticket, contact });
            io.to(ticket.status).emit(`ticket-${ticket.id}`, { action: "update", ticket });
            io.to(ticket.status).emit(`ticket`, { action: "update", ticket });
            io.to(contact.id).emit("contact", { action: "update", contact });
        }

        if (
            ticket.status === 'pending' &&
            !ticket.userId &&
            !ticket.queueId &&
            !isGroup &&
            !msg.key.fromMe &&
            whatsapp.queues.length >= 1 &&
            !msg.message?.conversation?.startsWith('\u200e') &&
            !msg.message?.extendedTextMessage?.text?.startsWith('\u200e')
        ) {
            const messageContent = extractMessageContent(msg.message);
            const messageText = messageContent?.conversation || messageContent?.extendedTextMessage?.text || '';
            const numbers = messageText.match(/\d+/g);
            const lastNumber = numbers ? numbers[numbers.length - 1] : null;
            
            if (lastNumber && parseInt(lastNumber) >= 1 && parseInt(lastNumber) <= whatsapp.queues.length) {
                await verifyQueue(wbot, msg, ticket, contact);
            } else {
                await verifyQueue(wbot, msg, ticket, contact);
            }
        }

        if (messageContentType === "contactMessage") {
            try {
                const vcard = msg.message?.contactMessage?.vcard;
                if (vcard) {
                    const nameMatch = vcard.match(/FN:(.*?)\n/);
                    const numberMatch = vcard.match(/waid=(\d+):/);
                    const name = nameMatch ? nameMatch[1] : "Contato Desconhecido";
                    const number = numberMatch ? numberMatch[1] : "";

                    if (number) {
                        await CreateContactService({ name, number });
                    }
                }
            } catch (error) {
                Sentry.captureException(error);
            }
        }

    } catch (err) {
        Sentry.captureException(err);
        logger.error(`[handleMessage] Erro geral ao lidar com a mensagem. ID: ${msg.key.id}, Erro: ${err}`);
    }
};

export const handleMsgAck = async (update: { key: proto.IMessageKey; update: { status: proto.WebMessageInfo.Status | null | undefined; }; }, ackStatus: proto.WebMessageInfo.Status) => {
    await new Promise(r => setTimeout(r, 500));
    const io = getIO();

    try {
        const messageToUpdate = await Message.findByPk(update.key.id!, {
            include: [ "contact", { model: Message, as: "quotedMsg", include: ["contact"] }]
        });

        if (!messageToUpdate) {
            return;
        }

        if (messageToUpdate.ack !== ackStatus) {
            await messageToUpdate.update({ ack: ackStatus });

            io.to(messageToUpdate.ticketId.toString()).emit("appMessage", {
                action: "update",
                message: messageToUpdate
            });
        }

    } catch (err) {
        Sentry.captureException(err);
        logger.error(`[handleMsgAck] Erro ao lidar com ACK da mensagem. ID: ${update.key.id}, Err: ${err}.`);
    }
};

export { handleMessage, handleMsgAck };
