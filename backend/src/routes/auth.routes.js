import { Router } from "express";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { users } from "../db.js";

const router = Router();

router.post("/register", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const allUsers = users.read();
  const existing = allUsers.find((u) => u.email === email);
  if (existing) {
    return res.json({ userId: existing.id, token: existing.token });
  }

  const id = uuid();
  const token = crypto.randomBytes(32).toString("hex");

  allUsers.push({
    id,
    token,
    email,
    createdAt: new Date().toISOString(),
    dailyAIGenerations: 0,
    dailyApplications: 0,
    lastResetDate: new Date().toISOString().slice(0, 10)
  });
  users.write(allUsers);

  res.status(201).json({ userId: id, token });
});

router.get("/me", (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  const allUsers = users.read();
  const user = allUsers.find((u) => u.token === token);
  if (!user) return res.status(401).json({ error: "Invalid token" });

  const { id, email, dailyAIGenerations, dailyApplications, lastResetDate } = user;
  res.json({ id, email, dailyAIGenerations, dailyApplications, lastResetDate });
});

export default router;
