import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WAMessageContent,
  WAMessage
} from '@whiskeysockets/baileys';
import { P } from 'pino';
import { getIO } from './socket';
import WhatsappModel from '../models/Whatsapp';
import AppError from '../errors/AppError';
import { logger } from '../utils/logger';
import * as WbotMessageListener from '../services/WbotServices/wbotMessageListener';
import { Boom } from '@hapi/boom';

interface BaileysClient {
  id?: number;
  ev: any;
  ws: any;
  authState: any;
  sendPresenceUpdate: (status: 'unavailable' | 'available' | 'composing' | 'paused', to?: string) => Promise<void>;
  sendMessage: (jid: string, content: WAMessageContent, options?: any) => Promise<WAMessage>;
  groupMetadata: (jid: string) => Promise<any>;
  profilePictureUrl: (jid: string, type?: 'image' | 'preview') => Promise<string | undefined>;
  sendReadReceipt: (jid: string, participant: string, messageIds: string[]) => Promise<void>;
}

const sessions: BaileysClient[] = [];

export const initWbot = async (whatsapp: WhatsappModel): Promise<BaileysClient> => {
  logger.info(`[initWbot] Iniciando conexão para WhatsApp ID: ${whatsapp.id}, Nome: ${whatsapp.name}`);
  return new Promise(async (resolve, reject) => {
    try {
      const io = getIO();
      const sessionName = `session_${whatsapp.id}`;
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`[initWbot] Baileys versão: ${version}, É a mais recente? ${isLatest}`);

      const { state, saveCreds } = await useMultiFileAuthState(sessionName);
      logger.info(`[initWbot] Estado da autenticação carregado para ${sessionName}.`);

      const client: BaileysClient = makeWASocket({
        version,
        logger: logger as P.Logger,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger as P.Logger),
        },
        browser: ['Whaticket', 'Chrome', '1.0'],
        getMessage: async key => {
          logger.info(`[initWbot] getMessage chamado para ID: ${key.id}`);
          // Esta função é chamada pelo Baileys para buscar mensagens antigas (ex: para mensagens citadas)
          // Você pode implementar a busca no seu banco de dados aqui, se necessário.
          return { conversation: 'Olá' }; // Retorno dummy por enquanto
        },
        shouldIgnoreJid: jid => {
          const ignore = jid?.includes('status@broadcast');
          if (ignore) {
            logger.info(`[initWbot] Ignorando JID de status: ${jid}`);
          }
          return ignore;
        },
      });

      client.id = whatsapp.id;
      logger.info(`[initWbot] Cliente Baileys criado e ID ${whatsapp.id} atribuído.`);

      client.ev.on('creds.update', () => {
        logger.info(`[initWbot] Evento 'creds.update' disparado. Salvando credenciais...`);
        saveCreds();
      });

      client.ev.on('connection.update', async (update) => {
        logger.info(`[initWbot] Evento 'connection.update' disparado. Estado: ${update.connection}, QR: ${!!update.qr}, LastDisconnect: ${update.lastDisconnect?.error?.message}`);
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info(`[initWbot] QR recebido para ${sessionName}: ${qr}`);
          await whatsapp.update({ qrcode: qr, status: "qrcode" });
          io.emit("whatsappSession", {
            action: "update",
            session: whatsapp
          });
          logger.info(`[initWbot] Status do WhatsApp atualizado para 'qrcode' e evento emitido.`);
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.info(`[initWbot] Conexão fechada para ${sessionName}. Motivo: ${lastDisconnect?.error?.message}. Reconectar: ${shouldReconnect}`);

          if (shouldReconnect) {
            await whatsapp.update({ status: "DISCONNECTED" });
            io.emit("whatsappSession", {
              action: "update",
              session: whatsapp
            });
            logger.info(`[initWbot] Status do WhatsApp atualizado para 'DISCONNECTED' e evento emitido. Tentando reconectar em 5s...`);
            setTimeout(() => initWbot(whatsapp), 5000);
          } else {
            logger.info(`[initWbot] Sessão ${sessionName} desconectada permanentemente (logout).`);
            await whatsapp.update({ status: "DISCONNECTED", qrcode: "", session: "" });
            io.emit("whatsappSession", {
              action: "update",
              session: whatsapp
            });
            logger.info(`[initWbot] Status do WhatsApp atualizado para 'DISCONNECTED' (logout) e evento emitido.`);
            const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
            if (sessionIndex !== -1) {
              sessions.splice(sessionIndex, 1);
              logger.info(`[initWbot] Sessão ${whatsapp.id} removida da lista de sessões ativas.`);
            }
          }
        } else if (connection === 'open') {
          logger.info(`[initWbot] Conexão aberta para ${sessionName}.`);
          await whatsapp.update({ status: "CONNECTED", qrcode: "" });
          io.emit("whatsappSession", {
            action: "update",
            session: whatsapp
          });
          logger.info(`[initWbot] Status do WhatsApp atualizado para 'CONNECTED' e evento emitido.`);
          const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
          if (sessionIndex === -1) {
            sessions.push(client);
            logger.info(`[initWbot] Cliente ${whatsapp.id} adicionado à lista de sessões ativas.`);
          }
          resolve(client);
        }
      });

      client.ev.on('messages.upsert', async (m) => {
        logger.info(`[initWbot] Evento 'messages.upsert' disparado. Tipo: ${m.type}, Quantidade de mensagens: ${m.messages.length}`);
        const msg = m.messages[0];
        if (!msg) {
          logger.warn(`[initWbot] Evento 'messages.upsert' sem mensagens. Ignorando.`);
          return;
        }
        logger.info(`[initWbot] Mensagem no upsert. ID: ${msg.key.id}, FromMe: ${msg.key.fromMe}, RemoteJid: ${msg.key.remoteJid}`);

        // O Baileys dispara upsert para mensagens recebidas e enviadas.
        // O `type === 'notify'` indica que é uma notificação de nova mensagem.
        if (m.type === 'notify') {
          await WbotMessageListener.handleMessage(msg, client);
          logger.info(`[initWbot] Chamando handleMessage para mensagem ID: ${msg.key.id} do evento 'messages.upsert'.`);
        } else {
          logger.info(`[initWbot] Evento 'messages.upsert' tipo '${m.type}' não é 'notify'. Ignorando handleMessage.`);
        }
      });

      client.ev.on('messages.update', async (updates) => {
        logger.info(`[initWbot] Evento 'messages.update' disparado. Quantidade de atualizações: ${updates.length}`);
        for (const update of updates) {
          logger.info(`[initWbot] Atualização de mensagem ID: ${update.key.id}, Status: ${update.update.status}`);
          if (update.update.status) {
            await WbotMessageListener.handleMsgAck(update, update.update.status);
            logger.info(`[initWbot] Chamando handleMsgAck para mensagem ID: ${update.key.id} do evento 'messages.update'.`);
          }
        }
      });

      logger.info(`[initWbot] Todos os listeners de evento do Baileys configurados para ${sessionName}.`);

    } catch (err) {
      logger.error(`[Baileys] Erro geral ao iniciar wbot para ${sessionName}: ${err}`);
      reject(new AppError("Erro ao iniciar sessão do WhatsApp com Baileys."));
    }
  });
};

export const getWbot = (whatsappId: number): BaileysClient => {
  logger.info(`[getWbot] Buscando cliente Baileys para ID: ${whatsappId}`);
  const client = sessions.find(s => s.id === whatsappId);

  if (!client) {
    logger.error(`[getWbot] Cliente Baileys para ID ${whatsappId} NÃO ENCONTRADO.`);
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  logger.info(`[getWbot] Cliente Baileys para ID ${whatsappId} ENCONTRADO.`);
  return client;
};

export const removeWbot = async (whatsappId: number): Promise<void> => {
  logger.info(`[removeWbot] Tentando remover cliente Baileys para ID: ${whatsappId}`);
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      const client = sessions[sessionIndex];
      await client.logout();
      sessions.splice(sessionIndex, 1);
      logger.info(`[Baileys] Sessão ${whatsappId} removida e desconectada com sucesso.`);
    } else {
      logger.warn(`[removeWbot] Cliente Baileys para ID ${whatsappId} não encontrado na lista de sessões.`);
    }
  } catch (err) {
    logger.error(`[Baileys] Erro ao remover sessão ${whatsappId}: ${err}`);
  }
};
