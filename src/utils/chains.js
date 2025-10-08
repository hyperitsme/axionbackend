export const EVMs = ["ethereum", "bnb", "base", "polygon", "arbitrum", "optimism"];
export const SVMs = ["solana"];

export const isSolana = (c) => SVMs.includes((c || "").toLowerCase());
export const isEvm = (c) => EVMs.includes((c || "").toLowerCase());

export function pickRoute(from, to) {
  return !isSolana(from) && !isSolana(to) ? "evm" : "svm";
}

export function rpcFor() {
  return {
    ethereum: process.env.EVM_RPC_ETHEREUM,
    bnb: process.env.EVM_RPC_BNB,
    base: process.env.EVM_RPC_BASE,
    polygon: process.env.EVM_RPC_POLYGON,
    arbitrum: process.env.EVM_RPC_ARBITRUM,
    optimism: process.env.EVM_RPC_OPTIMISM,
    solana: process.env.SOLANA_RPC
  };
}

export function chainIdsHex() {
  try { return JSON.parse(process.env.CHAIN_IDS_JSON || "{}"); }
  catch { return {}; }
}

export function usdcMap() {
  try { return JSON.parse(process.env.USDC_ADDRESSES_JSON || "{}"); }
  catch { return {}; }
}
