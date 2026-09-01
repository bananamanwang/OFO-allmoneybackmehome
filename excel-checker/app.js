"use strict";

const HOLIDAYS = {
  2026: [
    ["2026-01-01","開國紀念日"],["2026-02-15","小年夜"],["2026-02-16","農曆除夕"],
    ["2026-02-17","春節"],["2026-02-18","春節"],["2026-02-19","春節"],["2026-02-20","補假"],
    ["2026-02-27","補假"],["2026-02-28","和平紀念日"],["2026-04-03","補假"],
    ["2026-04-04","兒童節"],["2026-04-05","清明節"],["2026-04-06","補假"],
    ["2026-05-01","勞動節"],["2026-06-19","端午節"],["2026-09-25","中秋節"],
    ["2026-09-28","孔子誕辰紀念日／教師節"],["2026-10-09","補假"],["2026-10-10","國慶日"],
    ["2026-10-25","臺灣光復暨金門古寧頭大捷紀念日"],["2026-10-26","補假"],["2026-12-25","行憲紀念日"]
  ],
  2027: [
    ["2027-01-01","開國紀念日"],["2027-02-04","小年夜"],["2027-02-05","農曆除夕"],
    ["2027-02-06","春節"],["2027-02-07","春節"],["2027-02-08","春節"],["2027-02-09","補假"],
    ["2027-02-10","補假"],["2027-02-28","和平紀念日"],["2027-03-01","補假"],
    ["2027-04-04","兒童節"],["2027-04-05","清明節"],["2027-04-06","補假"],
    ["2027-04-30","補假"],["2027-05-01","勞動節"],["2027-06-09","端午節"],
    ["2027-09-15","中秋節"],["2027-09-28","孔子誕辰紀念日／教師節"],["2027-10-10","國慶日"],
    ["2027-10-11","補假"],["2027-10-25","臺灣光復暨金門古寧頭大捷紀念日"],
    ["2027-12-24","補假"],["2027-12-25","行憲紀念日"],["2027-12-31","補假"]
  ]
};

const $ = id => document.getElementById(id);
const state = { files: [], requiredManual: false };
const holidayMap = new Map(Object.values(HOLIDAYS).flat());
const pad = n => String(n).padStart(2,"0");
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
const utcDate = value => new Date(`${value}T00:00:00Z`);
const hours = minutes => minutes / 60;
const fmt = value => `${Number(value).toFixed(2)} 小時`;
const esc = value => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function init() {
  for (let y=2026;y<=2027;y++) $("year").add(new Option(`${y} 年`, y));
  for (let m=1;m<=12;m++) $("month").add(new Option(`${m} 月`, m));
  $("year").value = "2026"; $("month").value = "8";
  $("startDate").value = "2026-08-01"; $("endDate").value = "2026-08-31";
  $("mode").addEventListener("change", () => { toggleMode(); periodChanged(); });
  ["year","month","startDate","endDate"].forEach(id => $(id).addEventListener("change", periodChanged));
  $("requiredHours").addEventListener("input", () => { state.requiredManual=true; calculate(); });
  ["supervisionHours","daycareHours"].forEach(id => $(id).addEventListener("input", calculate));
  $("fileInput").addEventListener("change", e => loadFiles(e.target.files));
  $("resetButton").addEventListener("click", resetFiles);
  const zone = $("dropZone");
  ["dragenter","dragover"].forEach(type => zone.addEventListener(type, e => {e.preventDefault();zone.classList.add("drag")}));
  ["dragleave","drop"].forEach(type => zone.addEventListener(type, e => {e.preventDefault();zone.classList.remove("drag")}));
  zone.addEventListener("drop", e => loadFiles(e.dataTransfer.files));
  periodChanged();
}

function toggleMode() {
  const range = $("mode").value === "range";
  document.querySelectorAll(".month-field").forEach(el => el.classList.toggle("hidden", range));
  document.querySelectorAll(".range-field").forEach(el => el.classList.toggle("hidden", !range));
}

function getPeriod() {
  if ($("mode").value === "month") {
    const y=+$('year').value, m=+$('month').value;
    return { start:new Date(Date.UTC(y,m-1,1)), end:new Date(Date.UTC(y,m,0)), label:`${y} 年 ${m} 月` };
  }
  const start=utcDate($("startDate").value), end=utcDate($("endDate").value);
  return { start,end,label:`${$("startDate").value} ～ ${$("endDate").value}` };
}

