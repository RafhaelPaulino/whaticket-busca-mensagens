import { QueryInterface, QueryTypes } from "sequelize";
import database from "../../database";

interface SearchMessagesParams {
  ticketId: string | number;
  searchParam: string;
  pageNumber?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  fromMe?: boolean;
  mediaType?: string;
}

interface SearchMessageResult {
  id: string;
  body: string;
  mediaUrl: string;
  mediaType: string;
  isDeleted: boolean;
  fromMe: boolean;
  read: boolean;
  ack: number;
  createdAt: Date;
  updatedAt: Date;
  ticketId: number;
  contactId: number;
  contactName: string;
  contactNumber: string;
  relevanceScore: number;
}

const MessageSearchService = async ({
  ticketId,
  searchParam,
  pageNumber = 1,
  limit = 40,
  dateFrom,
  dateTo,
  fromMe,
  mediaType
}: SearchMessagesParams): Promise<{
  messages: any[];
  count: number;
  hasMore: boolean;
}> => {
  
  // ✅ VALIDAÇÃO DE ENTRADA
  if (!searchParam || searchParam.trim().length < 2) {
    throw new Error("Search parameter must be at least 2 characters long");
  }

  // ✅ SANITIZAÇÃO da busca para evitar erros de sintaxe
  const sanitizedSearch = searchParam
    .trim()
    .replace(/['"]/g, '') // Remove aspas que podem quebrar a query
    .replace(/[+\-<>()~*]/g, ' ') // Remove operadores especiais do FULLTEXT
    .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
    .trim();

  if (!sanitizedSearch) {
    throw new Error("Invalid search parameter after sanitization");
  }

  const offset = (pageNumber - 1) * limit;

  // ✅ CONSTRUÇÃO DINÂMICA de filtros adicionais
  let additionalFilters = '';
  const replacements: any = {
    ticketId,
    searchParam: sanitizedSearch,
    limit,
    offset
  };

  // Filtro de data
  if (dateFrom) {
    additionalFilters += ' AND m.createdAt >= :dateFrom';
    replacements.dateFrom = dateFrom;
  }
  
  if (dateTo) {
    additionalFilters += ' AND m.createdAt <= :dateTo';
    replacements.dateTo = dateTo;
  }

  // Filtro de remetente
  if (typeof fromMe === 'boolean') {
    additionalFilters += ' AND m.fromMe = :fromMe';
    replacements.fromMe = fromMe;
  }

  // Filtro de tipo de mídia
  if (mediaType && mediaType !== 'all') {
    if (mediaType === 'text') {
      additionalFilters += ' AND (m.mediaType IS NULL OR m.mediaType = "")';
    } else {
      additionalFilters += ' AND m.mediaType = :mediaType';
      replacements.mediaType = mediaType;
    }
  }

  // ✅ QUERY FULLTEXT OTIMIZADA com N-GRAM
  const searchQuery = `
    SELECT 
      m.id,
      m.body,
      m.mediaUrl,
      m.mediaType,
      m.isDeleted,
      m.fromMe,
      m.read,
      m.ack,
      m.createdAt,
      m.updatedAt,
      m.ticketId,
      m.contactId,
      
      -- Contact data (apenas para mensagens recebidas)
      c.name as contactName,
      c.number as contactNumber,
      
      -- ✅ SCORE de relevância para ordenação
      MATCH(m.body) AGAINST(:searchParam IN NATURAL LANGUAGE MODE) as relevanceScore
      
    FROM Messages m
    
    -- JOIN otimizado para Contact
    LEFT JOIN Contacts c ON (
      m.contactId = c.id 
      AND m.fromMe = false
    )
    
    WHERE m.ticketId = :ticketId
      AND m.isDeleted = false
      
      -- ✅ BUSCA FULLTEXT OTIMIZADA
      -- Usa o índice FULLTEXT com N-GRAM para busca "contém"
      AND MATCH(m.body) AGAINST(:searchParam IN NATURAL LANGUAGE MODE)
      
      ${additionalFilters}
    
    -- ✅ ORDENAÇÃO POR RELEVÂNCIA + DATA
    ORDER BY relevanceScore DESC, m.createdAt DESC, m.id DESC
    
    LIMIT :limit OFFSET :offset
  `;

  // ✅ QUERY DE CONTAGEM otimizada (sem JOINs desnecessários)
  const countQuery = `
    SELECT COUNT(*) as total
    FROM Messages m
    WHERE m.ticketId = :ticketId
      AND m.isDeleted = false
      AND MATCH(m.body) AGAINST(:searchParam IN NATURAL LANGUAGE MODE)
      ${additionalFilters}
  `;

  try {
    console.time(`MessageSearch-Ticket-${ticketId}-"${sanitizedSearch}"`);
    
    // ✅ EXECUÇÃO PARALELA para melhor performance
    const [searchResults, countResults] = await Promise.all([
      database.query(searchQuery, {
        type: QueryTypes.SELECT,
        replacements
      }) as Promise<SearchMessageResult[]>,
      
      database.query(countQuery, {
        type: QueryTypes.SELECT,
        replacements: {
          ticketId: replacements.ticketId,
          searchParam: replacements.searchParam,
          ...(replacements.dateFrom && { dateFrom: replacements.dateFrom }),
          ...(replacements.dateTo && { dateTo: replacements.dateTo }),
          ...(typeof replacements.fromMe === 'boolean' && { fromMe: replacements.fromMe }),
          ...(replacements.mediaType && { mediaType: replacements.mediaType })
        }
      }) as Promise<[{ total: number }]>
    ]);

    console.timeEnd(`MessageSearch-Ticket-${ticketId}-"${sanitizedSearch}"`);

    // ✅ PROCESSAMENTO dos resultados
    const messages = searchResults.map(row => ({
      id: row.id,
      body: row.body,
      mediaUrl: row.mediaUrl,
      mediaType: row.mediaType || 'text',
      isDeleted: row.isDeleted,
      fromMe: row.fromMe,
      read: row.read,
      ack: row.ack,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ticketId: row.ticketId,
      
      // Contact (apenas para mensagens recebidas)
      contact: row.fromMe ? null : {
        id: row.contactId,
        name: row.contactName,
        number: row.contactNumber
      },
      
      // Score de relevância (para debug)
      _relevanceScore: row.relevanceScore
    }));

    const total = countResults[0]?.total || 0;
    const hasMore = total > offset + limit;

    console.log(`✅ MessageSearch: Found ${total} total, returning ${messages.length} messages`);
    console.log(`📊 Search stats: ticket=${ticketId}, query="${sanitizedSearch}", page=${pageNumber}`);

    return {
      messages,
      count: total,
      hasMore
    };

  } catch (error) {
    console.error(`❌ Error in MessageSearchService:`, error);
    console.error(`❌ Failed query parameters:`, { ticketId, searchParam: sanitizedSearch, pageNumber });
    
    // ✅ FALLBACK: Busca simples com LIKE caso FULLTEXT falhe
    console.log("🔄 Trying fallback LIKE search...");
    
    try {
      const fallbackQuery = `
        SELECT 
          m.id, m.body, m.mediaUrl, m.mediaType, m.isDeleted, 
          m.fromMe, m.read, m.ack, m.createdAt, m.updatedAt, 
          m.ticketId, m.contactId,
          c.name as contactName, c.number as contactNumber
        FROM Messages m
        LEFT JOIN Contacts c ON (m.contactId = c.id AND m.fromMe = false)
        WHERE m.ticketId = :ticketId
          AND m.isDeleted = false
          AND m.body LIKE :likeSearch
          ${additionalFilters}
        ORDER BY m.createdAt DESC, m.id DESC
        LIMIT :limit OFFSET :offset
      `;

      const fallbackReplacements = {
        ...replacements,
        likeSearch: `%${sanitizedSearch}%`
      };

      const fallbackResults = await database.query(fallbackQuery, {
        type: QueryTypes.SELECT,
        replacements: fallbackReplacements
      }) as SearchMessageResult[];

      console.log(`✅ Fallback LIKE search successful: ${fallbackResults.length} messages found`);

      return {
        messages: fallbackResults.map(row => ({
          id: row.id,
          body: row.body,
          mediaUrl: row.mediaUrl,
          mediaType: row.mediaType || 'text',
          isDeleted: row.isDeleted,
          fromMe: row.fromMe,
          read: row.read,
          ack: row.ack,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          ticketId: row.ticketId,
          contact: row.fromMe ? null : {
            id: row.contactId,
            name: row.contactName,
            number: row.contactNumber
          }
        })),
        count: fallbackResults.length,
        hasMore: fallbackResults.length === limit
      };

    } catch (fallbackError) {
      console.error(`❌ Fallback LIKE search also failed:`, fallbackError);
      throw new Error(`Message search failed: ${error.message}`);
    }
  }
};

export default MessageSearchService;