/* Endpoint: /api/coins
   POST body: { userId, action, amount?, code? }
   action: get | add | spend | refund | checkin | redeem
*/
const { getStore } = require("@netlify/blobs");

const CHECKIN_INTERVAL = 3 * 60 * 60 * 1000;
const CHECKIN_REWARD   = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function ok(data){
  return { statusCode:200, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(data) };
}
function err(msg, extra){
  return { statusCode:400, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(Object.assign({ error: msg }, extra||{})) };
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS") return { statusCode:200, headers:CORS, body:"" };
  if(event.httpMethod !== "POST") return { statusCode:405, headers:CORS, body:"Method not allowed" };

  let body = {};
  try{ body = JSON.parse(event.body || "{}"); }catch{}
  const { userId, action } = body;
  if(!userId) return err("userId wajib");

  const store = getStore("toolhub");
  const userKey = "user:" + userId;

  let user = await store.get(userKey, { type:"json" }) || { coins:0, lastCheckin:0 };

  try{
    if(action === "get"){
      const ready = Date.now() - (user.lastCheckin||0) >= CHECKIN_INTERVAL;
      return ok({ coins: user.coins|0, checkinReady: ready, lastCheckin: user.lastCheckin|0 });
    }

    if(action === "add"){
      const n = Math.max(0, parseInt(body.amount)||0);
      user.coins = (user.coins|0) + n;
      await store.setJSON(userKey, user);
      return ok({ coins: user.coins });
    }

    if(action === "spend"){
      const n = Math.max(0, parseInt(body.amount)||0);
      if((user.coins|0) < n) return err("coin kurang", { coins: user.coins|0 });
      user.coins = (user.coins|0) - n;
      await store.setJSON(userKey, user);
      return ok({ coins: user.coins });
    }

    if(action === "refund"){
      const n = Math.max(0, parseInt(body.amount)||0);
      user.coins = (user.coins|0) + n;
      await store.setJSON(userKey, user);
      return ok({ coins: user.coins });
    }

    if(action === "checkin"){
      const ready = Date.now() - (user.lastCheckin||0) >= CHECKIN_INTERVAL;
      if(!ready) return err("belum waktunya", { lastCheckin: user.lastCheckin|0 });
      user.lastCheckin = Date.now();
      user.coins = (user.coins|0) + CHECKIN_REWARD;
      await store.setJSON(userKey, user);
      return ok({ coins: user.coins, reward: CHECKIN_REWARD });
    }

    if(action === "redeem"){
      const code = String(body.code||"").trim().toUpperCase();
      if(!code) return err("kode kosong");
      const codeKey = "code:" + code;
      const item = await store.get(codeKey, { type:"json" });
      if(!item) return err("kode invalid");
      if(item.used) return err("kode sudah dipakai");
      item.used = true;
      item.usedBy = userId;
      item.usedAt = Date.now();
      await store.setJSON(codeKey, item);
      user.coins = (user.coins|0) + (item.coins|0);
      await store.setJSON(userKey, user);
      return ok({ coins: user.coins, reward: item.coins });
    }

    return err("action tidak dikenal");
  }catch(e){
    return { statusCode:500, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify({ error: e.message }) };
  }
};
