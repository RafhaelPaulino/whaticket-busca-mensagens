import Distribution from "../../models/Distribution";
import Queue from "../../models/Queue";
import User from "../../models/User";

const ShowDistributionService = async (queueId: number): Promise<Distribution | null> => {
  const distribution = await Distribution.findOne({
    where: { queueId },
    include: [
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: User,
        as: "nextUser",
        attributes: ["id", "name", "email"]
      }
    ]
  });

  return distribution;
};

export default ShowDistributionService;