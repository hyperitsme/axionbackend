import { Connection, PublicKey, TransactionMessage, VersionedTransaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createApproveInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  deriveTokenBridgeConfigKey,
  deriveTokenBridgeEmitterKey,
  deriveTokenBridgeAuthoritySignerKey,
  deriveTokenBridgeCustodyKey,
  deriveTokenBridgeCustodySignerKey,
  deriveWormholeBridgeDataKey,
  createTransferNativeInstruction, // untuk SPL asli
  createTransferWrappedInstruction, // jika USDC wrapped (di Solana USDC = native SPL, jadi pakai Native)
} from "@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge";
import { uint8ArrayToHex } from "@certusone/wormhole-sdk/lib/cjs/uint8Array";

function whChainIds(){ try{ return JSON.parse(process.env.WORMHOLE_CHAIN_IDS_JSON||"{}"); }catch{ return {}; } }
function whTokenBridgeMap(){ try{ return JSON.parse(process.env.WORMHOLE_TOKEN_BRIDGE_JSON||"{}"); }catch{ return {}; } }

const SOLANA_RPC = process.env.SOLANA_RPC;
const TOKEN_BRIDGE_SOL = process.env.WORMHOLE_TOKEN_BRIDGE_ADDRESS;      // wormDTU...
const USDC_SOL = JSON.parse(process.env.USDC_ADDRESSES_JSON||"{}")["solana"]; // mint USDC SPL

export async function getQuoteSvm({ fromChain, toChain, token, amount }) {
  const rate = 0.9985;
  const fee = Math.max(0.35, Number(amount||0)*0.0020);
  const toAmount = Math.max(0, Number(amount||0)*rate - fee);
  return { route:"Wormhole", rate, fee:+fee.toFixed(6), toAmount:+toAmount.toFixed(6), eta:"~4–9 min" };
}

/**
 * Build unsigned VersionedTransaction for Solana→EVM USDC (Token Bridge).
 * body: { fromChain:'solana', toChain:'base'|'ethereum'|..., amount:'10', svmSender:'<base58>', evmRecipient:'0x...' }
 */
export async function buildSolanaTx({ fromChain, toChain, amount, svmSender, evmRecipient }) {
  if (fromChain !== "solana") throw new Error("This builder handles Solana→EVM only");
  if (!svmSender) throw new Error("svmSender (Solana pubkey) required");
  if (!evmRecipient) throw new Error("evmRecipient (EVM address) required");

  const dstWhId = whChainIds()[toChain?.toLowerCase()];
  if (!dstWhId) throw new Error(`Wormhole chain id not found for ${toChain}`);

  const conn = new Connection(SOLANA_RPC, "confirmed");
  const payer = new PublicKey(svmSender);
  const mint = new PublicKey(USDC_SOL);
  const tokenBridge = new PublicKey(TOKEN_BRIDGE_SOL);

  // ATA USDC milik user
  const fromAta = getAssociatedTokenAddressSync(mint, payer, false);

  // amount dalam 6 desimal
  const amountU64 = BigInt(Math.floor(Number(amount) * 1e6)); // USDC 6

  // recipient EVM -> 32 bytes
  const targetAddress32 = Buffer.from(evmRecipient.replace(/^0x/, "").padStart(64, "0"), "hex");

  // === Instruksi approve spender = custody signer (agar TB bisa memindahkan USDC dari ATA) ===
  // Di TB V2, spender yang digunakan adalah authority signer program
  const custodySigner = deriveTokenBridgeCustodySignerKey(tokenBridge, mint)[0]; // PDA
  const approveIx = createApproveInstruction(
    fromAta,                                  // source
    custodySigner,                             // delegate
    payer,                                     // owner
    Number(amountU64),                         // amount
    [], TOKEN_PROGRAM_ID
  );

  // === Instruksi transfer native ===
  const msgNonce = Math.floor(Math.random()*1e9);
  const transferIx = createTransferNativeInstruction(
    tokenBridge,
    deriveWormholeBridgeDataKey(tokenBridge)[0],
    deriveTokenBridgeConfigKey(tokenBridge)[0],
    payer,                      // payer
    fromAta,                    // from token account
    mint,                       // mint (USDC)
    custodySigner,              // custody signer
    deriveTokenBridgeAuthoritySignerKey(tokenBridge)[0],
    new PublicKey("Sysvar1nstructions1111111111111111111111111"),
    TOKEN_PROGRAM_ID,
    dstWhId,                    // target chain id (wormhole)
    targetAddress32,            // 32-byte target address
    amountU64,                  // amount
    msgNonce
  );

  // Compose v0 message
  const { blockhash } = await conn.getLatestBlockhash("finalized");
  const msg = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [approveIx, transferIx]
  }).compileToV0Message();

  const vtx = new VersionedTransaction(msg);
  const base64 = Buffer.from(vtx.serialize()).toString("base64");

  return {
    chainType: "svm",
    tx: base64,
    note: `Wormhole TB transfer USDC Solana→${toChain} amount=${amount} (nonce=${msgNonce})`
  };
}
