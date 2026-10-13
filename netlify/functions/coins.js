/* Endpoint: /api/coins */
const CHECKIN_INTERVAL = 3 * 60 * 60 * 1000;
const CHECKIN_REWARD   = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function ok(data){ return { statusCode:200, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(data) }; }
function err(msg, extra){ return { statusCode:400, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(Object.assign({ error: msg }, extra||{})) }; }

/* --- in-memory store --- */
let USERS = {};    // { userId: { coins, lastCheckin } }
let CODES = {};    // { CODE: { coins, used } }

exports.handler = async (event) => {
  try {
    if(event.httpMethod === "OPTIONS") return { statusCode:200, headers:CORS, body:"" };
    if(event.httpMethod !== "POST") return { statusCode:405, headers:CORS, body:"Method not allowed" };

    let body = {};
    try{ body = JSON.parse(event.body || "{}"); }catch{}
    const { userId, action } = body;
    if(!userId) return err("userId wajib");

    if(!USERS[userId]) USERS[userId] = { coins:0, lastCheckin:0 };
    const u = USERS[userId];

    if(action === "get"){
      const ready = Date.now() - (u.lastCheckin||0) >= CHECKIN_INTERVAL;
      return ok({ coins: u.coins|0, checkinReady: ready, lastCheckin: u.lastCheckin|0 });
    }

    if(action === "add"){
      const n = Math.max(0, parseInt(body.amount)||0);
      u.coins = (u.coins|0) + n;
      return ok({ coins: u.coins });
    }

    if(action === "spend"){
      const n = Math.max(0, parseInt(body.amount)||0);
      if((u.coins|0) < n) return err("coin kurang", { coins: u.coins|0 });
      u.coins = (u.coins|0) - n;
      return ok({ coins: u.coins });
    }

    if(action === "refund"){
      const n = Math.max(0, parseInt(body.amount)||0);
      u.coins = (u.coins|0) + n;
      return ok({ coins: u.coins });
    }

    if(action === "checkin"){
      const ready = Date.now() - (u.lastCheckin||0) >= CHECKIN_INTERVAL;
      if(!ready) return err("belum waktunya", { lastCheckin: u.lastCheckin|0 });
      u.lastCheckin = Date.now();
      u.coins = (u.coins|0) + CHECKIN_REWARD;
      return ok({ coins: u.coins, reward: CHECKIN_REWARD });
    }

    if(action === "redeem"){
      const code = String(body.code||"").trim().toUpperCase();
      if(!code) return err("kode kosong");
      const item = CODES[code];
      if(!item) return err("kode invalid");
      if(item.used) return err("kode sudah dipakai");
      item.used = true;
      u.coins = (u.coins|0) + (item.coins|0);
      return ok({ coins: u.coins, reward: item.coins });
    }

    return err("action tidak dikenal");
  } catch (e) {
    return { statusCode:500, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
