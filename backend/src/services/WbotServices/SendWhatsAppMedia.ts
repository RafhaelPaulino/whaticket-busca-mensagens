import { getWbot } from "../../libs/wbot";
import { WAMessageContent } from '@whiskeysockets/baileys'; 
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

interface Request {
  whatsappId: number;
  contactId: string; 
  media: {
    data: Buffer;
    mimetype: string;
    filename?: string;
  };
  caption?: string;
}

const SendWhatsAppMedia = async ({
  whatsappId,
  contactId,
  media,
  caption
}: Request): Promise<void> => {
  try {
    const wbot = getWbot(whatsappId);

   
    const messageContent: WAMessageContent = {
      [media.mimetype.includes('image') ? 'image' : media.mimetype.includes('video') ? 'video' : 'document']: media.data,
      mimetype: media.mimetype,
      fileName: media.filename,
      caption: caption || ''
    };

    
    await wbot.sendMessage(contactId + '@s.whatsapp.net', messageContent);

    logger.info(`[SendWhatsAppMedia] Mídia enviada com sucesso para ${contactId} via WhatsApp ${whatsappId}.`);

  } catch (err) {
    logger.error(`[SendWhatsAppMedia] Erro ao enviar mídia para ${contactId} via WhatsApp ${whatsappId}. Err: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MEDIA");
  }
};

export default SendWhatsAppMedia;
