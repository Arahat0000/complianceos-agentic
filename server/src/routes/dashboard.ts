import { pipelineActivityQuerySchema } from "@complianceos/shared";
import { Router } from "express";
import { getDashboardSummary, getPipelineActivity } from "../services/dashboardService.js";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", async (req, res, next) => {
  try {
    res.json(await getDashboardSummary(req.user!.organizationId));
  } catch (err) {
    next(err);
  }
});

dashboardRouter.get("/pipeline-activity", async (req, res, next) => {
  try {
    const { days } = pipelineActivityQuerySchema.parse(req.query);
    res.json(await getPipelineActivity(req.user!.organizationId, days));
  } catch (err) {
    next(err);
  }
});
