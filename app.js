const KEY="avail_inventory_v1";
const STAFF_KEY="avail_inventory_staff_v1";
const HISTORY_KEY="avail_inventory_csv_history_v1";
let loadedHistoryName=null;
const $=id=>document.getElementById(id);
let records=[],editing=null,reader=null,controls=null,scanning=false;

function getNextReadNo(){
  return records.length?Math.max(...records.map(r=>Number(r.readNo)||0),0)+1:1;
}
function setReadNo(no){
  const el=$("readNo");
  if(el)el.textContent=no==null?"—":String(no);
}
function applyAppConfig(){
  const title=(window.APP_CONFIG?.title||"棚卸BCリーダー").trim()||"棚卸BCリーダー";
  document.title=title;
  const v=$("appVersion"); if(v)v.textContent=window.APP_CONFIG?.version||"";
  const t=$("headerTitle"); if(t){t.textContent=title;t.title=title;}
  const img=$("headerLogo"),logo=(window.APP_CONFIG?.logo||"").trim();
  if(img){if(logo){img.src=logo;img.hidden=false;img.alt=title+" ロゴ";}else img.hidden=true;}
}
function init(){
  buildShelves();restore();applyAppConfig();render();renderHistory();setReadNo(getNextReadNo());
  $("camera").onclick=startCamera;$("close").onclick=stopCamera;
  $("register").onclick=register;$("cancel").onclick=cancelEdit;
  $("csv").onclick=exportCSV;$("clearAll").onclick=clearAll;
  $("clearHistory").onclick=clearHistory;
  $("photo").onclick=()=>$("photoInput").click();$("photoInput").onchange=decodePhoto;
  $("staff1").oninput=saveStaff;$("staff2").oninput=saveStaff;
  $("staff1").onblur=saveStaff;$("staff2").onblur=saveStaff;
  $("staff1").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("staff2").focus();}};
  $("staff2").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("shelf").focus();}};
  $("qty").onkeydown=e=>{if(e.key==="Enter")register();};
  $("jan").onfocus=()=>{if(!$("jan").value.trim()&&editing===null&&!scanning)startCamera();};
  if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
