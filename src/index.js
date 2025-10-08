import express from 'express'; import cors from 'cors'; import dotenv from 'dotenv';
import { quote as quoteAxion, buildTx as buildAxion } from './quoteBridge.js';
dotenv.config();
const app = express(); app.use(cors()); app.use(express.json());
const PORT = process.env.PORT || 8787;

app.get('/api/quote', async (req,res)=>{
  try{ const q = await quoteAxion(req.query); res.json(q);}catch(e){ console.error(e); res.status(500).json({error:'Quote error', detail:String(e.message||e)})}
});
app.post('/api/bridge', async (req,res)=>{
  try{ const tx = await buildAxion(req.body); res.json(tx);}catch(e){ console.error(e); res.status(500).json({error:'Build error', detail:String(e.message||e)})}
});
app.listen(PORT, ()=>console.log('Axion slim server on :'+PORT));
