import AppError from "../../errors/AppError";
import Distribution from "../../models/Distribution";

interface Request {
  queueId: number;
  isActive: boolean;
}

const UpdateDistributionService = async ({
  queueId,
  isActive
}: Request): Promise<Distribution> => {
  const distribution = await Distribution.findOne({
    where: { queueId }
  });

  if (!distribution) {
    throw new AppError("ERR_DISTRIBUTION_NOT_FOUND", 404);
  }

  await distribution.update({ isActive });

  return distribution;
};

export default UpdateDistributionService;