function daysBetween(start,end) {
  if (!start || !end || Number.isNaN(start.getTime()) || start>end) return [];
  const result=[];
  for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)) result.push(new Date(d));
  return result;
}

function periodValidationError(period) {
  if (Number.isNaN(period.start.getTime()) || Number.isNaN(period.end.getTime())) return '請完整選擇開始日期與結束日期。';
  if (period.start>period.end) return '結束日期不得早於開始日期，請重新選擇。';
  return '';
}

function periodChanged() {
  const p=getPeriod();
  const error=periodValidationError(p);
  $("periodError").textContent=error;
  $("periodError").classList.toggle('hidden',!error);
  $("startDate").toggleAttribute('aria-invalid',!!error);
  $("endDate").toggleAttribute('aria-invalid',!!error);
  if(error) {
    state.requiredManual=false;
    $("requiredHours").value='';
    $("requiredHint").textContent='暫停計算，請先修正日期區間。';
    $("calendarTags").innerHTML='';
    calculate();
    return;
  }
  const days=daysBetween(p.start,p.end);
  const workdays=days.filter(d => d.getUTCDay()>=1 && d.getUTCDay()<=5 && !holidayMap.has(iso(d))).length;
  state.requiredManual=false;
  $("requiredHours").value=(workdays*8).toFixed(2).replace(/\.00$/,'');
  $("requiredHint").textContent=`自動計算：${workdays} 個工作日 × 8 小時＝${workdays*8} 小時（仍可手動修改）`;
  $("leaveNote").textContent=$("mode").value==='range'
    ? '目前為日期區間模式；請假欄仍是各 Excel 表頭的整月份總數，不會依日期區間切割。'
    : '請假欄為 Excel 表頭記載的整月份總數。';
  renderCalendar(days);
  calculate();
}

function renderCalendar(days) {
  const special=days.filter(d => d.getUTCDay()===6 || holidayMap.has(iso(d)));
  $("calendarTags").innerHTML=special.length ? special.map(d => {
    const id=iso(d), holiday=holidayMap.get(id), cls=holiday?"tag holiday":"tag";
    return `<span class="${cls}">${id.slice(5).replace('-','/')} ${holiday || '週六'}</span>`;
  }).join('') : '<span class="tag">期間內沒有週六或國定假日</span>';
}

async function loadFiles(fileList) {
  const files=[...fileList].filter(f => f.name.toLowerCase().endsWith('.xlsx'));
  if (!files.length) return showStatus('請選取 .xlsx 格式的服務紀錄總表。',true);
  if (typeof JSZip === 'undefined') return showStatus('Excel 解析元件載入失敗，請重新整理頁面。',true);
  showStatus(`正在解析 ${files.length} 個檔案…`);
  const parsed=[];
  for (const file of files) {
    try { parsed.push(await parseWorkbook(file)); }
    catch (error) { parsed.push({name:file.name,error:error.message || '無法解析'}); }
  }
  state.files=parsed;
  renderFiles(); calculate();
}

