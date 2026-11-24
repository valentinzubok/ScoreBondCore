// ScoreBond lifecycle on Studio Dev. State-aware and resumable: every step has a label, done
// steps are skipped on a rerun, scoring rounds are resent when the stored state did not move.
// Usage: ADDR=0x... node run.mjs
import fs from "fs";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { acct, rpc, bal, call, read, retry, GEN, fmt } from "./lib.mjs";

const RAW = "https://raw.githubusercontent.com/valentinzubok/ScoreBondCore/c93c1ccbdc056a17a2d4dcdd8396af104d51a15c/fixtures/deliveries/";
const GOOD = RAW + "good-guide.md";
const THIN = RAW + "thin-guide.md";
const RUBRIC =
  "A contributor guide for a Python repository. It must explain, with concrete runnable commands, " +
  "(1) how to set up the project, (2) how to run the tests, (3) how to open a pull request. " +
  "Each of the three parts is worth about a third of the score; a part that is missing or only " +
  "says 'see the readme' earns nothing for that part.";

const P = acct("provider");
const C = acct("client");
const S = acct("stranger");
const WHO = { [P.address]: "provider", [C.address]: "client", [S.address]: "stranger" };

const DONE_F = "done.json";
const done = fs.existsSync(DONE_F) ? JSON.parse(fs.readFileSync(DONE_F, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowS = () => Math.floor(Date.now() / 1000);
const J = async (fn, args) => JSON.parse(await read(fn, args));
const reader = createClient({ chain: studioDevnet });

async function payloadOf(hash) {
  try {
    const tx = await retry(() => reader.getTransaction({ hash }));
    const s = JSON.stringify(tx, (k, v) => (typeof v === "bigint" ? v.toString() : v));
    const m = s.match(/"payload":"((?:[^"\\]|\\.){0,400})/);
    return m ? m[1] : "";
  } catch (e) {
    return "";
  }
}

let n = Object.keys(done).length;
async function step(label, note, who, fn, args = [], value = 0n) {
  if (done[label]) return done[label];
  const r = await call(who, fn, args, value);
  const payload = await payloadOf(r.hash);
  n += 1;
  const row = { n, label, note, sender: WHO[who.address], from: who.address, fn, args: args.map((a) => String(a).slice(0, 80)), value: fmt(value), hash: r.hash, exec: r.exec, payload, at: new Date().toISOString() };
  fs.appendFileSync("steps.jsonl", JSON.stringify(row) + "\n");
  console.log(`#${n} ${label} ${r.exec} ${payload.slice(0, 200)}`);
  done[label] = row;
  fs.writeFileSync(DONE_F, JSON.stringify(done, null, 1));
  return row;
}

async function waitUntil(ts, why) {
  const t = Number(ts) + 15;
  while (nowS() < t) {
    console.log(`waiting ${t - nowS()} s for ${why}`);
    await sleep(Math.min(30000, (t - nowS()) * 1000));
  }
}

// Score delivery `d` of bond `bid` until it has a final score; resend rounds that changed nothing.
async function scoreUntilFinal(bid, d) {
  for (let attempt = 1; ; attempt++) {
    const st = await J("get_delivery", [bid, d]);
    if (st.final_score >= 0) return st;
    if (st.rounds > 0) {
      const b = await J("get_bond", [bid]);
      await waitUntil(st.last_round_at + b.round_interval, `${bid} delivery ${d} interval`);
    }
    const label = `score-${bid}-d${d}-a${attempt}`;
    await step(label, `scoring round of ${bid} delivery ${d}${attempt > 1 ? ` (attempt ${attempt})` : ""}`, S, "score", [bid, d]);
    const after = await J("get_delivery", [bid, d]);
    if (after.rounds > st.rounds) {
      const rr = await J("get_round", [bid, d, after.rounds]);
      done[label].round = rr;
      fs.writeFileSync(DONE_F, JSON.stringify(done, null, 1));
      fs.appendFileSync("rounds.jsonl", JSON.stringify(rr) + "\n");
      console.log(`   -> ${bid} d${d} round ${after.rounds}: ${rr.finding} score ${rr.score} passes ${rr.passes} final ${rr.final_score}`);
    } else {
      done[label].note += " - state did not move (no consensus), resent";
      fs.writeFileSync(DONE_F, JSON.stringify(done, null, 1));
      console.log(`   -> ${bid} d${d}: state did not move, resending`);
      await sleep(10000);
    }
    if (attempt >= 8) throw new Error("too many scoring attempts");
  }
}

