// server/index.js
// A minimal proxy so the browser never sees your Anthropic API key.
//
// Setup:
//   npm install express cors dotenv @anthropic-ai/sdk
//   Create a .env file in the project root with: ANTHROPIC_API_KEY=sk-ant-...
//   Run: node server/index.js  (or `node --watch server/index.js` while developing)

/* global process */
import express from "express";
import cors from "cors";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post("/api/claude", async (req, res) => {
  try {
    const { messages, system } = req.body;
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages,
    });
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Claude API request failed" });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Proxy server running on http://localhost:${PORT}`));