import AppError from "../../errors/AppError";
import Distribution from "../../models/Distribution";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  queueId: number;
  isActive: boolean;
}

const CreateDistributionService = async ({
  queueId,
  isActive
}: Request): Promise<Distribution> => {
  const queue = await Queue.findByPk(queueId);
  if (!queue) {
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }

  const existingDistribution = await Distribution.findOne({
    where: { queueId }
  });

  if (existingDistribution) {
    throw new AppError("ERR_DISTRIBUTION_ALREADY_EXISTS", 400);
  }

  const users = await User.findAll({
    include: [{
      model: Queue,
      as: "queues",
      where: { id: queueId },
      through: { attributes: [] }
    }]
  });

  if (users.length === 0) {
    throw new AppError("ERR_NO_USERS_IN_QUEUE", 400);
  }

  const distribution = await Distribution.create({
    queueId,
    nextUserId: users[0].id,
    isActive
  });

  return distribution;
};

export default CreateDistributionService;