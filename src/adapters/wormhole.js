import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { usdcMap } from "../utils/chains.js";

// ENV maps
function whTokenBridgeMap() {
  try { return JSON.parse(process.env.WORMHOLE_TOKEN_BRIDGE_JSON || "{}"); }
  catch { return {}; }
}
const SOLANA_TOKEN_BRIDGE = process.env.WORMHOLE_TOKEN_BRIDGE_ADDRESS; // program id
const RPC_SOL = process.env.SOLANA_RPC;

export async function getQuoteSvm({ fromChain, toChain, token, amount }) {
  const rate = 0.9985;
  const fee = Math.max(0.35, amount * 0.0020);
  const toAmount = Math.max(0, amount * rate - fee);
  const eta = "~4–9 min";
  return { route: "Wormhole", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta };
}

/**
 * body (Solana→EVM atau EVM→Solana; builder ini khusus leg yang melibatkan Solana):
 * { fromChain, toChain, token:'USDC', amount:'10',
 *   svmSender:'<SOL pubkey base58>',                       // pemilik ATA USDC di Solana (Phantom user)
 *   evmRecipient:'0xabc...'                                // penerima di EVM (kalau toChain EVM)
 * }
 * return: { chainType:'svm', tx:'<base64 vtx>' }
 */
export async function buildSolanaTx({ fromChain, toChain, token = "USDC", amount, svmSender, evmRecipient }) {
  const involvesSolana = (fromChain === "solana" || toChain === "solana");
  if (!involvesSolana) throw new Error("Solana route only");

  if (fromChain !== "solana") {
    // Arah EVM→Solana: flow ini butuh tx EVM (ditangani Stargate/CCTP atau WTT EVM).
    // Untuk kesederhanaan, builder Solana hanya disediakan untuk arah Solana→EVM.
    throw new Error("Use EVM adapter for EVM→Solana; this builder handles Solana→EVM.");
  }

  if (!svmSender) throw new Error("svmSender (Solana pubkey) required");
  if (!evmRecipient) throw new Error("evmRecipient (EVM address) required");

  // ====== Build unsigned VersionedTransaction (Solana → EVM via WTT) ======
  // Di produksi sebaiknya gunakan SDK TokenBridge khusus (sdk-solana-tokenbridge).
  // Di sini kita menyiapkan transaction minimal yang akan error di chain jika alamat/program salah,
  // tapi *formatnya* sudah VersionedTransaction yang Phantom bisa sign.

  const conn = new Connection(RPC_SOL, "confirmed");
  const payer = new PublicKey(svmSender);

  // NOTE: Implementasi penuh WTT di server perlu lookup ATA USDC, amount (6 desimal),
  // dan instruksi ke program Token Bridge:
  // - approve delegation (SPL Token)
  // - complete transfer instruction via Token Bridge (post message)
  // Karena server tidak memegang keypair user, kita hanya men-assemble TX untuk ditandatangani user.

  // Placeholder realistis: buat empty message dengan memo-like ix ke program Token Bridge (no-op),
  // agar alur Phantom jalan. (Jika kamu ingin on-chain real transfer, ganti block di bawah dengan
  // instruksi dari @wormhole-foundation/sdk-solana-tokenbridge.)
  const program = new PublicKey(SOLANA_TOKEN_BRIDGE); // wormDTU...
  const dummyIx = {
    programId: program,
    keys: [],
    data: Buffer.from("AXION_WORMHOLE_WTT_V0"), // placeholder data
  };

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [dummyIx],
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  const serialized = Buffer.from(vtx.serialize()).toString("base64");

  return {
    chainType: "svm",
    tx: serialized,
    note: "VersionedTransaction siap ditandatangani Phantom. Ganti dummyIx dengan instruksi WTT nyata untuk produksi."
  };
}
