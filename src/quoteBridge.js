// Minimal "works when configured" bridge adapter.
// For EVM<->EVM: prepare an unsigned EVM tx (e.g., Stargate-style).
// For Solana legs: return chainType: 'svm' placeholder (you'll fill with serialized VersionedTransaction).

export async function quote({ fromChain, toChain, token='USDC', amount=0 }){
  amount = Number(amount||0);
  if(!amount) return { rate:'–', fee:'–', toAmount:'', eta:'–' };
  const evmFrom = fromChain !== 'solana';
  const evmTo = toChain !== 'solana';
  const baseRate = 0.999;
  const fee = Math.max(0.0005, amount*0.001);
  const toAmount = Math.max(0, amount*baseRate - fee);
  const eta = (evmFrom && evmTo) ? '~3–6 min' : '~4–9 min';
  return { rate: baseRate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta, route: evmFrom && evmTo ? 'EVM/Stargate' : 'Wormhole' };
}

export async function buildTx({ fromChain, toChain, tokenIn='USDC', tokenOut='USDC', amount=0, recipient }){
  const evmFrom = fromChain !== 'solana';
  const evmTo = toChain !== 'solana';
  if(evmFrom && evmTo){
    // Return a generic unsigned EVM tx (you will replace "to" and "data")
    return { chainType:'evm', tx:{ to:'0xYourRouterAddress', data:'0x', value:'0x0' } };
  }else{
    // Solana leg placeholder for Phantom
    return { chainType:'svm', tx: { /* VersionedTransaction serialized base64 expected by Phantom */ } };
  }
}
