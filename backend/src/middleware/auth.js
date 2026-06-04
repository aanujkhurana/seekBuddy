import { users } from "../db.js";

export function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.slice(7);
  const allUsers = users.read();
  const user = allUsers.find((u) => u.token === token);

  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  resetDailyIfNeeded(user, allUsers);
  req.user = user;
  next();
}

function resetDailyIfNeeded(user, allUsers) {
  const today = new Date().toISOString().slice(0, 10);
  if (user.lastResetDate !== today) {
    user.dailyAIGenerations = 0;
    user.dailyApplications = 0;
    user.lastResetDate = today;
    users.write(allUsers);
  }
}
