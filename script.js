(() => {
  "use strict";
  const STORAGE_KEY = "kewaTradeTracker.v2";
  const LEGACY_KEYS = ["kewaTradeTracker", "kewa_trade_tracker", "kewaTrades", "tradeTracker", "trade-tracker", "trades", "tradeData", "kewa_trade_tracker_data"];
  let state = {version:2, userName:"Trader", trades:[]};
  let toastTimer;

  const $ = id => document.getElementById(id);
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
  const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const id = () => "trade_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);

  function normalizeTrade(raw) {
    if (!raw || typeof raw !== "object") return null;
    const symbol = raw.symbol ?? raw.ticker ?? raw.asset ?? raw.pair ?? raw.stock ?? raw.name;
    if (!symbol) return null;
    const entry = num(raw.entryPrice ?? raw.entry ?? raw.buyPrice ?? raw.entry_price ?? raw.openPrice);
    const exitVal = raw.exitPrice ?? raw.exit ?? raw.sellPrice ?? raw.exit_price ?? raw.closePrice;
    const statusRaw = String(raw.status ?? raw.tradeStatus ?? (exitVal !== undefined && exitVal !== "" ? "Closed" : "Open")).toLowerCase();
    const status = statusRaw.includes("open") || statusRaw.includes("active") ? "Open" : "Closed";
    const sideRaw = String(raw.side ?? raw.direction ?? raw.position ?? raw.type ?? "Long").toLowerCase();
    const side = sideRaw.includes("short") || sideRaw.includes("sell") ? "Short" : "Long";
    const marketRaw = String(raw.market ?? raw.marketType ?? raw.assetType ?? raw.category ?? "Stocks").toLowerCase();
    let market = marketRaw.includes("crypto") ? "Crypto" : marketRaw.includes("forex") || marketRaw.includes("fx") ? "Forex" : "Stocks";
    const size = num(raw.size ?? raw.quantity ?? raw.qty ?? raw.positionSize ?? raw.volume ?? 1);
    const exitPrice = exitVal === undefined || exitVal === null || exitVal === "" ? null : num(exitVal);
    let gross = raw.grossPnl ?? raw.grossPnL ?? raw.grossProfit;
    let pnl = raw.pnl ?? raw.profitLoss ?? raw.profit ?? raw.netPnl ?? raw.pl;
    const brokerage = num(raw.brokerage ?? raw.fees ?? raw.commission ?? raw.charges ?? 0);
    if (gross === undefined || gross === null || gross === "") {
      gross = status === "Closed" && exitPrice !== null ? (side === "Long" ? exitPrice-entry : entry-exitPrice)*size : 0;
    } else gross = num(gross);
    if (pnl === undefined || pnl === null || pnl === "") pnl = gross - brokerage;
    else pnl = num(pnl);
    return {
      id: String(raw.id ?? raw.tradeId ?? raw._id ?? id()), symbol:String(symbol).toUpperCase(),
      market, side, status, entryPrice:entry, exitPrice, size, brokerage,
      pnl:status === "Closed" ? pnl : 0,
      date:String(raw.date ?? raw.tradeDate ?? raw.createdAt ?? raw.timestamp ?? today()).slice(0,10),
      strategy:String(raw.strategy ?? raw.setup ?? ""), notes:String(raw.notes ?? raw.journal ?? raw.description ?? raw.comment ?? ""),
      createdAt:raw.createdAt ?? new Date().toISOString()
    };
  }

  function extractTrades(obj) {
    if (Array.isArray(obj)) return obj.map(normalizeTrade).filter(Boolean);
    if (!obj || typeof obj !== "object") return [];
    const likely = ["trades","tradeHistory","tradeData","transactions","records","journal","data","items"];
    for (const key of likely) {
      if (Array.isArray(obj[key])) {
        const result = obj[key].map(normalizeTrade).filter(Boolean);
        if (result.length || obj[key].length === 0) return result;
      }
      if (obj[key] && typeof obj[key] === "object") {
        const nested = extractTrades(obj[key]);
        if (nested.length) return nested;
      }
    }
    // Some backups are objects keyed by trade ID.
    const vals = Object.values(obj);
    if (vals.length && vals.every(v => v && typeof v === "object" && !Array.isArray(v))) {
      const result = vals.map(normalizeTrade).filter(Boolean);
      if (result.length) return result;
    }
    return [];
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = {version:2,userName:String(parsed.userName || "Trader"),trades:extractTrades(parsed)};
        return;
      }
    } catch(e) { console.warn("Could not read KEWA storage",e); }
    // Attempt a cautious, non-destructive migration from common older key names.
    for (const key of LEGACY_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw || key === STORAGE_KEY) continue;
        const parsed = JSON.parse(raw);
        const trades = extractTrades(parsed);
        if (trades.length) {
          state.trades = dedupe(trades);
          saveState();
          showToast(`Recovered ${state.trades.length} trades from browser storage (${key}).`);
          return;
        }
      } catch(e) {}
    }
    state = {version:2,userName:"Trader",trades:[]};
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({...state,updatedAt:new Date().toISOString()}));
      return true;
    } catch(e) {
      showToast("Could not save data. Browser storage may be full or disabled.");
      return false;
    }
  }
  function dedupe(trades) {
    const seen = new Set();
    return trades.map(normalizeTrade).filter(Boolean).filter(t => {
      const key = t.id || [t.symbol,t.date,t.entryPrice,t.exitPrice,t.size,t.pnl].join("|");
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  function closedTrades() { return state.trades.filter(t=>t.status==="Closed"); }
  function stats() {
    const closed=closedTrades(), wins=closed.filter(t=>t.pnl>0), losses=closed.filter(t=>t.pnl<0);
    return {total:state.trades.length,profit:closed.reduce((s,t)=>s+Math.max(0,t.pnl),0),loss:closed.reduce((s,t)=>s+Math.max(0,-t.pnl),0),net:closed.reduce((s,t)=>s+t.pnl,0),brokerage:state.trades.reduce((s,t)=>s+t.brokerage,0),winRate:closed.length?wins.length/closed.length*100:0,wins:wins.length,losses:losses.length,closed:closed.length};
  }
  function showToast(msg) {
    const el=$("toast"); if(!el)return;
    el.textContent=msg; el.classList.add("show"); clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove("show"),3200);
  }
  function pnlClass(n){return n>0?"pnl-positive":n<0?"pnl-negative":"";}
  function render() {
    const s=stats();
    $("totalTrades").textContent=s.total.toLocaleString("en-IN");
    $("totalProfit").textContent=money(s.profit); $("totalLoss").textContent=money(s.loss);
    $("winRate").textContent=s.winRate.toFixed(1)+"%"; $("totalBrokerage").textContent=money(s.brokerage);
    $("chartProfit").textContent=money(s.profit); $("chartLoss").textContent=money(s.loss);
    $("donutTotal").textContent=s.total; $("userNameHeading").textContent=state.userName; $("profileName").textContent=state.userName;
    renderBars(); renderDonut(); renderPerformance(); renderRecent(); renderTrades(); renderJournal();
  }
  function filterByRange(trades,range) {
    if(range==="all")return trades;
    const days=Number(range)||30, cutoff=new Date(); cutoff.setDate(cutoff.getDate()-days);
    return trades.filter(t=>new Date((t.date||today())+"T00:00:00")>=cutoff);
  }
  function renderBars() {
    const trades=filterByRange(closedTrades(),$("chartRange").value);
    const profit=trades.reduce((s,t)=>s+Math.max(0,t.pnl),0), loss=trades.reduce((s,t)=>s+Math.max(0,-t.pnl),0), max=Math.max(profit,loss,1);
    $("profitLossChart").innerHTML=`<div class="bar-columns"><div class="bar-group"><span class="bar-value legend-green">${money(profit)}</span><div class="bar profit" style="height:${Math.max(3,profit/max*78)}%"></div><span class="bar-label">Total Profit</span></div><div class="bar-group"><span class="bar-value legend-red">${money(loss)}</span><div class="bar loss" style="height:${Math.max(3,loss/max*78)}%"></div><span class="bar-label">Total Loss</span></div></div>`;
  }
  function renderDonut() {
    const counts={Stocks:0,Crypto:0,Forex:0}; state.trades.forEach(t=>counts[t.market]=(counts[t.market]||0)+1);
    const total=state.trades.length; let start=0; const colors={Stocks:"#00e7a1",Crypto:"#a855f7",Forex:"#0b8fff"};
    const stops=Object.entries(counts).map(([name,count])=>{const a=start;start+=total?count/total*100:0;return `${colors[name]} ${a}% ${start}%`;});
    $("marketDonut").style.background=total?`conic-gradient(${stops.join(",")})`:"conic-gradient(#1b3158 0 100%)";
    $("marketLegend").innerHTML=Object.entries(counts).map(([name,count])=>`<div class="market-row"><span class="market-dot" style="background:${colors[name]}"></span><span>${name}</span><b>${total?(count/total*100).toFixed(0):0}%</b></div>`).join("");
  }
  function renderPerformance() {
    const trades=filterByRange(closedTrades(),$("performanceRange").value).slice().sort((a,b)=>a.date.localeCompare(b.date));
    const el=$("performanceChart");
    if(!trades.length){el.innerHTML='<div class="chart-empty">Closed trades will appear here.</div>';return;}
    let cum=0; const vals=trades.map(t=>cum+=t.pnl); vals.unshift(0);
    const min=Math.min(...vals,0),max=Math.max(...vals,0),span=max-min||1,w=700,h=140,pad=12;
    const points=vals.map((v,i)=>`${pad+i*(w-2*pad)/(vals.length-1)},${h-pad-(v-min)/span*(h-2*pad)}`).join(" ");
    const zeroY=h-pad-(0-min)/span*(h-2*pad);
    el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Cumulative profit and loss chart"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9d5cff" stop-opacity=".45"/><stop offset="100%" stop-color="#244bff" stop-opacity=".03"/></linearGradient></defs><line x1="${pad}" y1="${zeroY}" x2="${w-pad}" y2="${zeroY}" stroke="#33517d" stroke-dasharray="4 5"/><polyline points="${pad},${zeroY} ${points} ${w-pad},${zeroY}" fill="url(#areaFill)" stroke="none"/><polyline points="${points}" fill="none" stroke="#a58aff" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${vals.map((v,i)=>`<circle cx="${pad+i*(w-2*pad)/(vals.length-1)}" cy="${h-pad-(v-min)/span*(h-2*pad)}" r="${i===vals.length-1?4:2}" fill="#d8d1ff"/>`).join("")}<text x="${pad}" y="10" fill="#a4b8dc" font-size="10">${money(max)}</text><text x="${pad}" y="${h-2}" fill="#a4b8dc" font-size="10">${money(min)}</text></svg>`;
  }
  function renderRecent() {
    const trades=state.trades.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5);
    $("recentTradesBody").innerHTML=trades.map(t=>`<tr><td><b>${esc(t.symbol)}</b></td><td>${esc(t.market)}</td><td><span class="pill ${t.side==="Short"?"short":""}">${t.side}</span></td><td class="${pnlClass(t.pnl)}">${t.status==="Open"?"—":money(t.pnl)}</td><td><span class="pill ${t.status==="Open"?"open":""}">${t.status}</span></td></tr>`).join("");
    $("recentEmpty").style.display=trades.length?"none":"block";
  }
  function renderTrades() {
    const q=$("tradeSearch").value.toLowerCase(), market=$("marketFilter").value,status=$("statusFilter").value;
    const list=state.trades.filter(t=>(!q||(t.symbol+" "+t.notes+" "+t.strategy).toLowerCase().includes(q))&&(market==="all"||t.market===market)&&(status==="all"||t.status===status)).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    $("tradesBody").innerHTML=list.map(t=>`<tr><td><b>${esc(t.symbol)}</b></td><td>${esc(t.market)}</td><td><span class="pill ${t.side==="Short"?"short":""}">${t.side}</span></td><td>${money(t.entryPrice)}</td><td>${t.exitPrice===null?"—":money(t.exitPrice)}</td><td>${t.size}</td><td>${money(t.brokerage)}</td><td class="${pnlClass(t.pnl)}">${t.status==="Open"?"—":money(t.pnl)}</td><td><span class="pill ${t.status==="Open"?"open":""}">${t.status}</span></td><td><div class="row-actions"><button data-edit="${esc(t.id)}">Edit</button><button data-delete="${esc(t.id)}">Delete</button></div></td></tr>`).join("");
    $("tradesEmpty").style.display=list.length?"none":"block";
  }
  function renderJournal() {
    const list=state.trades.filter(t=>t.notes.trim()||t.strategy.trim()).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    $("journalList").innerHTML=list.map(t=>`<article class="panel journal-card"><div class="journal-meta">${esc(t.date)} · ${esc(t.market)} · ${esc(t.side)}</div><h3>${esc(t.symbol)} <span class="${pnlClass(t.pnl)}">${t.status==="Open"?"":money(t.pnl)}</span></h3>${t.strategy?`<b>Strategy:</b> ${esc(t.strategy)}`:""}<p>${esc(t.notes||"No notes added.")}</p><button class="secondary-button" data-edit="${esc(t.id)}">Edit trade</button></article>`).join("");
    $("journalEmpty").style.display=list.length?"none":"block";
  }
  function setView(name) {
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    const view=$(name+"View"); if(view)view.classList.add("active");
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    $("sidebar").classList.remove("open"); window.scrollTo({top:0,behavior:"smooth"});
  }
  function calcPreview() {
    const entry=num($("entryPrice").value),exitRaw=$("exitPrice").value,exit=exitRaw===""?null:num(exitRaw),size=num($("size").value),fee=num($("brokerage").value);
    const gross=exit===null?0:(($("side").value==="Long"?exit-entry:entry-exit)*size);
    const net=$("status").value==="Closed"&&exit!==null?gross-fee:0;
    $("pnlPreview").textContent=money(net); $("pnlPreview").style.color=net<0?"#ff5790":"#00e7a1";
  }
  function openForm(trade=null) {
    $("tradeForm").reset(); $("tradeId").value=trade?.id||"";
    $("dialogTitle").textContent=trade?"Edit Trade":"Add Trade";
    $("symbol").value=trade?.symbol||"";$("market").value=trade?.market||"Stocks";$("side").value=trade?.side||"Long";$("status").value=trade?.status||"Closed";
    $("entryPrice").value=trade?.entryPrice??"";$("exitPrice").value=trade?.exitPrice??"";$("size").value=trade?.size??1;$("brokerage").value=trade?.brokerage??0;
    $("tradeDate").value=trade?.date||today();$("strategy").value=trade?.strategy||"";$("notes").value=trade?.notes||"";
    calcPreview(); if(typeof $("tradeDialog").showModal==="function")$("tradeDialog").showModal();else alert("Your browser does not support the trade form dialog.");
  }
  function saveTrade(ev) {
    ev.preventDefault();
    const symbol=$("symbol").value.trim(); if(!symbol){showToast("Please enter a symbol.");return;}
    const status=$("status").value, exitRaw=$("exitPrice").value, exit=exitRaw===""?null:num(exitRaw);
    if(status==="Closed"&&exit===null){showToast("Add an exit price for a closed trade.");return;}
    const entry=num($("entryPrice").value),size=num($("size").value),fee=num($("brokerage").value),side=$("side").value;
    const gross=exit===null?0:(side==="Long"?exit-entry:entry-exit)*size;
    const trade={id:$("tradeId").value||id(),symbol:symbol.toUpperCase(),market:$("market").value,side,status,entryPrice:entry,exitPrice:exit,size,brokerage:fee,pnl:status==="Closed"&&exit!==null?gross-fee:0,date:$("tradeDate").value||today(),strategy:$("strategy").value.trim(),notes:$("notes").value.trim(),createdAt:new Date().toISOString()};
    const index=state.trades.findIndex(t=>t.id===trade.id);
    if(index>=0)state.trades[index]=trade;else state.trades.push(trade);
    saveState();$("tradeDialog").close();render();showToast(index>=0?"Trade updated.":"Trade saved.");
  }
  function deleteTrade(tradeId) {
    const trade=state.trades.find(t=>t.id===tradeId); if(!trade)return;
    if(!confirm(`Delete ${trade.symbol} trade? This cannot be undone unless you have a backup.`))return;
    state.trades=state.trades.filter(t=>t.id!==tradeId);saveState();render();showToast("Trade deleted.");
  }
  function download(filename,content,type) {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportJson() {
    const backup={app:"KEWA Trade Tracker",version:2,exportedAt:new Date().toISOString(),userName:state.userName,trades:state.trades};
    download("kewa-trade-tracker-backup-"+today()+".json",JSON.stringify(backup,null,2),"application/json");
    showToast("JSON backup downloaded.");
  }
  function csvCell(v){const s=String(v??"");return '"'+s.replace(/"/g,'""')+'"';}
  function exportCsv() {
    const fields=["id","symbol","market","side","status","entryPrice","exitPrice","size","brokerage","pnl","date","strategy","notes"];
    const rows=[fields,...state.trades.map(t=>fields.map(f=>t[f]??""))].map(row=>row.map(csvCell).join(",")).join("\r\n");
    download("kewa-trades-"+today()+".csv","\ufeff"+rows,"text/csv;charset=utf-8");showToast("CSV exported.");
  }
  async function importJsonFile(file) {
    if(!file)return;
    try {
      const parsed=JSON.parse(await file.text());const imported=extractTrades(parsed);
      if(!imported.length){showToast("No recognizable trades found in this JSON file.");return;}
      const mode=document.querySelector('input[name="importMode"]:checked').value;
      if(mode==="replace"&&!confirm(`Replace current ${state.trades.length} trades with ${imported.length} imported trades? Export a backup first if unsure.`))return;
      if(mode==="replace")state.trades=dedupe(imported);
      else state.trades=dedupe([...state.trades,...imported]);
      if(parsed.userName)state.userName=String(parsed.userName);
      saveState();render();showToast(`Imported ${imported.length} trade records (${mode}).`);
    } catch(e){showToast("Could not read this file. Please choose a valid JSON backup.");}
    finally{$("importFile").value="";}
  }
  function scanStorage() {
    const results=[],candidateKeys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i); if(!key)continue;
      try{
        const raw=localStorage.getItem(key); if(!raw)continue;
        const parsed=JSON.parse(raw), trades=extractTrades(parsed);
        if(trades.length)candidateKeys.push({key,count:trades.length,trades});
      }catch(e){}
    }
    const unique=candidateKeys.filter(x=>x.key!==STORAGE_KEY);
    if(!unique.length){$("scanResults").innerHTML="No other recognizable trade records were found in this site's LocalStorage. Try importing a JSON backup file, or open the original website/browser profile where the data was saved.";return;}
    $("scanResults").innerHTML=unique.map((x,i)=>`<div><b>${esc(x.key)}</b> — ${x.count} trade(s) <button class="secondary-button" data-recover="${i}">Recover</button></div>`).join("");
    $("scanResults").dataset.candidates=JSON.stringify(unique.map(x=>({key:x.key,count:x.count,trades:x.trades})));
  }
  function recoverCandidate(index) {
    let candidates=[];try{candidates=JSON.parse($("scanResults").dataset.candidates||"[]");}catch(e){}
    const item=candidates[index];if(!item)return;
    if(!confirm(`Merge ${item.count} trades from "${item.key}" into your current tracker?`))return;
    state.trades=dedupe([...state.trades,...item.trades]);saveState();render();showToast(`Recovered ${item.count} trade records.`);
  }
  function showStorageKeys() {
    const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
    $("storageKeys").textContent=keys.length?keys.join(" · "):"No LocalStorage keys found.";
  }
  function printReport() {
    const s=stats();
    const rows=state.trades.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(t=>`<tr><td>${esc(t.date)}</td><td>${esc(t.symbol)}</td><td>${esc(t.market)}</td><td>${esc(t.side)}</td><td>${money(t.entryPrice)}</td><td>${t.exitPrice===null?"—":money(t.exitPrice)}</td><td>${t.status==="Open"?"Open":money(t.pnl)}</td><td>${money(t.brokerage)}</td></tr>`).join("");
    const win=window.open("","_blank");
    if(!win){showToast("Allow pop-ups to create the PDF report, then try again.");return;}
    win.document.write(`<!doctype html><html><head><title>KEWA Trade Report</title><meta name="viewport" content="width=device-width"><style>body{font:12px Arial,sans-serif;color:#172033;padding:24px}h1{margin-bottom:4px}p{color:#586780}.cards{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0}.card{border:1px solid #bbc5d5;border-radius:8px;padding:12px;min-width:130px}.card b{display:block;font-size:17px;margin-top:8px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #cbd3df;padding:7px;text-align:left}th{background:#edf2f9}@media print{body{padding:0}}</style></head><body><h1>KEWA Trade Tracker — Report</h1><p>Generated ${new Date().toLocaleString()} · User: ${esc(state.userName)}</p><div class="cards"><div class="card">Total Trades<b>${s.total}</b></div><div class="card">Total Profit<b>${money(s.profit)}</b></div><div class="card">Total Loss<b>${money(s.loss)}</b></div><div class="card">Net P&amp;L<b>${money(s.net)}</b></div><div class="card">Win Rate<b>${s.winRate.toFixed(1)}%</b></div><div class="card">Brokerage<b>${money(s.brokerage)}</b></div></div><h2>Trade details</h2><table><thead><tr><th>Date</th><th>Symbol</th><th>Market</th><th>Side</th><th>Entry</th><th>Exit</th><th>P&amp;L</th><th>Brokerage</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    win.document.close();
  }
  function bindEvents() {
    document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.go)));
    $("addTradeHero").addEventListener("click",()=>openForm());$("addTradeButton").addEventListener("click",()=>openForm());$("journalAddButton").addEventListener("click",()=>openForm());
    $("closeDialog").addEventListener("click",()=>$("tradeDialog").close());$("cancelTrade").addEventListener("click",()=>$("tradeDialog").close());
    $("tradeForm").addEventListener("submit",saveTrade);
    ["entryPrice","exitPrice","size","brokerage","side","status"].forEach(k=>$(k).addEventListener("input",calcPreview));
    ["chartRange","performanceRange"].forEach(k=>$(k).addEventListener("change",render));
    ["tradeSearch","marketFilter","statusFilter"].forEach(k=>$(k).addEventListener(k==="tradeSearch"?"input":"change",renderTrades));
    document.body.addEventListener("click",e=>{
      const edit=e.target.closest("[data-edit]"),del=e.target.closest("[data-delete]"),recover=e.target.closest("[data-recover]");
      if(edit){const t=state.trades.find(x=>x.id===edit.dataset.edit);if(t)openForm(t);}
      if(del)deleteTrade(del.dataset.delete);
      if(recover)recoverCandidate(Number(recover.dataset.recover));
    });
    $("exportJson").addEventListener("click",exportJson);$("exportCsv").addEventListener("click",exportCsv);
    $("chooseImport").addEventListener("click",()=>$("importFile").click());$("importFile").addEventListener("change",e=>importJsonFile(e.target.files[0]));
    $("scanStorage").addEventListener("click",scanStorage);$("showStorageKeys").addEventListener("click",showStorageKeys);$("exportPdf").addEventListener("click",printReport);
    $("themeToggle").addEventListener("click",()=>{document.body.classList.toggle("light-mode");$("themeToggle").textContent=document.body.classList.contains("light-mode")?"☀":"☾";});
    $("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
    $("nameButton").addEventListener("click",()=>{const name=prompt("What name should the dashboard display?",state.userName);if(name&&name.trim()){state.userName=name.trim().slice(0,35);saveState();render();}});
    document.addEventListener("keydown",e=>{if(e.key==="Escape")$("sidebar").classList.remove("open");});
    // Keep the app's back button behaviour predictable: go Home rather than exiting from a nested view.
    history.replaceState({kewa:true,view:"home"},"","#home");
    window.addEventListener("popstate",()=>{setView("home");history.pushState({kewa:true,view:"home"},"","#home");});
  }
  loadState(); bindEvents(); render();
})();