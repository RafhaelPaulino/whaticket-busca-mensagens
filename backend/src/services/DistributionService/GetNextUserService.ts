import AppError from "../../errors/AppError";
import Distribution from "../../models/Distribution";
import Queue from "../../models/Queue";
import User from "../../models/User";

interface Request {
  queueId: number;
}

const GetNextUserService = async ({ queueId }: Request): Promise<User> => {
  const distribution = await Distribution.findOne({
    where: { queueId, isActive: true }
  });

  if (!distribution) {
    throw new AppError("ERR_DISTRIBUTION_NOT_ACTIVE", 400);
  }

  const users = await User.findAll({
    include: [{
      model: Queue,
      as: "queues",
      where: { id: queueId },
      through: { attributes: [] }
    }],
    order: [['id', 'ASC']]
  });

  if (users.length === 0) {
    throw new AppError("ERR_NO_USERS_IN_QUEUE", 400);
  }

  const currentUserIndex = users.findIndex(user => user.id === distribution.nextUserId);
  
  const nextUserIndex = (currentUserIndex + 1) % users.length;
  const nextUser = users[nextUserIndex];

  await distribution.update({ nextUserId: nextUser.id });

  return nextUser;
};

export default GetNextUserService;