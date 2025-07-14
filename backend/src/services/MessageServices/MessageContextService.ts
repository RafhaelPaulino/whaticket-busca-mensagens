import { QueryTypes } from "sequelize";
import database from "../../database";

// Interface para definir a estrutura dos parâmetros de entrada
interface MessageContextParams {
  ticketId: string | number;
  messageId: string;
  contextSize?: number; // Quantas mensagens buscar antes e depois (padrão: 10)
}

// Interface para garantir a tipagem do resultado da query
interface MessageResult {
  id: string;
  body: string;
  mediaUrl: string;
  mediaType: string;
  isDeleted: boolean;
  fromMe: boolean;
  read: boolean;
  quotedMsgId: string;
  ack: number;
  createdAt: Date;
  updatedAt: Date;
  ticketId: number;
  contactId: number;
}

const MessageContextService = async ({
  ticketId,
  messageId,
  contextSize = 10
}: MessageContextParams) => {
  
  console.time(`MessageContext-${messageId}`);
  
  try {
    // ETAPA 1: Encontra a mensagem "alvo" que o usuário clicou.
    // Ela servirá como ponto de referência (pivô) para buscar o contexto.
    const targetQuery = `
      SELECT 
        id, body, mediaUrl, mediaType, isDeleted, fromMe, \`read\`,
        quotedMsgId, ack, createdAt, updatedAt, ticketId, contactId
      FROM Messages
      WHERE id = ? AND ticketId = ?
    `;

    const targetResult = await database.query(targetQuery, {
      type: QueryTypes.SELECT,
      replacements: [messageId, ticketId]
    }) as MessageResult[];

    if (targetResult.length === 0) {
      throw new Error(`Message ${messageId} not found in ticket ${ticketId}`);
    }

    const targetMessage = targetResult[0];

    // ETAPA 2: Prepara as queries para buscar as mensagens ANTES e DEPOIS da alvo.
    // A lógica `(createdAt < ? OR (createdAt = ? AND id < ?))` é a forma mais precisa
    // de fazer paginação para evitar pular mensagens com o mesmo timestamp.
    const beforeQuery = `
      SELECT * FROM Messages
      WHERE ticketId = ? AND (createdAt < ? OR (createdAt = ? AND id < ?))
      ORDER BY createdAt DESC, id DESC
      LIMIT ?
    `;

    const afterQuery = `
      SELECT * FROM Messages
      WHERE ticketId = ? AND (createdAt > ? OR (createdAt = ? AND id > ?))
      ORDER BY createdAt ASC, id ASC
      LIMIT ?
    `;

    // ETAPA 3: Executa as duas queries de contexto em paralelo para ganhar tempo.
    const [beforeResults, afterResults] = await Promise.all([
      database.query(beforeQuery, {
        type: QueryTypes.SELECT,
        replacements: [ticketId, targetMessage.createdAt, targetMessage.createdAt, targetMessage.id, contextSize]
      }) as Promise<MessageResult[]>,
      
      database.query(afterQuery, {
        type: QueryTypes.SELECT,
        replacements: [ticketId, targetMessage.createdAt, targetMessage.createdAt, targetMessage.id, contextSize]
      }) as Promise<MessageResult[]>
    ]);

    console.timeEnd(`MessageContext-${messageId}`);

    // ETAPA 4: Processa e organiza os resultados.
    // As mensagens "antes" chegam em ordem invertida, então usamos .reverse() para corrigir.
    const beforeMessages = beforeResults.reverse();
    const afterMessages = afterResults;

    const allMessages = [...beforeMessages, targetMessage, ...afterMessages];

    // ETAPA 5: Encontra o índice da mensagem alvo para o frontend saber qual destacar.
    const targetIndex = beforeMessages.length;

    console.log(`✅ MessageContext: Loaded ${allMessages.length} messages around message ${messageId}`);

    return {
      messages: allMessages,
      targetMessage: targetMessage,
      targetIndex,
    };

  } catch (error: any) {
    console.error(`❌ Error in MessageContextService:`, error);
    console.timeEnd(`MessageContext-${messageId}`);
    throw new Error(`Failed to load message context: ${error.message}`);
  }
};

export default MessageContextService;
