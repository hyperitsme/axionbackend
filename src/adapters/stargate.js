import { ethers } from "ethers";
import { providerFor, usdcOf, ERC20_ABI, toUnits } from "../utils/evm.js";
import { isEvm } from "../utils/chains.js";

// === ENV helpers ===
function routers() {
  try { return JSON.parse(process.env.STARGATE_ROUTERS_JSON || "{}"); }
  catch { return {}; }
}
function lzIds() {
  try { return JSON.parse(process.env.STARGATE_LZ_CHAIN_IDS_JSON || "{}"); }
  catch { return {}; }
}
const USDC_ASSET_ID = Number(process.env.STARGATE_USDC_ASSET_ID || 1);
const DEFAULT_SLIPPAGE_BPS = Number(process.env.DEFAULT_SLIPPAGE_BPS || 50); // 0.5%

// === ABIs ===
// IStargateRouter V1 (swap)
const ROUTER_ABI = [
  "function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address _refundAddress, uint256 _amountLD, uint256 _minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable"
];

// ===== Quote (EVM↔EVM) =====
export async function getQuoteEvm({ fromChain, toChain, token, amount }) {
  if (!isEvm(fromChain) || !isEvm(toChain)) throw new Error("EVM route only");
  // Estimasi sederhana: rate ~ parity, fee 0.15% min 0.25
  const rate = 0.9992;
  const fee = Math.max(0.25, amount * 0.0015);
  const toAmount = Math.max(0, amount * rate - fee);
  const eta = "~3–6 min";
  return { route: "Stargate", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta };
}

// ===== Build REAL tx (Router.swap) =====
/**
 * body: { fromChain, toChain, token:'USDC', amount:'100', recipient:'0xabc...', slippageBps?:50 }
 * return: { chainType:'evm', needsApproval?:true, tx:{ to, data, value } }
 */
export async function buildEvmTx({ fromChain, toChain, token = "USDC", amount, recipient, slippageBps }) {
  const rMap = routers();
  const router = rMap[fromChain?.toLowerCase()];
  if (!router) throw new Error(`Router not set for ${fromChain} (STARGATE_ROUTERS_JSON)`);

  const provider = providerFor(fromChain);
  const usdc = usdcOf(fromChain);
  const amt = await toUnits(provider, usdc, amount);

  // 1) FRONTEND MUST APPROVE router to spend USDC (we return an approval tx first)
  const ifaceERC20 = new ethers.Interface(ERC20_ABI);
  const approveData = ifaceERC20.encodeFunctionData("approve", [router, amt]);

  // Tip: kamu bisa cek allowance di server kalau UI kirim address pengirim (sender).
  // Supaya sederhana & deterministic, kita selalu minta approve dulu:
  if (!recipient || recipient === "0x" || recipient === "") {
    return {
      chainType: "evm",
      needsApproval: true,
      tx: { to: usdc, data: approveData, value: "0x0" },
      note: "Kirim approve dulu, lalu panggil /api/bridge lagi dengan 'recipient' EVM tujuan."
    };
  }

  // 2) REAL swap calldata
  const iface = new ethers.Interface(ROUTER_ABI);

  const srcPoolId = BigInt(USDC_ASSET_ID); // USDC = 1
  const dstPoolId = BigInt(USDC_ASSET_ID);

  const lz = lzIds();
  const dstLzId = lz[toChain?.toLowerCase()];
  if (!dstLzId) throw new Error(`LZ chain id not found for ${toChain} (STARGATE_LZ_CHAIN_IDS_JSON)`);

  const bps = BigInt(typeof slippageBps === "number" ? slippageBps : DEFAULT_SLIPPAGE_BPS);
  const minAmount = amt - (amt * bps / 10_000n); // slippage

  // refundAddress: pengirim (akan otomatis diisi MetaMask 'from'); biarkan 0x0 agar wallet yang set
  const refundAddress = "0x0000000000000000000000000000000000000000";

  // lzTxParams: tanpa payload call; biarkan 0
  const lzTxParams = [0, 0, "0x"];

  // 'to' (bytes) adalah address penerima di chain tujuan dalam bytes32/bytes? Router V1 menerima "bytes _to" (abi-encoded address)
  // encode: 20 bytes EVM address -> bytes
  const toBytes = ethers.getBytes(
    ethers.AbiCoder.defaultAbiCoder().encode(["address"], [recipient])
  );

  const data = iface.encodeFunctionData("swap", [
    dstLzId, srcPoolId, dstPoolId, refundAddress, amt, minAmount, lzTxParams, toBytes, "0x"
  ]);

  // Beberapa rute membutuhkan msg.value untuk LZ fees. Untuk contoh sederhana, set 0 dan biar wallet error jika butuh top-up.
  // Produksi: hitung fee via router.quoteLayerZeroFee (di versi kontrak tertentu) atau endpoint oracle.
  return {
    chainType: "evm",
    tx: { to: router, data, value: "0x0" },
    note: `Stargate swap USDC ${fromChain} → ${toChain} (dstLzId=${dstLzId}, poolId=1).`
  };
}
