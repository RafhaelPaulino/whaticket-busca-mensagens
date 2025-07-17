import { getWbot } from "../../libs/wbot";
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";
import Message from "../../models/Message"; 
import { jidEncode } from '@whiskeysockets/baileys'; 

interface Request {
  whatsappId: number;
  contactId: string; 
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
   
    const jid = jidEncode(contactId, 's.whatsapp.net'); 
    logger.info(`[SendWhatsAppMessage] Tentando enviar mensagem para JID: ${jid} via WhatsApp ID: ${whatsappId}`);

    let quotedMessage: Message | undefined;
    let baileysQuotedMessage: any | undefined;

    if (quotedMsgId) {
      quotedMessage = await Message.findByPk(quotedMsgId);
      if (quotedMessage) {
       
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

   
    await wbot.sendMessage(jid, messageOptions);

    logger.info(`[SendWhatsAppMessage] Mensagem de texto enviada com sucesso para ${contactId} via WhatsApp ${whatsappId}.`);

  } catch (err: any) {
    logger.error(`[SendWhatsAppMessage] Erro ao enviar mensagem de texto para ${contactId} via WhatsApp ${whatsappId}. Err: ${err.message || err}`);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
