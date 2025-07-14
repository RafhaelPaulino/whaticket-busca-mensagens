import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import Message from "../../models/Message";
import AppError from "../../errors/AppError";

interface Request {
  messageId: number;
  ticketId: number;
}

interface Response {
  messages: Message[];
}

const GetMessageContextService = async ({
  messageId,
  ticketId
}: Request): Promise<Response> => {
  const limit = 20; // Carrega 20 mensagens antes e 20 depois

  // 1. Busca a mensagem principal para ter uma referência de tempo e ID
  const targetMessage = await Message.findOne({
    where: { id: messageId, ticketId },
  });

  if (!targetMessage) {
    throw new AppError("Mensagem não encontrada.", 404);
  }

  // 2. Busca as 20 mensagens ANTERIORES de forma otimizada
  // A query agora usa o ID da mensagem como critério de desempate,
  // garantindo performance mesmo com muitas mensagens no mesmo segundo.
  const previousMessagesQuery = `
    SELECT * FROM Messages
    WHERE ticketId = :ticketId AND (createdAt < :targetTimestamp OR (createdAt = :targetTimestamp AND id < :targetId))
    ORDER BY createdAt DESC, id DESC
    LIMIT :limit
  `;
  const previousMessages = await sequelize.query<Message>(previousMessagesQuery, {
    replacements: { 
      ticketId, 
      targetTimestamp: targetMessage.createdAt, 
      targetId: targetMessage.id, 
      limit 
    },
    type: QueryTypes.SELECT,
    model: Message,
    mapToModel: true,
  });

  // 3. Busca as 20 mensagens POSTERIORES de forma otimizada
  const nextMessagesQuery = `
    SELECT * FROM Messages
    WHERE ticketId = :ticketId AND (createdAt > :targetTimestamp OR (createdAt = :targetTimestamp AND id > :targetId))
    ORDER BY createdAt ASC, id ASC
    LIMIT :limit
  `;
  const nextMessages = await sequelize.query<Message>(nextMessagesQuery, {
    replacements: { 
      ticketId, 
      targetTimestamp: targetMessage.createdAt, 
      targetId: targetMessage.id, 
      limit 
    },
    type: QueryTypes.SELECT,
    model: Message,
    mapToModel: true,
  });

  // 4. Junta tudo na ordem cronológica correta
  const orderedMessages = [
    ...previousMessages.reverse(),
    targetMessage,
    ...nextMessages
  ];

  return { messages: orderedMessages };
};

export default GetMessageContextService;