async function parseWorkbook(file) {
  const zip=await JSZip.loadAsync(await file.arrayBuffer());
  const readXml=async path => {
    const entry=zip.file(path); if(!entry) throw new Error(`缺少 ${path}`);
    return new DOMParser().parseFromString(await entry.async('text'),'application/xml');
  };
  const workbook=await readXml('xl/workbook.xml');
  const rels=await readXml('xl/_rels/workbook.xml.rels');
  const relMap=new Map([...rels.getElementsByTagNameNS('*','Relationship')].map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  const firstSheet=workbook.getElementsByTagNameNS('*','sheet')[0];
  if(!firstSheet) throw new Error('找不到工作表');
  const relId=firstSheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id') || firstSheet.getAttribute('r:id');
  let target=relMap.get(relId); if(!target) throw new Error('找不到工作表資料');
  target=target.replace(/^\//,''); if(!target.startsWith('xl/')) target=`xl/${target.replace(/^\.\//,'')}`;
  const sheet=await readXml(target);
  let shared=[];
  if(zip.file('xl/sharedStrings.xml')) {
    const ss=await readXml('xl/sharedStrings.xml');
    shared=[...ss.getElementsByTagNameNS('*','si')].map(si=>[...si.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(''));
  }
  const cells=new Map();
  for(const c of sheet.getElementsByTagNameNS('*','c')) {
    const ref=c.getAttribute('r'), type=c.getAttribute('t');
    const v=c.getElementsByTagNameNS('*','v')[0];
    let value='';
    if(type==='s' && v) value=shared[Number(v.textContent)] || '';
    else if(type==='inlineStr') value=[...c.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('');
    else value=v?.textContent || '';
    if(value) cells.set(ref,value);
  }
  const values=[...cells.values()];
  const metaText=values.join('\n');
  const ym=metaText.match(/班表年月\s*:\s*(\d{4})(\d{2})/);
  if(!ym) throw new Error('找不到「班表年月」');
  const year=+ym[1], month=+ym[2];
  const employee=metaText.match(/員工姓名\s*:\s*(.*?)\s+員工編號\s*:/)?.[1]?.trim() || '未辨識';
  const employeeId=metaText.match(/員工編號\s*:\s*([^\s]+)/)?.[1] || '—';
  const headerWork=+(metaText.match(/總工時\s*:\s*(\d+)分鐘/)?.[1] || 0);
  const headerTransport=+(metaText.match(/總交通\s*:\s*(\d+)分鐘/)?.[1] || 0);
  const employeeLeave=+(metaText.match(/員工請假總工時\s*:\s*(\d+)分鐘/)?.[1] || 0);
  const clientLeave=+(metaText.match(/個案請假總工時\s*:\s*(\d+)分鐘/)?.[1] || 0);
  const records=[];
  for(const [ref,value] of cells) {
    const dm=value.match(/^(\d{1,2})\/(\d{1,2})\(星期[一二三四五六日]\)$/);
    if(!dm) continue;
    const pos=ref.match(/^([A-Z]+)(\d+)$/); if(!pos) continue;
    const col=pos[1], row=+pos[2];
    const work=+(cells.get(`${col}${row+1}`)?.match(/工時(\d+)分鐘/)?.[1] || 0);
    const transport=+(cells.get(`${col}${row+2}`)?.match(/交通(\d+)分鐘/)?.[1] || 0);
    records.push({date:`${year}-${pad(+dm[1])}-${pad(+dm[2])}`,work,transport});
  }
  if(!records.length) throw new Error('找不到每日工時資料');
  records.sort((a,b)=>a.date.localeCompare(b.date));
  const sumWork=records.reduce((n,r)=>n+r.work,0), sumTransport=records.reduce((n,r)=>n+r.transport,0);
  return {name:file.name,year,month,employee,employeeId,headerWork,headerTransport,employeeLeave,clientLeave,records,sumWork,sumTransport,
    reconciled:headerWork===sumWork && headerTransport===sumTransport};
}

function renderFiles() {
  const body=$("fileTableBody");
  body.innerHTML=state.files.map(f => f.error
    ? `<tr><td>${esc(f.name)}</td><td colspan="5" class="check-bad">${esc(f.error)}</td><td class="check-bad">失敗</td></tr>`
    : `<tr><td title="${esc(f.name)}">${esc(shortName(f.name))}</td><td>${esc(f.employee)}<br><small>${esc(f.employeeId)}</small></td><td>${f.year}/${pad(f.month)}</td><td>${fmt(hours(f.headerWork))}</td><td>${fmt(hours(f.headerTransport))}</td><td>員工 ${f.employeeLeave} 分<br>個案 ${f.clientLeave} 分</td><td class="${f.reconciled?'check-ok':'check-bad'}">${f.reconciled?'吻合':reconcileLabel(f)}</td></tr>`
  ).join('');
  $("fileTableWrap").classList.remove("hidden");
  const success=state.files.filter(f=>!f.error).length, failed=state.files.length-success;
  showStatus(`已讀取 ${success} 個檔案${failed?`，${failed} 個失敗`:''}。`,!!failed);
}

function shortName(name){return name.length>25?`${name.slice(0,22)}…`:name}
function signed(value){return `${value>=0?'+':''}${value}`}
function reconcileLabel(file){return `有差異<br><small>工時 ${signed(file.sumWork-file.headerWork)} 分<br>交通 ${signed(file.sumTransport-file.headerTransport)} 分</small>`}
function showStatus(text,isError=false){const el=$("status");el.textContent=text;el.classList.remove("hidden");el.classList.toggle("error",isError)}

function calculate() {
  const valid=state.files.filter(f=>!f.error), p=getPeriod(), days=daysBetween(p.start,p.end);
  $("periodLabel").textContent=p.label;
  if(periodValidationError(p)) { clearResults(); return; }
  if(!valid.length || !days.length) { clearResults(); return; }
  const warnings=[];
  const people=new Set(valid.map(f=>`${f.employee}|${f.employeeId}`));
  if(people.size>1) {
    clearResults();
    $("periodLabel").textContent=`${p.label}｜已停止計算`;
    $("specialDayBody").innerHTML='<tr><td colspan="6" class="empty check-bad">不同員工的資料不可合併驗算</td></tr>';
    $("weeklyBody").innerHTML='<tr><td colspan="6" class="empty check-bad">不同員工的資料不可合併驗算</td></tr>';
    renderWarnings(['選取的檔案屬於不同員工，已停止計算。請清除後，分別上傳驗算。'],true);
    $("resultsPanel").classList.remove('muted');
    return;
  }
  valid.filter(f=>!f.reconciled).forEach(f=>warnings.push(
    `${f.name} 的 Excel 表頭與每日加總不一致：工時 ${signed(f.sumWork-f.headerWork)} 分鐘、交通 ${signed(f.sumTransport-f.headerTransport)} 分鐘。本次仍以每日資料計算。`
  ));
  const covered=new Set(valid.map(f=>`${f.year}-${pad(f.month)}`));
  const needed=new Set(days.map(d=>`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`));
  const missing=[...needed].filter(m=>!covered.has(m));
  if(missing.length) warnings.push(`缺少 ${missing.join('、')} 的 Excel 檔，本次結果可能不完整。`);
  const merged=new Map();
  for(const f of valid) for(const r of f.records) {
    if(merged.has(r.date)) warnings.push(`日期 ${r.date} 重複出現，僅採用第一筆。`);
    else merged.set(r.date,r);
  }
  const inRange=[...merged.values()].filter(r=>utcDate(r.date)>=p.start && utcDate(r.date)<=p.end);
  const serviceMin=inRange.reduce((n,r)=>n+r.work,0), transportMin=inRange.reduce((n,r)=>n+r.transport,0);
  const supervision=+( $("supervisionHours").value || 0), daycare=+( $("daycareHours").value || 0), required=+( $("requiredHours").value || 0);
  let saturdayMin=0, holidayMin=0;
  const special=[];
  for(const d of days) {
    const date=iso(d), r=merged.get(date) || {work:0,transport:0};
    if(d.getUTCDay()===6) { saturdayMin+=r.work+r.transport; special.push({date,type:holidayMap.get(date)?`週六／${holidayMap.get(date)}`:'週六',...r}); }
    else if(holidayMap.has(date)) { holidayMin+=r.work+r.transport; special.push({date,type:holidayMap.get(date),...r}); }
  }
  const service=hours(serviceMin), transport=hours(transportMin), saturday=hours(saturdayMin), holiday=hours(holidayMin);
  const periodWork=service+supervision+daycare;
  const weekdayActual=service+transport+supervision+daycare-saturday-holiday;
  const weekdayOvertime=weekdayActual-required;
  const overtime=Math.max(weekdayOvertime,0)+saturday+holiday;
  if(overtime>46) warnings.push(`總加班 ${overtime.toFixed(2)} 小時，已超過 46 小時。`);
  if(!inRange.length) warnings.push('所選期間找不到任何每日資料，請檢查期間與檔案月份。');
  setText('periodWork',fmt(periodWork)); setText('transportTotal',fmt(transport)); setText('overtimeTotal',fmt(overtime));
  setText('requiredResult',fmt(required)); setText('weekdayActual',fmt(weekdayActual)); setText('weekdayOvertime',fmt(weekdayOvertime));
  setText('saturdayOvertime',fmt(saturday)); setText('holidayOvertime',fmt(holiday)); setText('serviceTotal',fmt(service));
  setText('supervisionResult',fmt(supervision)); setText('daycareResult',fmt(daycare));
  $("shortageBadge").classList.toggle('hidden',weekdayOvertime>=0);
  $("specialDayBody").innerHTML=special.length ? special.map(r=>{
    const total=hours(r.work+r.transport), over=total>8;
    const excess=Math.max(total-8,0);
    if(over) warnings.push(`${r.date} 的工時加交通為 ${total.toFixed(2)} 小時，超過 ${excess.toFixed(2)} 小時。`);
    return `<tr><td>${r.date}</td><td>${esc(r.type)}</td><td>${fmt(hours(r.work))}</td><td>${fmt(hours(r.transport))}</td><td><strong>${fmt(total)}</strong></td><td class="${over?'check-bad':'check-ok'}">${over?`超過 ${excess.toFixed(2)} 小時`:'未超過 8 小時'}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="empty">期間內沒有週六或國定假日</td></tr>';
  renderWeeklyCheck(p,days,merged,covered);
  renderWarnings(warnings);
  $("resultsPanel").classList.remove('muted');
}

function setText(id,text){$(id).textContent=text}
function renderWarnings(warnings,blocking=false) {
  const unique=[...new Set(warnings)];
  $("warnings").innerHTML=unique.map(w=>`<div>⚠ ${esc(w)}</div>`).join('');
  $("warnings").classList.toggle('hidden',!unique.length);
  $("warnings").classList.toggle('blocking',blocking);
}
function renderWeeklyCheck(period,days,records,coveredMonths) {
  const weekKeys=new Map();
  for(const day of days) {
    const monday=new Date(day);
    const weekday=monday.getUTCDay() || 7;
    monday.setUTCDate(monday.getUTCDate()-weekday+1);
    weekKeys.set(iso(monday),monday);
  }
  const rows=[...weekKeys.values()].map(monday => {
    const friday=new Date(monday); friday.setUTCDate(friday.getUTCDate()+4);
    const weekEnd=new Date(monday); weekEnd.setUTCDate(weekEnd.getUTCDate()+6);
    let complete=monday>=period.start && friday<=period.end;
    let workMin=0,transportMin=0,workdays=0;
    for(let offset=0;offset<5;offset++) {
      const day=new Date(monday); day.setUTCDate(day.getUTCDate()+offset);
      if(!holidayMap.has(iso(day))) workdays++;
      if(!coveredMonths.has(`${day.getUTCFullYear()}-${pad(day.getUTCMonth()+1)}`)) complete=false;
      if(day<period.start || day>period.end || holidayMap.has(iso(day))) continue;
      const record=records.get(iso(day));
      workMin+=record?.work || 0;
      transportMin+=record?.transport || 0;
    }
    const target=workdays*8,total=hours(workMin+transportMin),diff=total-target;
    let result,cls;
    if(!complete) {result='資料不足，無法驗算';cls='check-neutral';}
    else if(diff>0) {result=`已達，超過 ${diff.toFixed(2)} 小時`;cls='check-ok';}
    else if(diff===0) {result='剛好達應上時數';cls='check-ok';}
    else {result=`未達，少 ${Math.abs(diff).toFixed(2)} 小時`;cls='check-bad';}
    return `<tr><td>${iso(monday)}～${iso(weekEnd)}</td><td>${fmt(hours(workMin))}</td><td>${fmt(hours(transportMin))}</td><td><strong>${fmt(total)}</strong></td><td>${complete?`${workdays} 天 × 8＝${fmt(target)}`:'—'}</td><td class="${cls}">${result}</td></tr>`;
  });
  $("weeklyBody").innerHTML=rows.length?rows.join(''):'<tr><td colspan="6" class="empty">所選期間沒有可檢查的週次</td></tr>';
}
function clearResults(){
  ['periodWork','transportTotal','overtimeTotal','requiredResult','weekdayActual','weekdayOvertime','saturdayOvertime','holidayOvertime','serviceTotal','supervisionResult','daycareResult'].forEach(id=>setText(id,'—'));
  $("shortageBadge").classList.add('hidden'); $("warnings").classList.add('hidden'); $("resultsPanel").classList.add('muted');
  $("specialDayBody").innerHTML='<tr><td colspan="6" class="empty">尚未產生資料</td></tr>';
  $("weeklyBody").innerHTML='<tr><td colspan="6" class="empty">尚未產生資料</td></tr>';
}
function resetFiles(){state.files=[];$("fileInput").value='';$("fileTableWrap").classList.add('hidden');$("status").classList.add('hidden');calculate()}

document.addEventListener('DOMContentLoaded',init);
