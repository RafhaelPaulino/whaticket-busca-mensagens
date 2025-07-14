import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface SearchResult {
  id: number;
  body: string;
  fromMe: boolean;
  createdAt: Date;
  contactName: string;
  relevanceScore: number;
}

interface SearchResponse {
  messages: SearchResult[];
  hasMore: boolean;
}

class MessageSearchService {
  public static async searchMessages(
    ticketId: number,
    searchTerm: string,
    limit: number = 40
  ): Promise<SearchResponse> {

    // Adiciona '+' no início de cada palavra para o modo booleano do FULLTEXT
    // Isso funciona como um "E" (AND), buscando mensagens que contenham todas as palavras.
    // Ex: "projeto novo" -> "+projeto +novo"
    const booleanSearchTerm = searchTerm
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => `+${word}`)
      .join(' ');

    const query = `
      SELECT
        m.id,
        m.body,
        m.fromMe,
        m.createdAt,
        c.name as contactName,
        MATCH(m.body) AGAINST(:searchTerm IN BOOLEAN MODE) as relevanceScore
      FROM Messages as m
      INNER JOIN Tickets as t ON m.ticketId = t.id
      LEFT JOIN Contacts as c ON t.contactId = c.id
      WHERE
        m.ticketId = :ticketId
        AND MATCH(m.body) AGAINST(:searchTerm IN BOOLEAN MODE)
      ORDER BY relevanceScore DESC, m.createdAt DESC
      LIMIT :limit;
    `;

    const messages = await sequelize.query<SearchResult>(query, {
      replacements: {
        searchTerm: booleanSearchTerm,
        ticketId: ticketId,
        limit: limit + 1 // Pedimos um a mais para saber se existe "hasMore"
      },
      type: QueryTypes.SELECT
    });

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove o item extra
    }

    return { messages, hasMore };
  }
}

export default MessageSearchService;