for (const a of [P, C, S]) {
  if ((await bal(a.address)) < 30n * GEN) await retry(() => rpc("sim_fundAccount", [a.address, 100e18]));
}
console.log("provider", P.address, "client", C.address, "stranger", S.address);
fs.writeFileSync("accounts.json", JSON.stringify({ provider: P.address, client: C.address, stranger: S.address }, null, 1));

// 1. Bonds. Windows: delivery 1800 s, scoring 1800 s; 1 scoring round per delivery.
await step("open-met-1", "met-1: 2 GEN, bar 70, 1 delivery, 1 scoring round", P, "open_bond",
  ["met-1", C.address, "Contributor guide for harbor", RUBRIC, "70", "1", "1800", "1800", "1", "60"], 2n * GEN);
await step("expire-met-1-early", "expire met-1 right after opening, before its final deadline", S, "expire", ["met-1"]);
await step("open-breach-1", "breach-1: 2 GEN, bar 70, 2 deliveries that must each reach the bar, 1 scoring round each", P, "open_bond",
  ["breach-1", C.address, "Contributor guide, two drafts", RUBRIC, "70", "2", "1800", "1800", "1", "60"], 2n * GEN);

// 2. Deliveries
await step("deliver-met-1-stranger", "a stranger tries to deliver for met-1", S, "deliver", ["met-1", GOOD]);
await step("deliver-met-1", "met-1 delivery 1: good-guide.md", P, "deliver", ["met-1", GOOD]);
await step("deliver-breach-1-d1", "breach-1 delivery 1: good-guide.md", P, "deliver", ["breach-1", GOOD]);
await step("deliver-breach-1-d2", "breach-1 delivery 2: thin-guide.md (one line, no commands)", P, "deliver", ["breach-1", THIN]);
await step("settle-breach-1-early", "settle breach-1 before any delivery is scored", S, "settle", ["breach-1"]);

// 3. Scoring
await scoreUntilFinal("met-1", 1);
await scoreUntilFinal("breach-1", 1);
await scoreUntilFinal("breach-1", 2);

// 4. Settlement and withdrawals
await step("settle-met-1", "settle met-1", S, "settle", ["met-1"]);
await step("settle-breach-1", "settle breach-1", S, "settle", ["breach-1"]);
await step("withdraw-met-1-client", "the client tries to take the met-1 bond", C, "withdraw", ["met-1"]);
await step("withdraw-met-1-provider", "the provider takes the met-1 bond back", P, "withdraw", ["met-1"]);
await step("withdraw-met-1-provider-again", "the provider withdraws met-1 a second time", P, "withdraw", ["met-1"]);
await step("withdraw-breach-1-provider", "the provider tries to take the breach-1 bond", P, "withdraw", ["breach-1"]);
await step("withdraw-breach-1-client", "the client takes the breach-1 bond", C, "withdraw", ["breach-1"]);

// 5. End state
const end = {
  met1: await J("get_bond", ["met-1"]),
  breach1: await J("get_bond", ["breach-1"]),
  d_met1: await J("get_delivery", ["met-1", 1]),
  d_b1: await J("get_delivery", ["breach-1", 1]),
  d_b2: await J("get_delivery", ["breach-1", 2]),
  balance: await J("get_balance", []),
  events: await read("count_events", []),
};
for (const k of ["d_met1", "d_b1", "d_b2"]) delete end[k].text;
fs.writeFileSync("end.json", JSON.stringify(end, (k, v) => (typeof v === "bigint" ? v.toString() : v), 1));
console.log(JSON.stringify(end.balance), "events", String(end.events));
console.log("DONE");
