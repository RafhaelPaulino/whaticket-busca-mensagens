import { getWbot } from "../../libs/wbot";
import { WAMessageContent } from '@whiskeysockets/baileys'; // Importa tipos do Baileys
import { logger } from "../../utils/logger";
import AppError from "../../errors/AppError";

interface Request {
  whatsappId: number;
  contactId: string; // JID do contato no formato Baileys (ex: 5511999999999@s.whatsapp.net)
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

    // Adapta o tipo de conteúdo da mensagem para o Baileys
    const messageContent: WAMessageContent = {
      [media.mimetype.includes('image') ? 'image' : media.mimetype.includes('video') ? 'video' : 'document']: media.data,
      mimetype: media.mimetype,
      fileName: media.filename,
      caption: caption || ''
    };

    // Envia a mensagem de mídia usando a API do Baileys
    await wbot.sendMessage(contactId + '@s.whatsapp.net', messageContent);

    logger.info(`[SendWhatsAppMedia] Mídia enviada com sucesso para ${contactId} via WhatsApp ${whatsappId}.`);

  } catch (err) {
    logger.error(`[SendWhatsAppMedia] Erro ao enviar mídia para ${contactId} via WhatsApp ${whatsappId}. Err: ${err}`);
    throw new AppError("ERR_SENDING_WAPP_MEDIA");
  }
};

export default SendWhatsAppMedia;
