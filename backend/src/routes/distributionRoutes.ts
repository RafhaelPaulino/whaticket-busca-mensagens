
import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as DistributionController from "../controllers/DistributionController";

const distributionRoutes = Router();

distributionRoutes.get("/distribution/:queueId", isAuth, DistributionController.show);
distributionRoutes.post("/distribution", isAuth, DistributionController.store);
distributionRoutes.put("/distribution/:queueId", isAuth, DistributionController.update);
distributionRoutes.get("/distribution/:queueId/next-user", isAuth, DistributionController.getNextUser);

export default distributionRoutes;