import { QueryTypes } from "sequelize";
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
  relevanceScore?: number;
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
  

  if (!searchParam || searchParam.trim().length < 2) {
    throw new Error("Search parameter must be at least 2 characters long");
  }

  const sanitizedSearch = searchParam.trim();
  const offset = (pageNumber - 1) * limit;

  console.time(`MessageSearch-Ticket-${ticketId}-"${sanitizedSearch}"`);

  try {
  
    let additionalFilters = '';
    const baseReplacements = [ticketId];

    if (dateFrom) {
      additionalFilters += ' AND createdAt >= ?';
      baseReplacements.push(dateFrom);
    }
    
    if (dateTo) {
      additionalFilters += ' AND createdAt <= ?';
      baseReplacements.push(dateTo);
    }

    if (typeof fromMe === 'boolean') {
      additionalFilters += ' AND fromMe = ?';
      baseReplacements.push(fromMe);
    }

    if (mediaType && mediaType !== 'all') {
      if (mediaType === 'text') {
        additionalFilters += ' AND (mediaType IS NULL OR mediaType = "")';
      } else {
        additionalFilters += ' AND mediaType = ?';
        baseReplacements.push(mediaType);
      }
    }

  
    const fullTextQuery = `
      SELECT 
        id,
        body,
        mediaUrl,
        mediaType,
        isDeleted,
        fromMe,
        \`read\`,
        ack,
        createdAt,
        updatedAt,
        ticketId,
        contactId,
        MATCH(body) AGAINST(? IN NATURAL LANGUAGE MODE) as relevanceScore
      FROM Messages
      WHERE ticketId = ?
        AND isDeleted = false
        AND MATCH(body) AGAINST(? IN NATURAL LANGUAGE MODE)
        ${additionalFilters}
      ORDER BY relevanceScore DESC, createdAt DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const fullTextCountQuery = `
      SELECT COUNT(*) as total
      FROM Messages
      WHERE ticketId = ?
        AND isDeleted = false
        AND MATCH(body) AGAINST(? IN NATURAL LANGUAGE MODE)
        ${additionalFilters}
    `;

    const fullTextReplacements = [
      sanitizedSearch, 
      ticketId,
      sanitizedSearch, 
      ...baseReplacements.slice(1),
      limit,
      offset
    ];

    const fullTextCountReplacements = [
      ticketId,
      sanitizedSearch,
      ...baseReplacements.slice(1)
    ];

    const [searchResults, countResults] = await Promise.all([
      database.query(fullTextQuery, {
        type: QueryTypes.SELECT,
        replacements: fullTextReplacements
      }) as Promise<SearchMessageResult[]>,
      
      database.query(fullTextCountQuery, {
        type: QueryTypes.SELECT,
        replacements: fullTextCountReplacements
      }) as Promise<Array<{total: number}>>
    ]);

    console.timeEnd(`MessageSearch-Ticket-${ticketId}-"${sanitizedSearch}"`);

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
      contact: null, 
      _relevanceScore: row.relevanceScore
    }));

    const total = countResults[0]?.total || 0;
    const hasMore = total > offset + limit;

    console.log(`✅ ULTRA-FAST Search: Found ${total} total, returning ${messages.length} messages`);

    return {
      messages,
      count: total,
      hasMore
    };

  } catch (fullTextError) {
    console.error(`❌ FULLTEXT search failed:`, fullTextError);
    console.log("🔄 Using fallback LIKE search...");
    
   
    try {
      const likeQuery = `
        SELECT 
          id, body, mediaUrl, mediaType, isDeleted, 
          fromMe, \`read\`, ack, createdAt, updatedAt, 
          ticketId, contactId
        FROM Messages
        WHERE ticketId = ?
          AND isDeleted = false
          AND body LIKE ?
          ${additionalFilters}
        ORDER BY createdAt DESC, id DESC
        LIMIT ? OFFSET ?
      `;

      const likeCountQuery = `
        SELECT COUNT(*) as total
        FROM Messages
        WHERE ticketId = ?
          AND isDeleted = false
          AND body LIKE ?
          ${additionalFilters}
      `;

      const likeSearch = `%${sanitizedSearch}%`;
      const likeReplacements = [
        ticketId,
        likeSearch,
        ...baseReplacements.slice(1),
        limit,
        offset
      ];

      const likeCountReplacements = [
        ticketId,
        likeSearch,
        ...baseReplacements.slice(1)
      ];

      const [likeResults, likeCount] = await Promise.all([
        database.query(likeQuery, {
          type: QueryTypes.SELECT,
          replacements: likeReplacements
        }) as Promise<SearchMessageResult[]>,
        
        database.query(likeCountQuery, {
          type: QueryTypes.SELECT,
          replacements: likeCountReplacements
        }) as Promise<Array<{total: number}>>
      ]);

      console.timeEnd(`MessageSearch-Ticket-${ticketId}-"${sanitizedSearch}"`);
      console.log(`✅ ULTRA-FAST LIKE Search: Found ${likeCount[0]?.total || 0} total, returning ${likeResults.length} messages`);

      return {
        messages: likeResults.map(row => ({
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
          contact: null
        })),
        count: likeCount[0]?.total || 0,
        hasMore: (likeCount[0]?.total || 0) > offset + limit
      };

    } catch (likeError) {
      console.error(`❌ LIKE search also failed:`, likeError);
      console.timeEnd(`MessageSearch-Ticket-${ticketId}-"${sanitizedSearch}"`);
      throw new Error(`All search methods failed: ${fullTextError.message}`);
    }
  }
};

export default MessageSearchService;