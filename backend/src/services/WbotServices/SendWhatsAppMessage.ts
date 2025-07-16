import { getWbot } from "../../libs/wbot";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import Message from "../../models/Message"; // Para buscar a mensagem citada, se houver
import { jidEncode } from '@whiskeysockets/baileys'; // Importar jidEncode para formatar o JID

interface Request {
  whatsappId: number;
  contactId: string; // Número do contato (ex: 5511999999999)
  body: string;
  quotedMsgId?: string;
}

const SendWhatsAppMessage = async ({
  whatsappId,
  contactId,
  body,
  quotedMsgId
}: Request): Promise<void> => {
  try {
    const wbot = getWbot(whatsappId);
    // Formatar o JID corretamente para o Baileys
    // O contactId que vem do frontend é apenas o número. Precisamos adicionar o domínio.
    const jid = jidEncode(contactId, 's.whatsapp.net'); 
    logger.info(`[SendWhatsAppMessage] Tentando enviar mensagem para JID: ${jid} via WhatsApp ID: ${whatsappId}`);

    let quotedMessage: Message | undefined;
    let baileysQuotedMessage: any | undefined;

    if (quotedMsgId) {
      quotedMessage = await Message.findByPk(quotedMsgId);
      if (quotedMessage) {
        // Adaptar o objeto de mensagem citada para o formato do Baileys
        baileysQuotedMessage = {
          key: {
            remoteJid: jidEncode(quotedMessage.ticket?.contact?.number || '', 's.whatsapp.net'),
            fromMe: quotedMessage.fromMe,
            id: quotedMessage.id
          },
          message: {
            conversation: quotedMessage.body || ''
          }
        };
        logger.info(`[SendWhatsAppMessage] Mensagem citada encontrada e formatada para ID: ${quotedMsgId}.`);
      } else {
        logger.warn(`[SendWhatsAppMessage] Mensagem citada com ID ${quotedMsgId} não encontrada no DB.`);
      }
    }

    const messageOptions: any = {
      text: body
    };

    if (baileysQuotedMessage) {
      messageOptions.quoted = baileysQuotedMessage;
    }

    // Envia a mensagem de texto usando a API do Baileys
    await wbot.sendMessage(jid, messageOptions);

    logger.info(`[SendWhatsAppMessage] Mensagem de texto enviada com sucesso para ${contactId} via WhatsApp ${whatsappId}.`);

  } catch (err: any) {
    logger.error(`[SendWhatsAppMessage] Erro ao enviar mensagem de texto para ${contactId} via WhatsApp ${whatsappId}. Err: ${err.message || err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
