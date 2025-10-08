import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getQuoteEvm, buildEvmTx } from "./adapters/stargate.js";
import { getQuoteSvm, buildSolanaTx } from "./adapters/wormhole.js";
import { isSolana, pickRoute, rpcFor } from "./utils/chains.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;

app.get("/healthz", (_, res) => res.send("ok"));

app.get("/api/quote", async (req, res) => {
  try {
    const { fromChain, toChain, token = "USDC", amount = "0" } = req.query;
    const amt = Number(amount || 0);
    if (!fromChain || !toChain) return res.status(400).json({ error: "fromChain & toChain required" });
    if (!amt || amt <= 0) return res.json({ route: "none", rate: "-", fee: "-", toAmount: "", eta: "-" });

    const route = pickRoute(fromChain, toChain);
    const quote = route === "evm"
      ? await getQuoteEvm({ fromChain, toChain, token, amount: amt })
      : await getQuoteSvm({ fromChain, toChain, token, amount: amt });

    res.json(quote);
  } catch (e) {
    console.error("quote error", e);
    res.status(500).json({ error: e.message || "quote failed" });
  }
});

// ...
app.post("/api/bridge", async (req, res) => {
  try {
    const { fromChain, toChain, token="USDC", amount, recipient, svmSender, evmRecipient, slippageBps } = req.body || {};
    if (!fromChain || !toChain || !amount) return res.status(400).json({ error: "fromChain,toChain,amount required" });

    if (fromChain !== "solana" && toChain !== "solana") {
      const out = await buildEvmTx({ fromChain, toChain, token, amount, recipient, slippageBps });
      return res.json(out);
    }
    const out = await buildSolanaTx({ fromChain, toChain, token, amount, svmSender, evmRecipient });
    return res.json(out);
  } catch (e) {
    console.error("bridge error", e);
    res.status(500).json({ error: e.message || "bridge failed" });
  }
});


app.use((_, res) => res.status(404).send("Not Found"));

app.listen(PORT, () => {
  console.log("Axion server listening on :" + PORT);
  console.log("RPCs:", Object.keys(rpcFor()).join(", "));
});
