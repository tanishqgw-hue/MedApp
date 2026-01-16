document.addEventListener("DOMContentLoaded", () => {

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyGh1DhWMUyLllXyFB86DZePsh1gf_0eZ66u9vWWSjmbXPPd3HzWnoKq3ZI7ZVnvCeJ/exec";

function sendToEmailReminder(medName, timeStr){
  const payload = {
    email: "tanishqzade3@gmail.com",
    medicine: medName,
    date: new Date().toISOString().split("T")[0],
    time: timeStr
  };

  fetch("/api/reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(r => r.text())
  .then(t => console.log("PROXY RESPONSE:", t))
  .catch(e => console.error("PROXY ERROR:", e));
}






/* ===================== A: NOTIFICATIONS ===================== */
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}
function notify(title, body){
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

/* ===================== BASE SETUP ===================== */
const medListEl = document.getElementById("medList");
const takenListEl = document.getElementById("takenList");
const addBtn = document.getElementById("addBtn");
const freqSel = document.getElementById("medFreq");
const timeSlotsDiv = document.getElementById("timeSlots");
const toast = document.getElementById("undoToast");
const undoBtn = document.getElementById("undoBtn");

let meds = JSON.parse(localStorage.getItem("meds")) || [];
let lastAction = null;

const MEAL_TIMES = {
  breakfast: "07:00",
  lunch: "15:00",
  dinner: "19:30"
};

function getTime(when, meal){
  const [h,m] = MEAL_TIMES[meal].split(":").map(Number);
  let d = new Date();
  d.setHours(h, m, 0, 0);
  if(when === "pre") d.setMinutes(d.getMinutes() - 15);
  if(when === "post") d.setMinutes(d.getMinutes() + 15);
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

/* ===================== DYNAMIC SLOTS ===================== */
function buildSlots(count){
  timeSlotsDiv.innerHTML = "";
  for(let i=1;i<=count;i++){
    const div = document.createElement("div");
    div.className = "slot";
    div.innerHTML = `
      <select class="when">
        <option value="pre">Before</option>
        <option value="post">After</option>
      </select>
      <select class="meal">
        <option value="breakfast">Breakfast</option>
        <option value="lunch">Lunch</option>
        <option value="dinner">Dinner</option>
      </select>
    `;
    timeSlotsDiv.appendChild(div);
  }
}
freqSel.onchange = () => buildSlots(+freqSel.value);
buildSlots(1);

/* ===================== STORAGE ===================== */
function save(){ localStorage.setItem("meds", JSON.stringify(meds)); }

function showUndo(index){
  toast.style.display = "flex";
  lastAction = index;
  setTimeout(()=>{ toast.style.display="none"; lastAction=null; },5000);
}

undoBtn.onclick = () => {
  if(lastAction!==null){
    meds[lastAction].taken=false;
    save(); render();
  }
  toast.style.display="none";
};

/* ===================== RENDER ===================== */
function render(){
  medListEl.innerHTML = "";
  takenListEl.innerHTML = "";

  meds.forEach((m,i)=>{
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.innerHTML = `
      <strong>${m.name}</strong><br>
      <small>${m.schedule.map(s=>`${s.when} ${s.meal}`).join(", ")}</small><br>
      <small>⏰ ${m.schedule.map(s=>s.time).join(", ")}</small>
    `;

    const right = document.createElement("div");
    const chk = document.createElement("input");
    chk.type="checkbox"; chk.checked=m.taken;
    chk.onchange=()=>{
      m.taken=chk.checked; save();
      if(m.taken) showUndo(i);
      render();
    };

    const del=document.createElement("button");
    del.textContent="✖";
    del.style.background="#ccc";
    del.onclick=()=>{ meds.splice(i,1); save(); render(); };

    right.append(chk,del);
    li.append(left,right);

    (m.taken ? takenListEl : medListEl).appendChild(li);
  });

  buildYearCalendar();
}

/* ===================== ADD MED ===================== */
addBtn.onclick = () => {
  const name = document.getElementById("medName").value.trim();
  if(!name) return alert("Enter medicine name");

  const slots = document.querySelectorAll("#timeSlots .slot");
  const schedule = [];

  slots.forEach(s=>{
    const when = s.querySelector(".when").value;
    const meal = s.querySelector(".meal").value;
    const time = getTime(when, meal);
    schedule.push({when, meal, time});
  });

  meds.push({
    id: Date.now(),
    name,
    schedule,
    taken:false
  });

  // send email reminders for every timing
schedule.forEach(s => {
  sendToEmailReminder(name, s.time);
});

  save();
  render();
  startReminderEngine();
  document.getElementById("medName").value="";
};

/* ===================== B: REMINDERS ===================== */
/* ===================== REMINDER ENGINE (RELIABLE) ===================== */

function timeToMinutes(t){
  // "07:15 AM" → minutes since midnight
  const [time, mer] = t.split(" ");
  let [h,m] = time.split(":").map(Number);
  if(mer === "PM" && h !== 12) h += 12;
  if(mer === "AM" && h === 12) h = 0;
  return h*60 + m;
}

// store today fired reminders
let fired = JSON.parse(localStorage.getItem("firedToday")) || {};

function resetFiredIfNewDay(){
  const today = new Date().toDateString();
  if(fired._day !== today){
    fired = {_day: today};
    localStorage.setItem("firedToday", JSON.stringify(fired));
  }
}

function startReminderEngine(){
  resetFiredIfNewDay();

  setInterval(() => {
    resetFiredIfNewDay();

    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes();

    meds.forEach(m=>{
      m.schedule.forEach((s,idx)=>{
        const base = timeToMinutes(s.time);

        const before = base - 15;
        const ontime = base;
        const after  = base + 15;

        [
          {t: before, msg:`${m.name} in 15 minutes`},
          {t: ontime, msg:`${m.name} now`},
          {t: after,  msg:`${m.name} was due 15 minutes ago`}
        ].forEach((r,i)=>{
          const key = `${m.id}-${idx}-${i}`;
          if(nowMin === r.t && !fired[key]){
            notify("Medicine Reminder", r.msg);
            fired[key] = true;
            localStorage.setItem("firedToday", JSON.stringify(fired));
          }
        });
      });
    });
  }, 60000); // check every minute
}


/* ===================== C: SATURDAY INJECTION ===================== */
function scheduleSaturdayInjection(){
  const now = new Date();
  const d = now.getDay();
  const target = new Date(now);
  const daysToSat = (6 - d + 7) % 7;
  target.setDate(now.getDate() + daysToSat);
  target.setHours(9,0,0,0);

  let diff = target - now;
  if(diff < 0) diff += 7*24*60*60*1000;

  setTimeout(()=>{
    notify("Injection Reminder","Time for your D3 injection 💉");
    scheduleSaturdayInjection();
  }, diff);
}

/* ===================== D: CALENDAR ===================== */
// ===================== YEAR CALENDAR =====================
const INJECTION_NAME = "D3 Injection";

function buildYearCalendar(){
  const cal = document.getElementById("yearCalendar");
  if(!cal) return;

  cal.innerHTML = "";
  const now = new Date();
  const year = now.getFullYear();

  const monthNames = ["Jan","Feb","Mar"];

  for(let m=0;m<3;m++){
    const box = document.createElement("div");
    box.className="month";

    const title = document.createElement("h4");
    title.textContent = monthNames[m];
    box.appendChild(title);

    const daysGrid = document.createElement("div");
    daysGrid.className="days";

    const last = new Date(year,m+1,0).getDate();

    for(let d=1; d<=last; d++){
      const dateObj = new Date(year,m,d);
      const cell = document.createElement("div");
      cell.className="day";
      cell.textContent=d;

      // Saturday highlight
      if(dateObj.getDay()===6){
        cell.classList.add("sat");
      }

      cell.onclick = ()=> showDayDetails(dateObj);

      daysGrid.appendChild(cell);
    }

    box.appendChild(daysGrid);
    cal.appendChild(box);
  }
}

// ===================== DAY DETAILS POPUP =====================
function showDayDetails(date){
  const popup = document.getElementById("dayPopup");
  const list = document.getElementById("popupList");
  const title = document.getElementById("popupDate");

  title.textContent = date.toDateString();
  list.innerHTML = "";

  let found = false;

  // If Saturday → injection
  if(date.getDay() === 6){
    const li = document.createElement("li");
    li.textContent = "D3 Injection 💉";
    list.appendChild(li);
    found = true;
  }

  // Future: other weekly meds can go here

  if(!found){
    const li = document.createElement("li");
    li.textContent = "No scheduled medicines";
    list.appendChild(li);
  }

  popup.style.display = "flex";
}

window.closePopup = function(){
  document.getElementById("dayPopup").style.display="none";
};

/* ===================== E: PWA ===================== */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

/* ===================== INIT ===================== */
render();
startReminderEngine();
scheduleSaturdayInjection();

});























