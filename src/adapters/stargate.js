import { ethers } from "ethers";
import { providerFor, usdcOf, ERC20_ABI, toUnits } from "../utils/evm.js";
import { isEvm } from "../utils/chains.js";

/** Quote EVM↔EVM (dummy formula yang “masuk akal”) */
export async function getQuoteEvm({ fromChain, toChain, token, amount }) {
  if (!isEvm(fromChain) || !isEvm(toChain)) throw new Error("EVM route only");
  // contoh estimasi fee + rate
  const rate = 0.9992;
  const fee = Math.max(0.25, amount * 0.0015); // 0.15% min 0.25
  const toAmount = Math.max(0, amount * rate - fee);
  const eta = "~3–6 min";
  return { route: "Stargate", rate, fee: +fee.toFixed(6), toAmount: +toAmount.toFixed(6), eta };
}

/** Build tx EVM:
 *  - Jika allowance kurang, kembalikan tx approve terlebih dulu.
 *  - REAL tx: isi calldata swap di sini (beri contoh encoder).
 *  - Kalau router belum diisi => payload demo (no-op).
 */
export async function buildEvmTx({ fromChain, toChain, token = "USDC", amount }) {
  const router = process.env.STARGATE_ROUTER_ADDRESS;
  const p = providerFor(fromChain);
  const usdc = usdcOf(fromChain);
  const owner = "0x0000000000000000000000000000000000000000"; // UI akan menetapkan sender via MetaMask

  const erc = new ethers.Contract(usdc, ERC20_ABI, p);
  const amt = await toUnits(p, usdc, amount);

  // NOTE: kita tidak punya address owner di backend; biarkan UI mengirim approve sendiri
  // Cara praktis: selalu minta approve dulu (frontend akan mengirim dari address user).
  // Jika ingin benar2 cek allowance, kirimkan 'checkAllowance' endpoint terpisah.

  if (!router) {
    // DEMO payload: tx kosong biar MetaMask tetap kirim (no-op)
    return {
      chainType: "evm",
      tx: {
        to: usdc,
        data: "0x", // no-op
        value: "0x0"
      },
      note: "STARGATE_ROUTER_ADDRESS kosong → ini demo payload (tidak akan memindahkan dana)."
    };
  }

  // === APPROVE (frontend akan kirim, lalu panggil /api/bridge lagi) ===
  const ifaceERC20 = new ethers.Interface(ERC20_ABI);
  const approveData = ifaceERC20.encodeFunctionData("approve", [router, amt]);
  return {
    chainType: "evm",
    needsApproval: true,
    tx: { to: usdc, data: approveData, value: "0x0" },
    note: "Kirim approve dulu. Setelah mined, panggil /api/bridge lagi untuk tx swap."
  };

  /* === REAL tx Stargate (contoh encoder – ISI sesuai router/pool versimu) ===
  const ROUTER_ABI = [
    "function swap(uint16 dstChainId, uint256 poolIdFrom, uint256 poolIdTo, address refundAddress, uint256 amountLD, uint256 minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) lzTxParams, bytes to,address payload)"
  ];
  const iface = new ethers.Interface(ROUTER_ABI);
  const data = iface.encodeFunctionData("swap", [
    /* dstChainId */ 8453, /* ganti ke chainId LZ Base */,
    /* poolIdFrom */ 1, /* isi */,
    /* poolIdTo   */ 1, /* isi */,
    /* refund     */ owner,
    /* amountLD   */ amt,
    /* minAmount  */ amt * 995n/1000n, // 0.5% slippage example
    /* lzTxParams */ [0, 0, "0x"],
    /* to         */ owner,
    /* payload    */ "0x"
  ]);
  return { chainType:"evm", tx: { to: router, data, value:"0x0" } };
  */
}
