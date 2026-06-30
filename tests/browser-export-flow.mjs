#!/usr/bin/env node
// tests/browser-export-flow.mjs
// Proves the REAL product workflow end to end by driving the actual index.html
// UI (not an internal test page): it loads the shipped page in an iframe,
// injects two generated speaker clips into the real <input type=file> controls,
// clicks the real Compose and Export buttons, and verifies the preview painted
// real uploaded frames and the export is a genuinely playable video.
//
// Not named *.test.js, so the zero-dep gate (scripts/run-tests.mjs) does not run
// it. Needs a Chrome/Chromium binary (set CHROME_PATH); SKIPS cleanly (exit 0)
// when none is present so it never breaks a build. Run it manually:
//   node tests/browser-export-flow.mjs
import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
  .filter(Boolean).find((p) => existsSync(p));
if (!CHROME) {
  console.log("SKIP browser-export-flow: no Chrome/Chromium found (set CHROME_PATH to run).");
  process.exit(0);
}

const DRIVE = `<!doctype html><meta charset=utf-8><body>
<iframe id=app src="/index.html" width=1280 height=720 style="border:0"></iframe>
<script>
const post=(o)=>fetch('/__result',{method:'POST',body:JSON.stringify(o)});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms){const t=Date.now();while(Date.now()-t<ms){if(fn())return true;await sleep(120);}return false;}
async function makeClip(color,label){const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');
  const vs=c.captureStream(25);const ac=new AudioContext();const o=ac.createOscillator();const d=ac.createMediaStreamDestination();o.connect(d);o.start();
  const s=new MediaStream([...vs.getVideoTracks(),...d.stream.getAudioTracks()]);const r=new MediaRecorder(s,{mimeType:'video/webm'});const ch=[];r.ondataavailable=e=>{if(e.data&&e.data.size)ch.push(e.data)};const done=new Promise(z=>r.onstop=z);
  r.start(100);let t=0;const iv=setInterval(()=>{x.fillStyle=color;x.fillRect(0,0,640,480);x.fillStyle='#fff';x.font='48px sans-serif';x.fillText(label+' '+(t++),40,240)},40);
  await sleep(2000);clearInterval(iv);o.stop();r.requestData();r.stop();await done;ac.close();return new Blob(ch,{type:'video/webm'});}
(async()=>{try{
  const fr=document.getElementById('app');
  await new Promise(r=>{fr.onload=r;setTimeout(r,4000);});
  const ok=await until(()=>fr.contentWindow&&fr.contentWindow.PDC&&fr.contentWindow.__pdc,6000);
  if(!ok)return post({pass:false,why:'app did not initialize in iframe'});
  const doc=fr.contentDocument, win=fr.contentWindow;
  const A=await makeClip('#d23b3b','HOST'),B=await makeClip('#2f7be0','GUEST');
  function setFile(bucket,blob,name){const inp=doc.querySelector('input[data-bucket="'+bucket+'"]');const dt=new DataTransfer();dt.items.add(new File([blob],name,{type:'video/webm'}));inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));}
  setFile('host',A,'host.webm'); await until(()=>win.__pdc.videos.host,8000);
  setFile('guest1',B,'guest.webm'); await until(()=>win.__pdc.videos.guest1,8000);
  doc.querySelector('[data-preset="side-by-side"]').click();
  const composeReady=await until(()=>!doc.getElementById('compose').disabled,8000);
  if(!composeReady)return post({pass:false,why:'Compose stayed disabled after real upload+preset',status:doc.getElementById('readiness').textContent});
  doc.getElementById('compose').click();
  await until(()=>win.__pdc.plan,5000);
  // sample the host frame on the REAL app canvas -> must be the red clip, not placeholder
  const cv=doc.getElementById('stage');const cx=cv.getContext('2d');const f=win.__pdc.plan.frames[0];
  const px=cx.getImageData(Math.round(f.x+f.w/2),Math.round(f.y+f.h/2),1,1).data;
  const realFrame=px[0]>120&&px[0]>px[2];
  doc.getElementById('export').click();
  const exported=await until(()=>win.__exportResult&&win.__exportResult.bytes>2000,30000);
  const res=win.__exportResult||{};
  // verify the exported blob is genuinely playable
  let playable=false,ew=0,eh=0;
  if(res.url){const ev=document.createElement('video');ev.src=res.url;ev.muted=true;await new Promise(z=>{ev.onloadedmetadata=z;ev.onerror=z;setTimeout(z,4000)});ew=ev.videoWidth;eh=ev.videoHeight;playable=ew>0;}
  post({pass:exported&&playable&&realFrame, bytes:res.bytes||0, exportW:ew, exportH:eh, realFrame});
}catch(e){post({pass:false,why:String(e&&e.stack||e)});}})();
<\/script></body>`;

const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };
let resolveResult;
const result = new Promise((r) => (resolveResult = r));
const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/__result") {
    let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { res.end("ok"); resolveResult(b); });
    return;
  }
  const url = req.url.split("?")[0];
  if (url === "/" || url === "/__drive") { res.setHeader("content-type", "text/html"); res.end(DRIVE); return; }
  const full = path.join(root, url);
  const s = await stat(full).catch(() => null);
  if (s && s.isFile() && full.startsWith(root)) {
    res.setHeader("content-type", TYPES[path.extname(full)] || "application/octet-stream");
    res.end(await readFile(full)); return;
  }
  res.writeHead(404).end();
});
server.on("error", (e) => { console.error("SKIP browser-export-flow: server error " + e.message); process.exit(0); });
server.listen(0, "127.0.0.1", () => {
  const PORT = server.address().port;
  const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu",
    "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream",
    "--remote-debugging-port=0", `http://localhost:${PORT}/__drive`], { stdio: "ignore" });
  Promise.race([result, new Promise((r) => setTimeout(() => r('{"pass":false,"why":"timeout"}'), 60000))]).then((raw) => {
    chrome.kill("SIGKILL"); server.close();
    let r = {}; try { r = JSON.parse(raw); } catch { r = { pass: false, why: "bad result" }; }
    console.log("browser-export-flow:", JSON.stringify(r));
    if (r.pass) { console.log("PASS: real UI upload -> compose -> export verified on the shipped page."); process.exit(0); }
    console.error("FAIL: " + (r.why || "workflow did not verify")); process.exit(1);
  });
});
