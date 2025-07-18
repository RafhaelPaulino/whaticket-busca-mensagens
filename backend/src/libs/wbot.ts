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
  return new Promise(async (resolve, reject) => {
    try {
      const io = getIO();
      const sessionName = `session_${whatsapp.id}`;
      const { version } = await fetchLatestBaileysVersion();

      const { state, saveCreds } = await useMultiFileAuthState(sessionName);

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
          return { conversation: 'Olá' };
        },
        shouldIgnoreJid: jid => {
          const ignore = jid?.includes('status@broadcast');
          return ignore;
        },
      });

      client.id = whatsapp.id;

      client.ev.on('creds.update', saveCreds);

      client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          await whatsapp.update({ qrcode: qr, status: "qrcode" });
          io.emit("whatsappSession", {
            action: "update",
            session: whatsapp
          });
        }

        if (connection === 'close') {
          const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

          if (shouldReconnect) {
            await whatsapp.update({ status: "DISCONNECTED" });
            io.emit("whatsappSession", {
              action: "update",
              session: whatsapp
            });
            setTimeout(() => initWbot(whatsapp), 5000);
          } else {
            await whatsapp.update({ status: "DISCONNECTED", qrcode: "", session: "" });
            io.emit("whatsappSession", {
              action: "update",
              session: whatsapp
            });
            const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
            if (sessionIndex !== -1) {
              sessions.splice(sessionIndex, 1);
            }
          }
        } else if (connection === 'open') {
          await whatsapp.update({ status: "CONNECTED", qrcode: "" });
          io.emit("whatsappSession", {
            action: "update",
            session: whatsapp
          });
          const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
          if (sessionIndex === -1) {
            sessions.push(client);
          }
          resolve(client);
        }
      });

      client.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg) {
          return;
        }

        if (m.type === 'notify') {
          await WbotMessageListener.handleMessage(msg, client);
        }
      });

      client.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
          if (update.update.status) {
            await WbotMessageListener.handleMsgAck(update, update.update.status);
          }
        }
      });

    } catch (err) {
      reject(new AppError("Erro ao iniciar sessão do WhatsApp com Baileys."));
    }
  });
};

export const getWbot = (whatsappId: number): BaileysClient => {
  const client = sessions.find(s => s.id === whatsappId);

  if (!client) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return client;
};

export const removeWbot = async (whatsappId: number): Promise<void> => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      const client = sessions[sessionIndex];
      await client.logout();
      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(`[Baileys] Erro ao remover sessão ${whatsappId}: ${err}`);
  }
};
