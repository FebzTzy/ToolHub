/* Endpoint: /api/redeem
   GET → list kode
   POST { action:create|delete|clear }
   BUTUH header X-Admin-Token
*/
const ADMIN_TOKEN = "FEBZ-ADMIN-2026";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token"
};

function ok(data){ return { statusCode:200, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify(data) }; }
function err(msg, code){ return { statusCode: code||400, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify({ error: msg }) }; }

/* --- in-memory store (ephemeral, cukup buat test) --- */
let CODES = {};  // { KODE: { coins, used, createdAt } }

function randSeg(n){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for(let i=0;i<n;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

exports.handler = async (event) => {
  try {
    if(event.httpMethod === "OPTIONS") return { statusCode:200, headers:CORS, body:"" };

    const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
    if(token !== ADMIN_TOKEN) return err("token admin salah", 401);

    if(event.httpMethod === "GET"){
      const list = Object.entries(CODES).map(([code, meta]) => ({ code, ...meta }));
      return ok({ codes: list });
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
          do { code = prefix+"-"+randSeg(4)+"-"+randSeg(4); } while(CODES[code]);
          CODES[code] = { coins, used:false, createdAt: Date.now() };
          made.push(code);
        }
        return ok({ created: made });
      }

      if(action === "delete"){
        const c = String(body.code||"").toUpperCase();
        delete CODES[c];
        return ok({ deleted: c });
      }

      if(action === "clear"){
        CODES = {};
        return ok({ cleared: true });
      }
    }

    return err("bad request");
  } catch (e) {
    return { statusCode:500, headers:{ ...CORS, "Content-Type":"application/json" }, body: JSON.stringify({ error: e.message, stack: e.stack }) };
  }
};
