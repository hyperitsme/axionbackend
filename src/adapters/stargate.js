import { ethers } from "ethers";
import { providerFor, usdcOf, ERC20_ABI, toUnits } from "../utils/evm.js";
import { isEvm } from "../utils/chains.js";

function routers() { try { return JSON.parse(process.env.STARGATE_ROUTERS_JSON||"{}"); } catch { return {}; } }
function lzIds()   { try { return JSON.parse(process.env.STARGATE_LZ_CHAIN_IDS_JSON||"{}"); } catch { return {}; } }

const USDC_ASSET_ID = Number(process.env.STARGATE_USDC_ASSET_ID || 1);
const DEFAULT_SLIPPAGE_BPS = Number(process.env.DEFAULT_SLIPPAGE_BPS || 50);

const ROUTER_ABI = [
  "function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address _refundAddress, uint256 _amountLD, uint256 _minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable",
  "function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes _toAddress, bytes _transferAndCallPayload, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams) view returns (uint256, uint256)"
];

export async function getQuoteEvm({ fromChain, toChain, token, amount }) {
  if (!isEvm(fromChain) || !isEvm(toChain)) throw new Error("EVM route only");
  const rate = 0.9992;
  const fee = Math.max(0.25, amount * 0.0015);
  const toAmount = Math.max(0, amount * rate - fee);
  return { route: "Stargate", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta: "~3–6 min" };
}

export async function buildEvmTx({ fromChain, toChain, token="USDC", amount, recipient, slippageBps }) {
  const rMap = routers(); const router = rMap[fromChain?.toLowerCase()];
  if (!router) throw new Error(`Router not set for ${fromChain}`);
  if (!recipient) {
    // minta approve dulu supaya UX sederhana (UI kirim /api/bridge lagi setelah approve)
    const p = providerFor(fromChain); const usdc = usdcOf(fromChain);
    const amt = await toUnits(p, usdc, amount);
    const ifaceERC20 = new ethers.Interface(ERC20_ABI);
    return { chainType:"evm", needsApproval:true, tx:{ to:usdc, data:ifaceERC20.encodeFunctionData("approve",[router,amt]), value:"0x0" } };
  }

  const p = providerFor(fromChain);
  const usdc = usdcOf(fromChain);
  const amt = await toUnits(p, usdc, amount);
  const dstLzId = lzIds()[toChain?.toLowerCase()];
  if (!dstLzId) throw new Error(`LZ id not found for ${toChain}`);

  const minAmount = amt - (amt * BigInt(typeof slippageBps==="number"? slippageBps: DEFAULT_SLIPPAGE_BPS) / 10_000n);
  const toBytes = ethers.getBytes(ethers.AbiCoder.defaultAbiCoder().encode(["address"], [recipient]));
  const iface = new ethers.Interface(ROUTER_ABI);

  // (opsional) kalkulasi fee LZ (beberapa chain butuh msg.value)
  let msgValue = 0n;
  try {
    const read = new ethers.Contract(router, ROUTER_ABI, p);
    const [feeWei] = await read.quoteLayerZeroFee(dstLzId, 1, toBytes, "0x", [0,0,"0x"]);
    msgValue = feeWei;
  } catch { /* biarin 0n jika view gagal */ }

  const data = iface.encodeFunctionData("swap", [
    dstLzId, BigInt(USDC_ASSET_ID), BigInt(USDC_ASSET_ID),
    "0x0000000000000000000000000000000000000000",
    amt, minAmount, [0,0,"0x"], toBytes, "0x"
  ]);

  return {
    chainType:"evm",
    tx:{ to:router, data, value: "0x"+msgValue.toString(16) },
    note:`Stargate swap USDC ${fromChain}→${toChain} (poolId=1, lz=${dstLzId})`
  };
}
