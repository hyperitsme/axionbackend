import { isSolana } from "../utils/chains.js";

/** Quote SVM (Solana leg) – dummy realistis */
export async function getQuoteSvm({ fromChain, toChain, token, amount }) {
  const rate = 0.9985;
  const fee = Math.max(0.35, amount * 0.0020); // 0.2% min 0.35
  const toAmount = Math.max(0, amount * rate - fee);
  const eta = "~4–9 min";
  return { route: "Wormhole", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta };
}

/** Build Solana tx (placeholder) */
export async function buildSolanaTx({ fromChain, toChain, token = "USDC", amount }) {
  if (!isSolana(fromChain) && !isSolana(toChain)) throw new Error("Solana route only");

  // === PLACEHOLDER ===
  // kirim base64 dummy supaya Phantom memunculkan error yang jelas jika dijalankan,
  // tetapi flow UI tetap teruji. Ganti dengan REAL tx builder Wormhole untuk produksi.
  const dummyBase64 = Buffer.from("axion-bridge-demo").toString("base64");

  return {
    chainType: "svm",
    tx: dummyBase64,
    note: "Placeholder VersionedTransaction. Isi builder Wormhole untuk produksi."
  };

  /* === REAL tx Wormhole (Token Bridge) – garis besar ===
    1. Buat ixs:
       - approve delegation (ATA USDC)
       - create transfer via token-bridge program
    2. recent blockhash + message v0
    3. serialize to base64
    4. return { chainType:'svm', tx: '<base64>' }
  */
}