function buildShelves(){
  const s=$("shelf");
  for(let i=0;i<14;i++)for(let n=1;n<=5;n++){
    const o=document.createElement("option");o.value=String.fromCharCode(65+i)+"-"+n;o.textContent=o.value;s.appendChild(o);
  }
}
function restore(){
  try{records=JSON.parse(localStorage.getItem(KEY)||"[]");if(!Array.isArray(records))records=[];}catch{records=[];}
  let changed=false;
  records=records.map((r,i)=>{if(!r.readNo){changed=true;return {...r,readNo:i+1};}return r;});
  if(changed)save();
  try{const staff=JSON.parse(localStorage.getItem(STAFF_KEY)||"{}");$("staff1").value=staff.staff1||"";$("staff2").value=staff.staff2||"";}catch{$("staff1").value="";$("staff2").value="";}
}
function saveStaff(){localStorage.setItem(STAFF_KEY,JSON.stringify({staff1:$("staff1").value.trim(),staff2:$("staff2").value.trim()}));}
function save(){localStorage.setItem(KEY,JSON.stringify(records));}
function jan(v){return String(v||"").replace(/\D/g,"");}
function getShelfNumber(){const base=$("shelf").value,branch=$("branch").value;return branch?`${base}-${branch}`:base;}
function resetInput(){
  editing=null;loadedHistoryName=null;
  $("register").textContent="登録";$("cancel").classList.add("hidden");
  $("jan").value="";$("qty").value="";setReadNo(getNextReadNo());
}
function register(){
  const shelf=getShelfNumber(),j=jan($("jan").value),q=$("qty").value;
  if(!/^\d{8}(\d{5})?$/.test(j))return toast("JANコードは8桁または13桁で入力してください。");
  if(q===""||!/^[0-9]+$/.test(q))return toast("数量を入力してください。");
  if(editing!==null){
    const no=records[editing].readNo;
    records[editing]={readNo:no,shelf,jan:j,qty:Number(q)};
    save();render();resetInput();$("jan").focus();toast(`№${no}を更新しました。`);
    setTimeout(()=>startCamera(),80);
  }else{
    const no=getNextReadNo();
    records.push({readNo:no,shelf,jan:j,qty:Number(q)});
    save();render();$("jan").value="";$("qty").value="";setReadNo(getNextReadNo());$("jan").focus();toast(`№${no}を登録しました。`);
    setTimeout(()=>startCamera(),80);
  }
}
function edit(i){
  const r=records[i];if(!r)return;
  editing=i;setReadNo(r.readNo);
  const m=String(r.shelf).match(/^([A-N])-0?([1-5])(?:-([1-9]))?$/);
  if(m){$("shelf").value=`${m[1]}-${m[2]}`;$("branch").value=m[3]||"";}else{$("shelf").value=r.shelf;$("branch").value="";}
  $("jan").value=r.jan;$("qty").value=r.qty;$("register").textContent="更新";$("cancel").classList.remove("hidden");
  scrollTo({top:0,behavior:"smooth"});$("qty").focus();
}
function cancelEdit(){resetInput();$("branch").value="";}
function del(i){
  const r=records[i];if(!r)return;
  if(confirm(`№${r.readNo}を削除しますか？`)){records.splice(i,1);save();render();setReadNo(getNextReadNo());toast(`№${r.readNo}を削除しました。`);}
}
function render(){
  $("count").textContent=records.length+"件";
  $("list").innerHTML=records.length?records.map((r,i)=>`<div class="record"><div class="seq">№${esc(r.readNo)}</div><div><div class="shelfname">${esc(r.shelf)}</div><div class="jantext">${esc(r.jan)}</div></div><div class="recordqty">${esc(r.qty)}</div><div class="recordActions"><button class="small" onclick="edit(${i})">編集</button><button class="small del" onclick="del(${i})">削除</button></div></div>`).join(""):'<div class="empty">まだデータがありません</div>';
}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function clearAll(){if(records.length&&confirm("入力済みデータをすべて削除しますか？")){records=[];save();resetInput();render();toast("全データを削除しました。");}}
function csvText(){return "\uFEFF"+"棚番号,JANコード,数量\r\n"+records.map(r=>[r.shelf,r.jan,r.qty].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n")+"\r\n";}
function filename(){
  if(loadedHistoryName)return loadedHistoryName;
  const d=new Date(),date=String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  const shelf=records[0]?.shelf||getShelfNumber()||"A-1",staff=(`${$("staff1").value.trim()}${$("staff2").value.trim()}`).replace(/[\\/:*?"<>|]/g,"");
  return `${date}_${shelf}_${staff}.csv`;
}
function getHistory(){
  try{const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");return Array.isArray(h)?h:[];}catch{return [];}
}
function saveHistory(h){localStorage.setItem(HISTORY_KEY,JSON.stringify(h));}
function historySnapshot(){return records.map(r=>({readNo:r.readNo,shelf:r.shelf,jan:r.jan,qty:r.qty}));}
function upsertHistory(name){
  const h=getHistory();
  const item={filename:name,exportedAt:new Date().toISOString(),records:historySnapshot()};
  const i=h.findIndex(x=>x.filename===name);
  if(i>=0)h[i]=item;else h.unshift(item);
  saveHistory(h);renderHistory();
}
function renderHistory(){
  const h=getHistory(),c=$("historyCount"),box=$("csvHistory");
  if(c)c.textContent=h.length+"件";
  if(!box)return;
  if(!h.length){box.innerHTML='<div class="empty">CSV出力済みファイルはありません</div>';return;}
  box.innerHTML=h.map((x,i)=>{
    const d=x.exportedAt?new Date(x.exportedAt):null;
    const dt=d&&!isNaN(d)?d.toLocaleString("ja-JP"):"";
    return `<button class="history-item" onclick="loadHistory(${i})"><span class="history-filename">${esc(x.filename)}</span><span class="history-date">${esc(dt)}</span></button>`;
  }).join("");
}
let selectedHistoryIndex=null;

function renderHistory(){
  const h=getHistory(),c=$("historyCount"),box=$("csvHistory");
  if(c)c.textContent=h.length+"件";
  if(!box)return;
  if(!h.length){
    box.innerHTML='<div class="empty">CSV出力済みファイルはありません</div>';
    return;
  }
  box.innerHTML=h.map((x,i)=>{
    const d=x.exportedAt?new Date(x.exportedAt):null;
    const dt=d&&!isNaN(d)?d.toLocaleString("ja-JP"):"";
    const selected=selectedHistoryIndex===i;
    return `<div class="history-entry ${selected?"selected":""}">
      <button class="history-item" onclick="selectHistory(${i})">
        <span class="history-filename">${esc(x.filename)}</span>
        <span class="history-date">${esc(dt)}</span>
      </button>
      ${selected?`<div class="history-actions">
        <button class="small history-load" onclick="readHistory(${i})">読込み</button>
        <button class="small history-delete" onclick="deleteHistory(${i})">削除</button>
        <button class="small history-cancel" onclick="cancelHistorySelection()">キャンセル</button>
      </div>`:""}
    </div>`;
  }).join("");
}
function selectHistory(i){
  selectedHistoryIndex=i;
  renderHistory();
}
function cancelHistorySelection(){
  selectedHistoryIndex=null;
  renderHistory();
}
function readHistory(i){
  const h=getHistory(),x=h[i];if(!x)return;
  if(records.length&&!confirm("未出力のデータがあります。出力済みファイルを表示しますか？")){
    selectedHistoryIndex=null;renderHistory();return;
  }
  records=(x.records||[]).map((r,n)=>({...r,readNo:r.readNo||n+1}));
  loadedHistoryName=x.filename;
  editing=null;
  $("jan").value="";$("qty").value="";
  $("register").textContent="登録";$("cancel").classList.add("hidden");
  save();render();setReadNo(getNextReadNo());
  selectedHistoryIndex=null;renderHistory();
  toast(`${x.filename}を呼び出しました。`);
  scrollTo({top:0,behavior:"smooth"});
}
function deleteHistory(i){
  const h=getHistory(),x=h[i];if(!x)return;
  if(confirm(`「${x.filename}」を削除しますか？`)){
    h.splice(i,1);saveHistory(h);
    if(selectedHistoryIndex===i)selectedHistoryIndex=null;
    renderHistory();toast("CSV出力履歴を削除しました。");
  }
}
function clearHistory(){
  if(!getHistory().length)return toast("削除する履歴がありません。");
  if(confirm("CSV出力済みファイルの履歴をすべて削除しますか？")){
    localStorage.removeItem(HISTORY_KEY);renderHistory();toast("CSV出力履歴を削除しました。");
  }
}
async function exportCSV(){
  if(!records.length)return toast("出力するデータがありません。");
  const name=filename();
  const blob=new Blob([csvText()],{type:"text/csv;charset=utf-8"});

  // 出力対象はCSVファイル1個だけ。TXT等は生成しません。
  try{
    const file=new File([blob],name,{type:"text/csv"});
    if(typeof navigator.share==="function"&&typeof navigator.canShare==="function"&&navigator.canShare({files:[file]})){
      await navigator.share({title:name,files:[file]});
      upsertHistory(name);
      if(confirm("CSVの送信が完了しました。入力済みデータを消去しますか？")){
        records=[];save();resetInput();render();toast("CSV出力済みデータを消去しました。");
      }else toast(name+"を出力しました。");
      return;
    }
  }catch(e){if(e?.name==="AbortError")return;}

  // 共有非対応時もCSVファイルだけをダウンロード。
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;link.download=name;link.setAttribute("download",name);
  link.style.display="none";document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  upsertHistory(name);
  if(confirm("CSVのダウンロードを開始しました。入力済みデータを消去しますか？")){
    records=[];save();resetInput();render();toast("CSV出力済みデータを消去しました。");
  }else toast(name+"を出力しました。");
}
async function startCamera(){
  if(scanning)return;$("modal").classList.remove("hidden");$("status").textContent="カメラを起動しています…";
  try{
    reader=new ZXingBrowser.BrowserMultiFormatOneDReader();scanning=true;
    controls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}},$("video"),result=>{
      if(!result)return;const j=jan(result.getText());
      if(/^\d{8}(\d{5})?$/.test(j)){$("jan").value=j;navigator.vibrate?.(80);stopCamera();setTimeout(()=>$("qty").focus(),50);}
    });$("status").textContent="読み取り中…";
  }catch(e){console.error(e);scanning=false;$("status").textContent="カメラを起動できません。Safariのカメラ許可とHTTPS接続を確認してください。";}
}
function stopCamera(){
  try{controls?.stop();}catch{}controls=null;scanning=false;
  const v=$("video"),s=v.srcObject;if(s)s.getTracks().forEach(t=>t.stop());v.srcObject=null;$("modal").classList.add("hidden");
}
async function decodePhoto(e){
  const f=e.target.files?.[0];e.target.value="";if(!f)return;
  const img=new Image();img.onload=async()=>{
    const c=document.createElement("canvas"),max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    c.width=img.naturalWidth*scale;c.height=img.naturalHeight*scale;c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    try{const r=new ZXingBrowser.BrowserMultiFormatOneDReader(),res=await r.decodeFromCanvas(c),j=jan(res.getText());
      if(/^\d{8}(\d{5})?$/.test(j)){$("jan").value=j;stopCamera();setTimeout(()=>$("qty").focus(),50);}else $("status").textContent="JANとして認識できませんでした。";
    }catch{$("status").textContent="JANコードを認識できませんでした。もう一度撮影してください。"}
    URL.revokeObjectURL(img.src);
  };img.src=URL.createObjectURL(f);
}
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(window._toast);window._toast=setTimeout(()=>e.classList.remove("show"),2200);}
addEventListener("beforeunload",stopCamera);addEventListener("load",init);window.edit=edit;window.del=del;window.selectHistory=selectHistory;window.readHistory=readHistory;window.deleteHistory=deleteHistory;window.cancelHistorySelection=cancelHistorySelection;
