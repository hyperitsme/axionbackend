// Wormhole (Solana leg) – lazy import agar server tetap start walau @solana/web3.js belum terpasang

function hasWeb3() {
  try { return !!require.resolve; } catch { return false; }
}

// Helper untuk import dinamis @solana/web3.js saat dibutuhkan
async function loadSolanaWeb3() {
  try {
    // dynamic import ESM
    const mod = await import("@solana/web3.js");
    return mod;
  } catch (e) {
    // Bila paket tidak ada, balas note agar dev tahu kenapa
    const err = new Error("Missing @solana/web3.js. Tambahkan ke package.json dependencies.");
    err.code = "SOLANA_WEB3_MISSING";
    throw err;
  }
}

// Quote sederhana (tetap jalan tanpa @solana/web3.js)
export async function getQuoteSvm({ fromChain, toChain, token, amount }) {
  const rate = 0.9985;
  const fee = Math.max(0.35, Number(amount || 0) * 0.0020);
  const toAmount = Math.max(0, Number(amount || 0) * rate - fee);
  const eta = "~4–9 min";
  return { route: "Wormhole", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta };
}

/**
 * Build unsigned VersionedTransaction utk Solana→EVM (placeholder aman).
 * Untuk produksi, ganti instruksi dummy dengan ixs Token Bridge.
 *
 * body: { fromChain, toChain, token, amount, svmSender, evmRecipient }
 * resp: { chainType:'svm', tx: base64, note }
 */
export async function buildSolanaTx({ fromChain, toChain, token = "USDC", amount, svmSender, evmRecipient }) {
  const involvesSol = fromChain === "solana" || toChain === "solana";
  if (!involvesSol) throw new Error("Solana route only");

  // Import @solana/web3.js hanya di sini, bukan saat server start
  let web3;
  try {
    web3 = await loadSolanaWeb3();
  } catch (e) {
    if (e.code === "SOLANA_WEB3_MISSING") {
      return {
        chainType: "svm",
        tx: null,
        note: "Solana builder tidak aktif karena @solana/web3.js belum terpasang. Tambahkan paketnya lalu redeploy."
      };
    }
    throw e;
  }

  if (fromChain !== "solana") {
    // EVM→Solana: disarankan bangun tx EVM (bukan Solana) di adapter EVM.
    return {
      chainType: "svm",
      tx: null,
      note: "Gunakan adapter EVM untuk arah EVM→Solana. Builder ini menyiapkan tx Solana→EVM."
    };
  }

  if (!svmSender || !evmRecipient) {
    return {
      chainType: "svm",
      tx: null,
      note: "svmSender (pubkey base58) & evmRecipient (0x…) wajib diisi untuk menyusun tx."
    };
  }

  // ===== Placeholder VersionedTransaction (bisa ditandatangani Phantom) =====
  const { Connection, PublicKey, TransactionMessage, VersionedTransaction } = web3;
  const conn = new Connection(process.env.SOLANA_RPC, "confirmed");
  const payer = new PublicKey(svmSender);

  // instruksi dummy (tidak memindahkan apa pun) agar flow Phantom & UI teruji
  const programId = new PublicKey(process.env.WORMHOLE_TOKEN_BRIDGE_ADDRESS || "11111111111111111111111111111111");
  const dummyIx = {
    programId,
    keys: [],
    // gunakan Uint8Array agar aman di ESM/Node 20+
    data: new Uint8Array([0x41, 0x58, 0x49, 0x4f, 0x4e]) // "AXION"
  };

  const { blockhash } = await conn.getLatestBlockhash("finalized");
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [dummyIx]
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  const serialized = Buffer.from(vtx.serialize()).toString("base64");

  return {
    chainType: "svm",
    tx: serialized,
    note: "VT siap ditandatangani Phantom (dummy). Ganti dengan instruksi Wormhole Token Bridge untuk produksi."
  };
}
