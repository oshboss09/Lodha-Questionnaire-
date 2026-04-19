import express, { Router } from "express";
import serverless from "serverless-http";

const app = express();
const router = Router();

app.use(express.json());

router.post("/submit-to-sheets", async (req: any, res: any) => {
  const { webhookUrl, data } = req.body;
  
  if (!webhookUrl) {
    return res.status(400).json({ error: "Webhook URL missing" });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to forward to Google Sheets:", error);
    res.status(500).json({ error: "Failed to forward to Google Sheets" });
  }
});

app.use("/api", router);

export const handler = serverless(app);
