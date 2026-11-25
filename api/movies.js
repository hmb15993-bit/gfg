/* GFG Movies helper: asks TMDB for titles/posters on the server, so the Movies tab still works on networks that block themoviedb.org
   and the API key is never sent to the browser.
   - Only signed-in members: the tab uses the same 2 hour key as the Proxy tab (?k=, from op "pxtoken").
   - Only a short list of TMDB read-only paths is allowed, plus poster images.
   - Env var TMDB_KEY (optional): overrides the key built in below, so you can keep the key out of the code. */
const crypto=require('crypto');
const SEC=process.env.SESSION_SECRET||'';
const KEY=process.env.TMDB_KEY||'ce2f9e51a2ad61fa8d66b969a45727f9';
const sign=s=>crypto.createHmac('sha256',SEC).update(s).digest('base64url');
function okTok(k){const p=String(k||'').split('.');if(p.length!==3)return false;const[u,e,s]=p;
 if(!/^[a-z0-9_]{1,16}$/.test(u)||!/^\d{10,15}$/.test(e)||+e<Date.now())return false;
 const a=Buffer.from(sign('px:'+u+'.'+e)),b=Buffer.from(s);return a.length===b.length&&crypto.timingSafeEqual(a,b)}
const PATH=/^\/(trending\/(all|movie|tv)\/(day|week)|discover\/(movie|tv)|search\/multi|(movie|tv)\/\d{1,10}|tv\/\d{1,10}\/season\/\d{1,3})$/;
const PARAMS=['page','query','include_adult','sort_by','without_genres','vote_count.gte'];
const J=(res,c,o)=>{res.statusCode=c;res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.end(JSON.stringify(o))};
module.exports=async(req,res)=>{
 try{
  if(!SEC)return J(res,500,{error:'Server not configured: set SESSION_SECRET'});
  const q=new URL(req.url,'http://x').searchParams;
  if(!okTok(q.get('k')))return J(res,401,{error:'Please sign in again.'});
  const img=q.get('img');
  if(img){
   if(!/^\/[A-Za-z0-9_-]{5,60}\.(jpg|png|webp)$/.test(img))return J(res,400,{error:'Bad image'});
   const r=await fetch('https://image.tmdb.org/t/p/w500'+img);
   if(!r.ok)return J(res,502,{error:'Poster error '+r.status});
   res.statusCode=200;res.setHeader('content-type',r.headers.get('content-type')||'image/jpeg');res.setHeader('cache-control','public, max-age=86400');
   return res.end(Buffer.from(await r.arrayBuffer()))}
  const p=String(q.get('p')||''),[path,qs]=p.split('?');
  if(!PATH.test(path))return J(res,400,{error:'Not allowed'});
  const src=new URLSearchParams(qs||''),u=new URL('https://api.themoviedb.org/3'+path);
  for(const k of PARAMS)if(src.has(k))u.searchParams.set(k,String(src.get(k)).slice(0,200));
  u.searchParams.set('api_key',KEY);u.searchParams.set('language','en-US');
  const r=await fetch(u);
  if(r.status===401||r.status===403)return J(res,502,{error:'TMDB rejected the API key. Set your own free key as TMDB_KEY in Vercel (see README).'});
  if(!r.ok)return J(res,502,{error:'TMDB error '+r.status});
  res.statusCode=200;res.setHeader('content-type','application/json');res.setHeader('cache-control','private, max-age=300');
  res.end(Buffer.from(await r.arrayBuffer()));
 }catch(e){J(res,502,{error:'Could not reach TMDB from the server.'})}
};
