import { isSolana } from "../utils/chains.js";

export async function getQuoteSvm({ fromChain, toChain, token, amount }) {
  const rate = 0.9985;
  const fee = Math.max(0.35, amount * 0.0020);
  const toAmount = Math.max(0, amount * rate - fee);
  const eta = "~4–9 min";
  return { route: "Wormhole", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta };
}

export async function buildSolanaTx({ fromChain, toChain, token = "USDC", amount }) {
  if (!isSolana(fromChain) && !isSolana(toChain)) throw new Error("Solana route only");
  const placeholder = "QUxM"; // base64("ALL")
  return {
    chainType: "svm",
    tx: placeholder,
    note: "Placeholder VersionedTransaction (replace with real Wormhole builder for production)."
  };
}
