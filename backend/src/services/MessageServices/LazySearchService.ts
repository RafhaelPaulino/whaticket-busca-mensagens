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
  // 1. ✅ BUSCA INTELIGENTE: Pedimos `limite + 1` para verificar a próxima página.
  const queryLimit = limit + 1;
  const offset = (page - 1) * limit;

  const booleanSearchParam = `*${searchParam.replace(/[+-><()~*"]/g, " ")}*`;

  console.time(`OptimizedSearch-Ticket-${ticketId}-Page-${page}`);

  try {
    // 2. ✅ UMA ÚNICA QUERY: Removemos o `COUNT(*)` que era o principal gargalo.
    //    Esta query agora faz todo o trabalho.
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

    // 3. ✅ VERIFICAÇÃO RÁPIDA: Se o total de mensagens for maior que o limite,
    //    sabemos que há mais páginas e removemos o item extra.
    let hasMore = false;
    if (messages.length > limit) {
      hasMore = true;
      messages.pop(); // Remove o 41º item, que serviu apenas para a verificação.
    }

    console.timeEnd(`OptimizedSearch-Ticket-${ticketId}-Page-${page}`);
    console.log(`✅ Optimized Search: Found and returning ${messages.length} messages. HasMore: ${hasMore}`);

    // 4. ✅ RESPOSTA ENXUTA: Retornamos apenas o que o frontend precisa para o scroll infinito.
    return { messages, hasMore };

  } catch (error) {
    console.error("Error during optimized search:", error);
    console.timeEnd(`OptimizedSearch-Ticket-${ticketId}-Page-${page}`);
    throw new Error("Failed to perform optimized search.");
  }
};

export default LazySearchService;
