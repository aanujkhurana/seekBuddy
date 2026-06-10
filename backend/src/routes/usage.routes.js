import { Router } from "express";
import { costLog } from "../db.js";

const router = Router();

const MAX_AI = parseInt(process.env.DAILY_AI_GENERATIONS, 10) || 20;
const MAX_APPS = parseInt(process.env.DAILY_APPLICATIONS, 10) || 50;

router.get("/me", (req, res) => {
  const user = req.user;
  const logs = costLog.read();
  const userLogs = logs.filter((l) => l.userId === user.id);

  const totalCost = userLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const recentLogs = userLogs.slice(-20).reverse();

  const byTask = {};
  for (const l of userLogs) {
    byTask[l.task] = (byTask[l.task] || 0) + 1;
  }

  res.json({
    id: user.id,
    email: user.email,
    daily: {
      generations: { used: user.dailyAIGenerations || 0, limit: MAX_AI },
      applications: { used: user.dailyApplications || 0, limit: MAX_APPS },
      lastReset: user.lastResetDate
    },
    allTime: {
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalGenerations: userLogs.length,
      tasks: byTask
    },
    recentLogs: recentLogs.map((l) => ({
      task: l.task,
      model: l.model,
      tokens: { input: l.tokensInput, output: l.tokensOutput },
      cost: l.cost,
      createdAt: l.createdAt
    }))
  });
});

export default router;
