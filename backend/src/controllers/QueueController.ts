import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateQueueService from "../services/QueueService/CreateQueueService";
import DeleteQueueService from "../services/QueueService/DeleteQueueService";
import ListQueuesService from "../services/QueueService/ListQueuesService";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import UpdateQueueService from "../services/QueueService/UpdateQueueService";
import Distribution from "../models/Distribution";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const queues = await ListQueuesService();

  const queuesWithDistribution = await Promise.all(
    queues.map(async (queue) => {
      const distribution = await Distribution.findOne({
        where: { queueId: queue.id }
      });
      
      return {
        ...queue.toJSON(),
        autoDistribution: distribution?.isActive || false
      };
    })
  );

  return res.status(200).json(queuesWithDistribution);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, greetingMessage, autoDistribution } = req.body;

  const queue = await CreateQueueService({ 
    name, 
    color, 
    greetingMessage 
  });

  if (typeof autoDistribution === 'boolean') {
    await Distribution.upsert({
      queueId: queue.id,
      isActive: autoDistribution,
      nextUserId: null
    });
  }

  const io = getIO();
  io.emit("queue", {
    action: "update",
    queue: {
      ...queue.toJSON(),
      autoDistribution: autoDistribution || false
    }
  });

  return res.status(200).json({
    ...queue.toJSON(),
    autoDistribution: autoDistribution || false
  });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;

  const queue = await ShowQueueService(queueId);

  const distribution = await Distribution.findOne({
    where: { queueId: queue.id }
  });

  return res.status(200).json({
    ...queue.toJSON(),
    autoDistribution: distribution?.isActive || false
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;
  const { autoDistribution, ...queueData } = req.body;

  const queue = await UpdateQueueService(queueId, queueData);

  if (typeof autoDistribution === 'boolean') {
    await Distribution.upsert({
      queueId: parseInt(queueId),
      isActive: autoDistribution,
      nextUserId: null
    });
  }

  const io = getIO();
  io.emit("queue", {
    action: "update",
    queue: {
      ...queue.toJSON(),
      autoDistribution: autoDistribution !== undefined ? autoDistribution : false
    }
  });

  return res.status(201).json({
    ...queue.toJSON(),
    autoDistribution: autoDistribution !== undefined ? autoDistribution : false
  });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;

  await Distribution.destroy({
    where: { queueId: parseInt(queueId) }
  });

  await DeleteQueueService(queueId);

  const io = getIO();
  io.emit("queue", {
    action: "delete",
    queueId: +queueId
  });

  return res.status(200).send();
};