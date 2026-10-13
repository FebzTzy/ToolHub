/* Endpoint: /api/redeem
   GET → list kode
   POST { action:create, coins, qty, prefix }
   POST { action:delete, code }
   POST { action:clear }
   BUTUH header X-Admin-Token yang cocok dengan ADMIN_TOKEN di file ini
*/
const { getStore } = require("@netlify/blobs");

const ADMIN_TOKEN = "FEBZ-OWNER-6651"; // ganti kalau mau

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token"
};
function ok(data){ return { statusCode:200, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(data) }; }
function err(msg, code){ return { statusCode: code||400, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify({ error: msg }) }; }

function randSeg(n){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for(let i=0;i<n;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

exports.handler = async (event) => {
  if(event.httpMethod === "OPTIONS") return { statusCode:200, headers:CORS, body:"" };

  const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  if(token !== ADMIN_TOKEN) return err("token admin salah", 401);

  const store = getStore("toolhub");

  if(event.httpMethod === "GET"){
    const { blobs } = await store.list({ prefix: "code:" });
    const codes = [];
    for(const b of blobs){
      const data = await store.get(b.key, { type:"json" });
      if(data) codes.push(Object.assign({ code: b.key.replace(/^code:/,"") }, data));
    }
    return ok({ codes });
  }

  if(event.httpMethod === "POST"){
    let body = {};
    try{ body = JSON.parse(event.body || "{}"); }catch{}
    const { action } = body;

    if(action === "create"){
      const coins  = Math.max(1, parseInt(body.coins)||0);
      const qty    = Math.max(1, Math.min(50, parseInt(body.qty)||1));
      const prefix = String(body.prefix||"FEBZ").toUpperCase().replace(/[^A-Z0-9]/g,"") || "FEBZ";
      const made = [];
      for(let i=0;i<qty;i++){
        let code;
        let exists = true;
        while(exists){
          code = prefix+"-"+randSeg(4)+"-"+randSeg(4);
          const cur = await store.get("code:"+code, { type:"json" });
          exists = !!cur;
        }
        await store.setJSON("code:"+code, { coins, used:false, createdAt: Date.now() });
        made.push(code);
      }
      return ok({ created: made });
    }

    if(action === "delete"){
      const code = String(body.code||"").toUpperCase();
      await store.delete("code:"+code);
      return ok({ deleted: code });
    }

    if(action === "clear"){
      const { blobs } = await store.list({ prefix: "code:" });
      for(const b of blobs) await store.delete(b.key);
      return ok({ cleared: true });
    }
  }

  return err("bad request");
};
