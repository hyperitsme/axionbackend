// src/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;

// health check
app.get('/healthz', (req, res) => res.send('ok'));

// simple quote (mock – ganti ke logicmu nanti)
app.get('/api/quote', (req, res) => {
  const { fromChain, toChain, token = 'USDC', amount = '0' } = req.query;
  const amt = Number(amount || 0);
  if (!amt) return res.json({ rate: '–', fee: '–', toAmount: '', eta: '–' });

  const evmFrom = fromChain !== 'solana';
  const evmTo = toChain !== 'solana';
  const baseRate = 0.999;
  const fee = Math.max(0.0005, amt * 0.001);
  const toAmount = Math.max(0, amt * baseRate - fee);
  const eta = (evmFrom && evmTo) ? '~3–6 min' : '~4–9 min';

  res.json({
    rate: baseRate,
    fee: +fee.toFixed(6),
    toAmount: +toAmount.toFixed(6),
    eta,
    route: evmFrom && evmTo ? 'EVM/Stargate' : 'Wormhole'
  });
});

// build tx (demo – kembalikan unsigned tx)
app.post('/api/bridge', (req, res) => {
  res.json({
    chainType: 'evm',
    tx: { to: '0x0000000000000000000000000000000000000000', data: '0x', value: '0x0' }
  });
});

// fallback untuk debug path
app.use((req, res) => res.status(404).send('Not Found'));

app.listen(PORT, () => {
  console.log('Axion slim server on :' + PORT);
});
