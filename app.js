const KEY="avail_inventory_v1";
const $=id=>document.getElementById(id);
let records=[], editing=null, reader=null, controls=null, scanning=false;

function init(){
  buildShelves(); restore(); render();
  $("camera").onclick=startCamera;
  $("close").onclick=stopCamera;
  $("register").onclick=register;
  $("cancel").onclick=cancelEdit;
  $("csv").onclick=exportCSV;
  $("clearAll").onclick=clearAll;
  $("photo").onclick=()=>$("photoInput").click();
  $("photoInput").onchange=decodePhoto;
  $("qty").onkeydown=e=>{if(e.key==="Enter")register()};
  $("jan").onfocus=()=>{if(!$("jan").value.trim()&&!editing)startCamera()};
  if("serviceWorker" in navigator) addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
function buildShelves(){
  const s=$("shelf");
  for(let i=0;i<14;i++)for(let n=1;n<=5;n++){
    const o=document.createElement("option");
    o.value=String.fromCharCode(65+i)+"-"+String(n).padStart(2,"0");
    o.textContent=o.value;s.appendChild(o);
  }
}
function restore(){try{records=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{records=[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(records))}
function jan(v){return String(v||"").replace(/\D/g,"")}
function getShelfNumber(){
  const base=$("shelf").value;
  const branch=$("branch").value;
  return branch ? `${base}-${branch}` : base;
}
function register(){
  const shelf=getShelfNumber(),j=jan($("jan").value),q=$("qty").value;
  if(!/^\d{8}(\d{5})?$/.test(j))return toast("JANコードは8桁または13桁で入力してください。");
  if(q===""||!/^[0-9]+$/.test(q))return toast("数量を入力してください。");
  const r={shelf,jan:j,qty:Number(q)};
  if(editing!==null){records[editing]=r;editing=null;$("register").textContent="登録";$("cancel").classList.add("hidden");toast("更新しました。")}
  else{records.push(r);toast("登録しました。")}
  save();render();$("jan").value="";$("qty").value="";$("jan").focus();
}
function edit(i){
  const r=records[i];
  editing=i;
  const m=r.shelf.match(/^([A-N]-0[1-5])(?:-([1-9]))?$/);
  $("shelf").value=m?.[1]||r.shelf;
  $("branch").value=m?.[2]||"";
  $("jan").value=r.jan;
  $("qty").value=r.qty;
  $("register").textContent="更新";
  $("cancel").classList.remove("hidden");
  scrollTo({top:0,behavior:"smooth"});
  $("qty").focus();
}
function cancelEdit(){
  editing=null;
  $("register").textContent="登録";
  $("cancel").classList.add("hidden");
  $("branch").value="";
  $("jan").value="";
  $("qty").value="";
}
function del(i){if(confirm(`No.${i+1}を削除しますか？`)){records.splice(i,1);save();render();toast("削除しました。")}}
function render(){
  $("count").textContent=records.length+"件";
  $("list").innerHTML=records.length?records.map((r,i)=>`<div class="record"><div class="seq">No.${i+1}</div><div><div class="shelfname">${esc(r.shelf)}</div><div class="jantext">${esc(r.jan)}</div></div><div class="recordqty">${r.qty}</div><div class="recordActions"><button class="small" onclick="edit(${i})">編集</button><button class="small del" onclick="del(${i})">削除</button></div></div>`).join(""):'<div class="empty">まだデータがありません</div>';
}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function clearAll(){if(records.length&&confirm("入力済みデータをすべて削除しますか？")){records=[];save();render();toast("全データを削除しました。")}}
function csvText(){return "\uFEFF"+"棚番号,JANコード,数量\r\n"+records.map(r=>[r.shelf,r.jan,r.qty].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n")+"\r\n"}
function filename(){const d=new Date(),date=String(d.getFullYear()).slice(-2)+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");return `${date}_${records[0]?.shelf||"A-01"}.csv`}
async function exportCSV(){
  if(!records.length)return toast("出力するデータがありません。");
  const blob=new Blob([csvText()],{type:"text/csv;charset=utf-8"}),name=filename();
  try{
    const file=new File([blob],name,{type:"text/csv"});
    if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:name,files:[file]});return}
  }catch(e){}
  const a=document.createElement("a"),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);toast(name+"を出力しました。");
}
async function startCamera(){
  if(scanning)return;
  $("modal").classList.remove("hidden");$("status").textContent="カメラを起動しています…";
  try{
    reader=new ZXingBrowser.BrowserMultiFormatOneDReader();scanning=true;
    controls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}},$("video"),(result)=>{
      if(!result)return;
      const j=jan(result.getText());
      if(/^\d{8}(\d{5})?$/.test(j)){
        $("jan").value=j;navigator.vibrate?.(80);stopCamera();$("qty").focus();
      }
    });
    $("status").textContent="読み取り中…";
  }catch(e){console.error(e);scanning=false;$("status").textContent="カメラを起動できません。Safariのカメラ許可とHTTPS接続を確認してください。"}
}
function stopCamera(){
  try{controls?.stop()}catch{}controls=null;scanning=false;
  const v=$("video"),s=v.srcObject;if(s)s.getTracks().forEach(t=>t.stop());v.srcObject=null;
  $("modal").classList.add("hidden");
}
async function decodePhoto(e){
  const f=e.target.files?.[0];e.target.value="";if(!f)return;
  const img=new Image();img.onload=async()=>{
    const c=document.createElement("canvas"),max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    c.width=img.naturalWidth*scale;c.height=img.naturalHeight*scale;c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    try{
      const r=new ZXingBrowser.BrowserMultiFormatOneDReader(),res=await r.decodeFromCanvas(c),j=jan(res.getText());
      if(/^\d{8}(\d{5})?$/.test(j)){$("jan").value=j;stopCamera();$("qty").focus()}else $("status").textContent="JANとして認識できませんでした。";
    }catch{$("status").textContent="JANコードを認識できませんでした。もう一度撮影してください。"}
    URL.revokeObjectURL(img.src);
  };img.src=URL.createObjectURL(f);
}
function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(window._toast);window._toast=setTimeout(()=>e.classList.remove("show"),2200)}
addEventListener("beforeunload",stopCamera);addEventListener("load",init);window.edit=edit;window.del=del;