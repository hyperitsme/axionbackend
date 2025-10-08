import { ethers } from "ethers";
import { rpcFor, usdcMap } from "./chains.js";

export function providerFor(chain) {
  const rpcs = rpcFor();
  const url = rpcs[chain];
  if (!url) throw new Error(`No RPC for ${chain}`);
  return new ethers.JsonRpcProvider(url);
}

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export function usdcOf(chain) {
  const m = usdcMap();
  const a = m[chain];
  if (!a) throw new Error(`No USDC for ${chain}`);
  return a;
}

export async function toUnits(provider, tokenAddr, amount) {
  try {
    const erc = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
    const dec = await erc.decimals();
    return ethers.parseUnits(String(amount), dec);
  } catch {
    return ethers.parseUnits(String(amount), 6);
  }
}
