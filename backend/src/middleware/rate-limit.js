import { users } from "../db.js";

const MAX_AI_GENERATIONS = parseInt(process.env.DAILY_AI_GENERATIONS, 10) || 20;
const MAX_APPLICATIONS = parseInt(process.env.DAILY_APPLICATIONS, 10) || 50;

export function checkAIGenerationLimit(req, res, next) {
  if (req.user.dailyAIGenerations >= MAX_AI_GENERATIONS) {
    return res.status(429).json({
      error: "Daily AI generation limit reached",
      limit: MAX_AI_GENERATIONS,
      used: req.user.dailyAIGenerations
    });
  }
  next();
}

export function checkApplicationLimit(req, res, next) {
  if (req.user.dailyApplications >= MAX_APPLICATIONS) {
    return res.status(429).json({
      error: "Daily application limit reached",
      limit: MAX_APPLICATIONS,
      used: req.user.dailyApplications
    });
  }
  next();
}

export function incrementAIGenerations(userId) {
  const allUsers = users.read();
  const user = allUsers.find((u) => u.id === userId);
  if (user) {
    user.dailyAIGenerations = (user.dailyAIGenerations || 0) + 1;
    users.write(allUsers);
  }
}

export function incrementApplications(userId) {
  const allUsers = users.read();
  const user = allUsers.find((u) => u.id === userId);
  if (user) {
    user.dailyApplications = (user.dailyApplications || 0) + 1;
    users.write(allUsers);
  }
}
