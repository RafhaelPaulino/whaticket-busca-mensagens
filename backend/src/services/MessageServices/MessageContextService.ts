import { QueryTypes } from "sequelize";
import database from "../../database";


interface MessageContextParams {
  ticketId: string | number;
  messageId: string;
  contextSize?: number; 
}
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


    const beforeMessages = beforeResults.reverse();
    const afterMessages = afterResults;

    const allMessages = [...beforeMessages, targetMessage, ...afterMessages];

   
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
