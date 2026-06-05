import { Router } from "express";
import { v4 as uuid } from "uuid";
import { users } from "../db.js";

const router = Router();

function generateCode() {
  return `SEEK-${uuid().slice(0, 8).toUpperCase()}`;
}

router.post("/generate", (req, res) => {
  const allUsers = users.read();
  const user = allUsers.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (!user.referralCode) {
    user.referralCode = generateCode();
    users.write(allUsers);
  }

  res.json({
    code: user.referralCode,
    usageCount: user.referralUsage || 0
  });
});

router.post("/apply", (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Referral code is required" });

  const allUsers = users.read();
  const referrer = allUsers.find((u) => u.referralCode === code.toUpperCase());
  if (!referrer) return res.status(404).json({ error: "Invalid referral code" });

  if ((referrer.referralUsage || 0) >= 5) {
    return res.status(400).json({ error: "Referral code has reached its usage limit" });
  }

  const currentUser = allUsers.find((u) => u.id === req.user.id);
  if (!currentUser) return res.status(404).json({ error: "User not found" });

  if (currentUser.id === referrer.id) {
    return res.status(400).json({ error: "Cannot use your own referral code" });
  }

  if (currentUser.referredBy) {
    return res.status(400).json({ error: "You have already used a referral code" });
  }

  currentUser.referredBy = referrer.id;
  referrer.referralUsage = (referrer.referralUsage || 0) + 1;
  referrer.dailyAIGenerations = Math.max(0, (referrer.dailyAIGenerations || 0) - 5);
  users.write(allUsers);

  res.json({
    success: true,
    message: "Referral applied. 5 extra AI generations credited!"
  });
});

export default router;
