import { Router } from "express";

const router = Router();

const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    features: [
      "20 AI generations per day",
      "10 job applications per day",
      "Budget AI models",
      "Review before submit"
    ],
    limits: {
      aiGenerationsPerDay: 20,
      applicationsPerDay: 10
    }
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 9,
    currency: "usd",
    interval: "month",
    features: [
      "100 AI generations per day",
      "50 job applications per day",
      "Premium AI models",
      "Priority support",
      "Advanced analytics"
    ],
    limits: {
      aiGenerationsPerDay: 100,
      applicationsPerDay: 50
    }
  }
};

router.get("/plans", (_req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

export default router;
