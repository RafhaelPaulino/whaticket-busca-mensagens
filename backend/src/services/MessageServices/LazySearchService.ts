import { QueryTypes } from "sequelize";
import database from "../../database";

interface LazySearchParams {
  ticketId: string | number;
  searchParam: string;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  fromMe?: boolean;
  mediaType?: string;
}

interface SearchResult {
  messages: any[];
  hasMore: boolean;
}

const LazySearchService = async ({
  ticketId,
  searchParam,
  page = 1,
  limit = 40,
  dateFrom,
  dateTo,
  fromMe,
  mediaType
}: LazySearchParams): Promise<SearchResult> => {
  const queryLimit = limit + 1;
  const offset = (page - 1) * limit;

  const booleanSearchParam = `*${searchParam.replace(/[+-><()~*"]/g, " ")}*`;

  console.time(`OptimizedSearch-Ticket-${ticketId}-Page-${page}`);

  try {

    const messagesQuery = `
      SELECT 
        id, body, mediaUrl, mediaType, isDeleted, 
        fromMe, \`read\`, ack, createdAt, updatedAt, 
        ticketId, contactId, quotedMsgId
      FROM Messages
      WHERE
        ticketId = ? AND
        isDeleted = false AND
        MATCH(body) AGAINST(? IN BOOLEAN MODE)
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?;
    `;

    const messages = await database.query(messagesQuery, {
      type: QueryTypes.SELECT,
      replacements: [ticketId, booleanSearchParam, queryLimit, offset]
    });

    let hasMore = false;
    if (messages.length > limit) {
      hasMore = true;
      messages.pop();
    }

    console.timeEnd(`OptimizedSearch-Ticket-${ticketId}-Page-${page}`);
    console.log(`✅ Optimized Search: Found and returning ${messages.length} messages. HasMore: ${hasMore}`);


    return { messages, hasMore };

  } catch (error) {
    console.error("Error during optimized search:", error);
    console.timeEnd(`OptimizedSearch-Ticket-${ticketId}-Page-${page}`);
    throw new Error("Failed to perform optimized search.");
  }
};

export default LazySearchService;
