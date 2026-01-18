document.addEventListener("DOMContentLoaded", () => {

  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxlknuHNVioG6McGgD6MgFRhTM8QbQpEurLZraQiEIowZ4ZIOPA8hj-qf9cxV1QHYR8/exec";

function sendToEmailReminder(medName, timeStr){
  const payload = {
    email: "shreeja.akella2992@gmail.com",
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






document.addEventListener("DOMContentLoaded", () => {

/* ===================== NOTIFICATIONS ===================== */
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
let fired = JSON.parse(localStorage.getItem("firedToday")) || {};
let lastAction = null;

/* ===================== MEAL TIMES ===================== */
const MEAL_TIMES = {
  breakfast: "07:45",
  lunch: "13:20",
  dinner: "19:30"
};

function getTime(when, meal){
  const [h,m] = MEAL_TIMES[meal].split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (when === "pre") d.setMinutes(d.getMinutes() - 15);
  if (when === "post") d.setMinutes(d.getMinutes() + 15);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function timeToMinutes(t){
  const [h,m] = t.split(":").map(Number);
  return h*60 + m;
}

/* ===================== DYNAMIC SLOTS ===================== */
function buildSlots(count){
  timeSlotsDiv.innerHTML = "";
  for(let i=0;i<count;i++){
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
function save(){
  localStorage.setItem("meds", JSON.stringify(meds));
}

function resetFiredIfNewDay(){
  const today = new Date().toDateString();
  if (fired._day !== today){
    fired = { _day: today };
    localStorage.setItem("firedToday", JSON.stringify(fired));
  }
}

function showUndo(index){
  toast.style.display = "flex";
  lastAction = index;
  setTimeout(()=>{
    toast.style.display = "none";
    lastAction = null;
  }, 5000);
}

undoBtn.onclick = () => {
  if(lastAction !== null){
    meds[lastAction].taken = false;
    save();
    render();
  }
  toast.style.display = "none";
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
      <small>${m.when} ${m.meal}</small><br>
      <small>⏰ ${m.time}</small>
    `;

    const right = document.createElement("div");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = m.taken;

    chk.onchange = () => {
      m.taken = chk.checked;
      save();
      if (m.taken) showUndo(i);
      render();
    };

    const del = document.createElement("button");
    del.textContent = "✖";
    del.onclick = () => {
      meds.splice(i,1);
      save();
      render();
    };

    right.append(chk, del);
    li.append(left, right);

    (m.taken ? takenListEl : medListEl).appendChild(li);
  });

  buildYearCalendar();
}

/* ===================== ADD MED ===================== */
addBtn.onclick = () => {
  const name = document.getElementById("medName").value.trim();
  if (!name) return alert("Enter medicine name");

  const slots = document.querySelectorAll("#timeSlots .slot");

  slots.forEach(slot => {
    const when = slot.querySelector(".when").value;
    const meal = slot.querySelector(".meal").value;
    const time = getTime(when, meal);

    meds.push({
      id: crypto.randomUUID(),
      name,
      when,
      meal,
      time,
      taken: false
    });
  });

  save();
  render();
  document.getElementById("medName").value = "";
};

/* ===================== REMINDER ENGINE ===================== */
function startReminderEngine(){
  resetFiredIfNewDay();

  setInterval(() => {
    resetFiredIfNewDay();

    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes();

    meds.forEach(m=>{
      if (m.taken) return;

      const base = timeToMinutes(m.time);

      [
        {t: base-15, msg:`${m.name} in 15 minutes`},
        {t: base,    msg:`${m.name} now`},
        {t: base+15, msg:`${m.name} was due 15 minutes ago`}
      ].forEach((r,i)=>{
        const key = `${m.id}-${i}`;
        if (nowMin === r.t && !fired[key]){
          notify("Medicine Reminder", r.msg);
          fired[key] = true;
          localStorage.setItem("firedToday", JSON.stringify(fired));
        }
      });
    });
  }, 60000);
}

/* ===================== SATURDAY INJECTION ===================== */
function scheduleSaturdayInjection(){
  const now = new Date();
  const d = now.getDay();
  const target = new Date(now);
  const daysToSat = (6 - d + 7) % 7;
  target.setDate(now.getDate() + daysToSat);
  target.setHours(12,30,0,0);

  let diff = target - now;
  if (diff < 0) diff += 7*24*60*60*1000;

  setTimeout(()=>{
    notify("Injection Reminder", "Time for your D3 injection 💉");
    scheduleSaturdayInjection();
  }, diff);
}

/* ===================== YEAR CALENDAR ===================== */
function buildYearCalendar(){
  const cal = document.getElementById("yearCalendar");
  if (!cal) return;

  cal.innerHTML = "";
  const year = new Date().getFullYear();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  for(let m=0;m<12;m++){
    const box = document.createElement("div");
    box.className = "month";

    const title = document.createElement("h4");
    title.textContent = months[m];
    box.appendChild(title);

    const daysGrid = document.createElement("div");
    daysGrid.className = "days";

    const last = new Date(year, m+1, 0).getDate();

    for(let d=1; d<=last; d++){
      const dateObj = new Date(year, m, d);
      const cell = document.createElement("div");
      cell.className = "day";
      cell.textContent = d;

      if (dateObj.getDay() === 6) cell.classList.add("sat");
      cell.onclick = () => showDayDetails(dateObj);

      daysGrid.appendChild(cell);
    }

    box.appendChild(daysGrid);
    cal.appendChild(box);
  }
}

function showDayDetails(date){
  const popup = document.getElementById("dayPopup");
  const list = document.getElementById("popupList");
  const title = document.getElementById("popupDate");

  title.textContent = date.toDateString();
  list.innerHTML = "";

  if (date.getDay() === 6){
    const li = document.createElement("li");
    li.textContent = "D3 Injection 💉";
    list.appendChild(li);
  } else {
    const li = document.createElement("li");
    li.textContent = "No scheduled medicines";
    list.appendChild(li);
  }

  popup.style.display = "flex";
}

window.closePopup = function(){
  document.getElementById("dayPopup").style.display = "none";
};

/* ===================== PWA ===================== */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js");
}

/* ===================== INIT ===================== */
render();
startReminderEngine();
scheduleSaturdayInjection();

});































