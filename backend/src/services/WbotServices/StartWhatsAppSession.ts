import { initWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import { logger } from "../../utils/logger";


const StartWhatsAppSession = async (whatsapp: Whatsapp): Promise<void> => {
  logger.info(`[StartWhatsAppSession] Iniciando sessão para WhatsApp ID: ${whatsapp.id}, Nome: ${whatsapp.name}`);
  try {
    const wbot = await initWbot(whatsapp);
    
   
    logger.info(`[StartWhatsAppSession] Sessão WhatsApp ${whatsapp.id} iniciada com sucesso.`);

  } catch (err) {
    logger.error(`[StartWhatsAppSession] Erro ao iniciar sessão para WhatsApp ID: ${whatsapp.id}. Err: ${err}`);
  }
};

export default StartWhatsAppSession;
