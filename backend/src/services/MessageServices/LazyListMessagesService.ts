import { QueryTypes } from "sequelize";
import database from "../../database";

interface LazyListParams {
  ticketId: string | number;
  direction: 'up' | 'down' | 'initial';
  cursorMessageId?: string;
  cursorCreatedAt?: string;
  limit?: number;
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

const LazyListMessagesService = async ({
  ticketId,
  direction = 'initial',
  cursorMessageId,
  cursorCreatedAt,
  limit = 20
}: LazyListParams) => {
  
  console.time(`LazyList-${direction}-Ticket-${ticketId}`);
  
  try {
    let query: string;
    let queryParams: any[];

    switch (direction) {
      case 'initial':

        query = `
          SELECT 
            id, body, mediaUrl, mediaType, isDeleted, fromMe, \`read\`,
            quotedMsgId, ack, createdAt, updatedAt, ticketId, contactId
          FROM Messages
          WHERE ticketId = ?
          ORDER BY createdAt DESC, id DESC
          LIMIT ?
        `;
        queryParams = [ticketId, limit];
        break;

      case 'up':
        if (!cursorMessageId || !cursorCreatedAt) {
          throw new Error('Cursor required for scroll up');
        }
        query = `
          SELECT 
            id, body, mediaUrl, mediaType, isDeleted, fromMe, \`read\`,
            quotedMsgId, ack, createdAt, updatedAt, ticketId, contactId
          FROM Messages
          WHERE ticketId = ?
            AND (
              createdAt < ? 
              OR (createdAt = ? AND id < ?)
            )
          ORDER BY createdAt DESC, id DESC
          LIMIT ?
        `;
        queryParams = [ticketId, cursorCreatedAt, cursorCreatedAt, cursorMessageId, limit];
        break;

      case 'down':
       
        if (!cursorMessageId || !cursorCreatedAt) {
          throw new Error('Cursor required for scroll down');
        }
        query = `
          SELECT 
            id, body, mediaUrl, mediaType, isDeleted, fromMe, \`read\`,
            quotedMsgId, ack, createdAt, updatedAt, ticketId, contactId
          FROM Messages
          WHERE ticketId = ?
            AND (
              createdAt > ? 
              OR (createdAt = ? AND id > ?)
            )
          ORDER BY createdAt ASC, id ASC
          LIMIT ?
        `;
        queryParams = [ticketId, cursorCreatedAt, cursorCreatedAt, cursorMessageId, limit];
        break;

      default:
        throw new Error('Invalid direction');
    }


    const messagesResult = await database.query(query, {
      type: QueryTypes.SELECT,
      replacements: queryParams
    }) as MessageResult[];

    console.timeEnd(`LazyList-${direction}-Ticket-${ticketId}`);


    const messages = messagesResult.map(row => ({
      id: row.id,
      body: row.body,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType,
      isDeleted: row.isDeleted,
      fromMe: row.fromMe,
      read: row.read,
      quotedMsgId: row.quotedMsgId,
      ack: row.ack,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ticketId: row.ticketId,
      contact: null, 
      quotedMsg: null
    }));


    const orderedMessages = direction === 'down' ? messages.reverse() : messages;


    const hasMore = messages.length === limit;
    const firstMessage = orderedMessages[0];
    const lastMessage = orderedMessages[orderedMessages.length - 1];

    const cursors = {
      older: lastMessage ? {
        messageId: lastMessage.id,
        createdAt: lastMessage.createdAt
      } : null,
      newer: firstMessage ? {
        messageId: firstMessage.id,
        createdAt: firstMessage.createdAt
      } : null
    };

    console.log(`✅ LazyList ${direction}: ${messages.length} messages loaded for ticket ${ticketId}`);

    return {
      messages: orderedMessages,
      hasMore,
      cursors,
      direction
    };

  } catch (error) {
    console.error(`❌ Error in LazyListMessagesService:`, error);
    console.timeEnd(`LazyList-${direction}-Ticket-${ticketId}`);
    throw new Error(`Failed to load messages: ${error.message}`);
  }
};

export default LazyListMessagesService;