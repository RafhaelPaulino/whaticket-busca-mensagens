import { QueryTypes } from "sequelize";
import database from "../../database";

interface ListMessagesParams {
  ticketId: string | number;
  pageNumber?: number;
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

const ListMessagesService = async ({
  ticketId,
  pageNumber = 1,
  limit = 20
}: ListMessagesParams) => {
  const offset = (pageNumber - 1) * limit;
  
  console.time(`ListMessages-Ticket-${ticketId}-Page-${pageNumber}`);
  
  try {
    // ✅ VERSÃO ULTRA-SIMPLIFICADA: Sem JOINs pesados
    // Carrega apenas os dados essenciais da mensagem
    const query = `
      SELECT 
        id,
        body,
        mediaUrl,
        mediaType,
        isDeleted,
        fromMe,
        \`read\`,
        quotedMsgId,
        ack,
        createdAt,
        updatedAt,
        ticketId,
        contactId
      FROM Messages
      WHERE ticketId = ?
      ORDER BY createdAt DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM Messages
      WHERE ticketId = ?
    `;

    // ✅ EXECUÇÃO PARALELA
    const [messagesResult, countResult] = await Promise.all([
      database.query(query, {
        type: QueryTypes.SELECT,
        replacements: [ticketId, limit, offset]
      }) as Promise<MessageResult[]>,
      
      database.query(countQuery, {
        type: QueryTypes.SELECT,
        replacements: [ticketId]
      }) as Promise<Array<{total: number}>>
    ]);

    console.timeEnd(`ListMessages-Ticket-3-Page-${pageNumber}`);

    // ✅ PROCESSAMENTO MÍNIMO - apenas estrutura básica
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
      // ✅ CONTATO E QUOTE VAZIOS - Frontend pode buscar se necessário
      contact: null,
      quotedMsg: null
    }));

    const total = countResult[0]?.total || 0;
    const hasMore = total > offset + limit;

    console.log(`✅ ListMessages ULTRA-FAST: ${messages.length} messages loaded for ticket ${ticketId}, page ${pageNumber}`);

    return {
      messages: messages.reverse(), // Ordem cronológica (mais antigas primeiro)
      count: total,
      hasMore
    };

  } catch (error) {
    console.error(`❌ Error in ListMessagesService for ticket ${ticketId}:`, error);
    console.timeEnd(`ListMessages-Ticket-${ticketId}-Page-${pageNumber}`);
    
    throw new Error(`Failed to load messages for ticket ${ticketId}: ${error.message}`);
  }
};

export default ListMessagesService;