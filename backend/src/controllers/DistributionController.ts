import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateDistributionService from "../services/DistributionService/CreateDistributionService";
import UpdateDistributionService from "../services/DistributionService/UpdateDistributionService";
import ShowDistributionService from "../services/DistributionService/ShowDistributionService";
import GetNextUserService from "../services/DistributionService/GetNextUserService";

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;

  const distribution = await ShowDistributionService(parseInt(queueId));

  return res.status(200).json(distribution);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { queueId, isActive } = req.body;

  const distribution = await CreateDistributionService({
    queueId: parseInt(queueId),
    isActive: isActive || false
  });

  const io = getIO();
  io.emit("distribution", {
    action: "create",
    distribution
  });

  return res.status(200).json(distribution);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;
  const { isActive } = req.body;

  const distribution = await UpdateDistributionService({
    queueId: parseInt(queueId),
    isActive
  });

  const io = getIO();
  io.emit("distribution", {
    action: "update",
    distribution
  });

  return res.status(200).json(distribution);
};

export const getNextUser = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;

  const nextUser = await GetNextUserService({
    queueId: parseInt(queueId)
  });

  return res.status(200).json(nextUser);
};