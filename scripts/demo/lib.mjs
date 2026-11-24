import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import fs from "fs";
export const RPC = "https://studio-dev.genlayer.com/api";
export const ADDR = process.env.ADDR; // contract address, set per run
export const GEN = 10n ** 18n;
export async function rpc(method, params) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const b = await r.json(); if (b.error) throw new Error(JSON.stringify(b.error)); return b.result;
}
export function acct(name) {
  const f = `key_${name}`;
  if (!fs.existsSync(f)) fs.writeFileSync(f, generatePrivateKey());
  return createAccount(fs.readFileSync(f, "utf8").trim());
}
export const bal = async (a) => BigInt(await retry(() => rpc("eth_getBalance", [a, "latest"])));
export const fmt = (w) => (Number(w) / 1e18).toFixed(4);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Retry only while the RPC refuses the request ("Server busy", fetch failed). */
export async function retry(f, tries = 25) {
  for (let i = 0; ; i++) {
    try { return await f(); } catch (e) {
      const m = String(e?.message || e);
      if (i >= tries || !/busy|fetch failed|ECONNRESET|429|timeout|socket|rate limit|-32029/i.test(m)) throw e;
      await sleep(3000 + 1000 * i);
    }
  }
}
export async function read(fn, args = []) { return retry(() => createClient({ chain: studioDevnet }).readContract({ address: ADDR, functionName: fn, args })); }
export async function call(account, fn, args = [], value = 0n, final = false) {
  const client = createClient({ chain: studioDevnet, account });
  const fees = await retry(() => client.estimateTransactionFees({}));
  // Sending is retried only on a refused request, so a transaction is never sent twice.
  const hash = await retry(() => client.writeContract({ address: ADDR, functionName: fn, args, value, fees }));
  const rec = await retry(() => client.waitForTransactionReceipt({ hash, status: final ? TransactionStatus.FINALIZED : TransactionStatus.ACCEPTED, retries: 300, interval: 3000 }));
  const s = JSON.stringify(rec, (k, v) => (typeof v === "bigint" ? v.toString() : v));
  const exec = (s.match(/"execution_result":"(\w+)"/) || s.match(/"executionResult":"?(\w+)"?/) || [])[1];
  const line = { fn, args: args.map(String).map((x) => x.slice(0, 60)), value: fmt(value), hash, status: rec.statusName || rec.status, exec };
  console.log(JSON.stringify(line));
  fs.appendFileSync("log.jsonl", JSON.stringify(line) + "\n");
  return { hash, rec, s, exec };
}
