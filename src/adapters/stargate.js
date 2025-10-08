import { ethers } from "ethers";
import { providerFor, usdcOf, ERC20_ABI, toUnits } from "../utils/evm.js";
import { isEvm } from "../utils/chains.js";

export async function getQuoteEvm({ fromChain, toChain, token, amount }) {
  if (!isEvm(fromChain) || !isEvm(toChain)) throw new Error("EVM route only");
  const rate = 0.9992;
  const fee = Math.max(0.25, amount * 0.0015);
  const toAmount = Math.max(0, amount * rate - fee);
  const eta = "~3–6 min";
  return { route: "Stargate", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta };
}

export async function buildEvmTx({ fromChain, toChain, token = "USDC", amount }) {
  const router = process.env.STARGATE_ROUTER_ADDRESS;
  const p = providerFor(fromChain);
  const usdc = usdcOf(fromChain);
  const amt = await toUnits(p, usdc, amount);

  if (!router) {
    return {
      chainType: "evm",
      tx: { to: usdc, data: "0x", value: "0x0" },
      note: "STARGATE_ROUTER_ADDRESS empty: demo payload (no-op)."
    };
  }

  const ifaceERC20 = new ethers.Interface(ERC20_ABI);
  const approveData = ifaceERC20.encodeFunctionData("approve", [router, amt]);
  return {
    chainType: "evm",
    needsApproval: true,
    tx: { to: usdc, data: approveData, value: "0x0" },
    note: "Send approve first; then call /api/bridge again for swap tx."
  };
}
