/* ============ ตั้งค่า (แก้ตรงนี้) ============ */
const CONFIG = {
  // Firebase web config identifies the project; access is controlled by Firebase Auth and Firestore Rules.
  firebase: {
    apiKey: "AIzaSyAY21pAn0mYc1LLVfs4kCyQHjyW-z1yCiA",
    authDomain: "spare-part-list-79629.firebaseapp.com",
    projectId: "spare-part-list-79629",
    storageBucket: "spare-part-list-79629.firebasestorage.app",
    messagingSenderId: "1045069859505",
    appId: "1:1045069859505:web:c5a88371afa5acd5337090",
    measurementId: "G-2BDL11KL1T"
  },
  // Add each Firebase Authentication user's UID here and to firestore.rules.
  adminUids: ["ZuMoD4BryHVakuieCehpKcfsd353"],
  // เช่น { apiKey:"...", authDomain:"...", projectId:"...", appId:"..." }
  cloudinary: { cloudName: "s52qoaji", uploadPreset: "Spare part list", folder: "spare-parts" },
  departments: ["GA", "Welding", "UT"],
  categories: ["Mechanical", "Electrical", "Pneumatics", "Sensor", "Bearing", "Belt", "Valve"],
  specKeys: ["model", "size", "voltage", "material", "pressure", "thread_size", "flow_rate"]
};

/* ============ Data layer ============ */
let localDataError = "";
function readLocalData() {
  try {
    const data = JSON.parse(localStorage.getItem("spc") || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("รูปแบบข้อมูลไม่ถูกต้อง");
    return data;
  } catch (e) {
    localDataError = `อ่านข้อมูลทดลองจากเบราว์เซอร์ไม่ได้: ${e.message}`;
    console.error(localDataError);
    return {};
  }
}
const Local = {
  data: readLocalData(), subs: {},
  watch(c, cb) { (this.subs[c] = this.subs[c] || []).push(cb); cb(this.data[c] || []); },
  async save(c, id, d) { if (localDataError) throw new Error("ไม่บันทึกทับข้อมูลที่อ่านไม่ได้ โปรดสำรอง/กู้คืนข้อมูลเบราว์เซอร์ก่อน"); const next = { ...this.data }, a = [...(next[c] || [])], i = a.findIndex(x => x.id === id), o = { ...d, id }; i < 0 ? a.push(o) : a[i] = o; next[c] = a; this.flush(c, next); },
  async del(c, id) { if (localDataError) throw new Error("ไม่บันทึกทับข้อมูลที่อ่านไม่ได้ โปรดสำรอง/กู้คืนข้อมูลเบราว์เซอร์ก่อน"); const next = { ...this.data }; next[c] = (next[c] || []).filter(x => x.id !== id); this.flush(c, next); },
  flush(c, next) { localStorage.setItem("spc", JSON.stringify(next)); this.data = next; (this.subs[c] || []).forEach(f => f(this.data[c])); }
};
let DB = Local, auth = null;
if (CONFIG.firebase) {
  firebase.initializeApp(CONFIG.firebase);
  const fs = firebase.firestore();
  fs.enablePersistence({ synchronizeTabs: true }).catch(e => {
    console.warn("Firestore offline persistence is unavailable:", e);
  });
  auth = firebase.auth();
  DB = {
    watch: (c, cb, onError) => fs.collection(c).onSnapshot(s => cb(s.docs.map(d => ({ ...d.data(), id: d.id }))), onError),
    save: (c, id, d) => fs.collection(c).doc(id).set(d),
    del: (c, id) => fs.collection(c).doc(id).delete()
  };
}

/* ============ State ============ */
let machines = [], parts = [], view = "grid", page = "machines", admin = !CONFIG.firebase;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const jsArg = value => esc(JSON.stringify(String(value)));
function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark-mode", dark);
  const toggle = $("#themeToggle");
  toggle.innerHTML = dark
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path></svg><span class="sr-only">เปลี่ยนเป็นโหมดสว่าง</span>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.7 8.7 0 1 0 20.9 13Z"></path></svg><span class="sr-only">เปลี่ยนเป็นโหมดมืด</span>`;
  toggle.setAttribute("aria-label", dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด");
  toggle.title = dark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด";
  document.querySelector('meta[name="theme-color"]').content = dark ? "#29272a" : "#efedee";
}
function preferredTheme() {
  try {
    const saved = localStorage.getItem("spc-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch (e) {
    console.warn("Could not read the saved theme preference:", e);
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function toggleTheme() {
  const theme = document.documentElement.classList.contains("dark-mode") ? "light" : "dark";
  applyTheme(theme);
  try {
    localStorage.setItem("spc-theme", theme);
  } catch (e) {
    console.warn("Could not save the theme preference:", e);
  }
}
const mOf = id => machines.find(m => m.id === id);
const mName = id => {
  const machine = mOf(id);
  return machine ? machine.name : "";
};
const legacyMachineIds = new Map();
function machineIds(part) {
  if (Array.isArray(part.machine_ids)) return part.machine_ids.filter(id => machines.some(m => m.id === id));
  return [...new Set((part.machine_codes || []).map(code =>
    legacyMachineIds.get(code) || machines.find(m => m.id === code || m.id === docId(code))?.id || ""
  ).filter(Boolean))];
}
const docId = pn => pn.trim().replace(/[\/\\#?\[\]]/g, "_");
const safeUrl = value => {
  try {
    const url = new URL(String(value || "").trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
};
const thumb = (u, w = 400) => {
  const url = safeUrl(u);
  return url && url.includes("/upload/") ? url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`) : url;
};
const partImagePreview = document.createElement("div");
partImagePreview.id = "partImagePreview";
partImagePreview.className = "part-image-preview";
partImagePreview.setAttribute("role", "tooltip");
partImagePreview.hidden = true;
document.body.append(partImagePreview);
function showPartImagePreview(trigger) {
  const imageUrl = safeUrl(trigger.dataset.previewImage);
  if (!imageUrl) return;
  const image = document.createElement("img");
  image.src = thumb(imageUrl, 480);
  image.alt = trigger.dataset.previewAlt || "รูปตัวอย่างอะไหล่";
  partImagePreview.replaceChildren(image);
  partImagePreview.hidden = false;
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(280, window.innerWidth - 24);
  const height = Math.min(220, window.innerHeight - 24);
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const top = rect.bottom + height + 12 <= window.innerHeight
    ? rect.bottom + 8
    : Math.max(12, rect.top - height - 8);
  partImagePreview.style.left = `${left}px`;
  partImagePreview.style.top = `${top}px`;
}
function hidePartImagePreview() {
  partImagePreview.hidden = true;
}
$("#list").addEventListener("pointerover", event => {
  const trigger = event.target.closest(".part-preview-trigger");
  if (trigger) showPartImagePreview(trigger);
});
$("#list").addEventListener("pointerout", event => {
  if (event.target.closest(".part-preview-trigger") && !event.relatedTarget?.closest?.(".part-preview-trigger")) hidePartImagePreview();
});
$("#list").addEventListener("focusin", event => {
  const trigger = event.target.closest(".part-preview-trigger");
  if (trigger) showPartImagePreview(trigger);
});
$("#list").addEventListener("focusout", event => {
  if (event.target.closest(".part-preview-trigger")) hidePartImagePreview();
});
const depts = p => [...new Set([
  ...(p.departments || []),
  ...machineIds(p).map(id => (mOf(id) || {}).department).filter(Boolean)
])];
function setConnection(message, error = false) {
  const el = $("#connectionStatus");
  if (!el) return;
  el.textContent = error ? message : "";
  el.hidden = !error;
  el.style.color = error ? "var(--danger)" : "var(--mute)";
}
function showAuthNotice(message, error = false) {
  const el = $("#authNotice");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", error);
  el.hidden = false;
}

/* ============ Filters & list ============ */
function fillSelect(id, label, opts, keep) {
  const el = $(id), v = keep ?? el.value;
  el.innerHTML = `<option value="">${label}</option>` + opts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join("");
  el.value = opts.some(o => o[0] === v) ? v : "";
}
function refreshFilters() {
  const departments = [...new Set([
    ...CONFIG.departments,
    ...machines.map(m => m.department).filter(Boolean),
    ...parts.flatMap(p => p.departments || [])
  ])].sort();
  fillSelect("#fDept", "ทุกแผนก", departments.map(d => [d, d]));
  fillSelect("#fMach", "ทุกเครื่องจักร", machines.map(m => [m.id, `${m.name}${m.station ? ` · Station ${m.station}` : ""}`]));
  fillSelect("#fCat", "ทุกหมวดหมู่", CONFIG.categories.map(c => [c, c]));
  fillSelect("#fSystem", "ทุกระบบย่อย", [...new Set(parts.map(p => p.subsystem).filter(Boolean))].sort().map(s => [s, s]));
}
function filtered() {
  const q = $("#q").value.trim().toLowerCase(), d = $("#fDept").value, m = $("#fMach").value, c = $("#fCat").value, s = $("#fSystem").value;
  return parts.filter(p => p.active !== false).filter(p => {
    if (c && p.category !== c) return false;
    if (s && p.subsystem !== s) return false;
    if (m && !machineIds(p).includes(m)) return false;
    if (d && !depts(p).includes(d)) return false;
    if (!q) return true;
    const hay = [p.part_number, p.manufacturer_part_number, p.part_name_th, p.part_name_en, p.brand_vendor, p.supplier, p.model, p.subsystem, p.installation_point, p.location_rack, ...machineIds(p).map(id => `${mName(id)} ${(mOf(id) || {}).station || ""}`)].join(" ").toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }).sort((a, b) => a.part_number.localeCompare(b.part_number));
}
function selectMachine(id) {
  $("#fMach").value = id;
  $("#fSystem").value = "";
  $("#q").value = "";
  page = "parts";
  $("#dlg").close();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showMachines() {
  page = "machines";
  $("#fMach").value = "";
  $("#q").value = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showParts() {
  page = "parts";
  $("#fMach").value = "";
  $("#q").value = "";
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function machineCard(machine) {
  const count = parts.filter(p => p.active !== false && machineIds(p).includes(machine.id)).length;
  const image = safeUrl(machine.image_url);
  return `<article class="bg-white rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow" style="border-color:var(--line)">
    <button type="button" class="block w-full text-left p-4" onclick="selectMachine(${jsArg(machine.id)})" aria-label="เปิดเครื่องจักร ${esc(machine.name)}">
      ${image ? `<img class="machine-photo-card" src="${esc(thumb(image, 640))}" alt="รูปเครื่องจักร ${esc(machine.name)}" loading="lazy">` : `<div class="machine-photo-placeholder" aria-hidden="true">ยังไม่มีรูปเครื่องจักร</div>`}
      <div class="flex items-start justify-between gap-2"><div><h3 class="font-bold text-lg">${esc(machine.name)}</h3>${machine.station ? `<p class="mono text-sm mt-1" style="color:var(--acc)">Station: ${esc(machine.station)}</p>` : ""}</div><span class="tag">${count} รายการ</span></div>
      <p class="text-sm mt-2" style="color:var(--mute)">${esc(machine.department || "ยังไม่ระบุแผนก")}</p>
      ${machine.manufacturer || machine.model ? `<p class="text-sm mt-1" style="color:var(--mute)">${esc([machine.manufacturer, machine.model].filter(Boolean).join(" · "))}</p>` : ""}
      <span class="inline-block text-sm font-semibold mt-4" style="color:var(--acc)">เปิดโปรไฟล์เครื่องจักร →</span>
    </button>
    ${admin ? `<div class="px-4 pb-4"><button class="btn text-sm" type="button" onclick="machinesDlg(${jsArg(machine.id)})">แก้ไขข้อมูลเครื่อง</button></div>` : ""}
  </article>`;
}
function renderMachineDirectory() {
  const q = $("#q").value.trim().toLowerCase();
  const list = machines.filter(m => [m.name, m.department, m.manufacturer, m.model, m.serial_number, m.station].join(" ").toLowerCase().includes(q));
  $("#machineGrid").innerHTML = list.length
    ? list.map(machineCard).join("")
    : `<div class="bg-white rounded-xl border p-8 text-center sm:col-span-2 lg:col-span-3" style="border-color:var(--line)"><p class="font-bold text-lg">${machines.length ? "ไม่พบเครื่องจักรที่ตรงกับคำค้น" : "ยังไม่มีข้อมูลเครื่องจักร"}</p><p class="text-sm mt-1" style="color:var(--mute)">${machines.length ? "ลองค้นหาด้วยชื่อเครื่อง แผนก หรือ Station" : "เพิ่มเครื่องจักรก่อน แล้วจึงเชื่อมโยงรายการอะไหล่ที่ใช้กับเครื่องนั้น"}</p>${admin && !machines.length ? `<button class="btn btn-p mt-4" type="button" onclick="machinesDlg()">+ เพิ่มเครื่องจักร</button>${!CONFIG.firebase && !localDataError ? `<button class="btn mt-4 ml-2" type="button" onclick="loadSample()">ใส่ข้อมูลตัวอย่าง</button>` : ""}` : ""}</div>`;
}
function specLine(p) {
  return Object.entries(p.specifications || {}).slice(0, 3).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(" · ");
}
function render() {
  const list = filtered(), all = parts.filter(p => p.active !== false);
  const directory = page === "machines";
  $("#machineDirectory").hidden = !directory;
  $("#catalogControls").hidden = directory;
  $("#partsSection").hidden = directory;
  $("#navMachines").classList.toggle("btn-p", directory);
  $("#navMachines").setAttribute("aria-pressed", String(directory));
  $("#navParts").classList.toggle("btn-p", !directory);
  $("#navParts").setAttribute("aria-pressed", String(!directory));
  $("#q").placeholder = directory
    ? "ค้นหาชื่อเครื่อง, แผนก, Station, รุ่น หรือหมายเลขเครื่อง"
    : "ค้นหา Part No., ชื่ออะไหล่, ยี่ห้อ หรือเครื่องจักร";
  $("#searchLabel").textContent = directory ? "ค้นหาเครื่องจักร" : "ค้นหาอะไหล่";
  if (directory) {
    renderMachineDirectory();
    return;
  }
  const linkedParts = all.filter(p => machineIds(p).length > 0).length;
  $("#stats").innerHTML = [["เครื่องจักร", machines.length], ["รายการอะไหล่", all.length], ["อะไหล่ที่ระบุเครื่องจักร", linkedParts], ["หมวดหมู่", new Set(all.map(p => p.category).filter(Boolean)).size]]
    .map(([l, n]) => `<div class="stat"><div class="text-2xl font-bold mono">${n}</div><div class="opacity-80">${l}</div></div>`).join("");
  $("#count").textContent = all.length ? `แสดง ${list.length} จาก ${all.length} รายการ` : "";
  $("#exportCsv").textContent = `ส่งออก CSV (${list.length})`;
  $("#exportCsv").disabled = !list.length;
  $("#exportCsv").title = "ส่งออกรายการอะไหล่ที่ตรงกับตัวกรองปัจจุบัน";
  const selectedMachine = machines.find(m => m.id === $("#fMach").value);
  const summary = $("#machineSummary");
  if (selectedMachine) {
    const machineParts = all.filter(p => machineIds(p).includes(selectedMachine.id));
    const machineImage = safeUrl(selectedMachine.image_url);
    summary.hidden = false;
    summary.innerHTML = `<div class="grid ${machineImage ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]" : ""} gap-4 items-start">${machineImage ? `<img class="machine-photo-profile" src="${esc(thumb(machineImage, 1000))}" alt="รูปเครื่องจักร ${esc(selectedMachine.name)}">` : ""}<div><div class="flex items-start justify-between gap-3 flex-wrap"><div><p class="text-xs uppercase tracking-wider" style="color:var(--mute)">Machine profile</p><h2 class="text-xl font-bold mt-1">${esc(selectedMachine.name)}${selectedMachine.station ? ` · Station ${esc(selectedMachine.station)}` : ""}</h2><p class="text-sm mt-1" style="color:var(--mute)">${esc(selectedMachine.department || "ยังไม่ระบุแผนก")} · อะไหล่ที่เกี่ยวข้อง ${machineParts.length} รายการ</p></div><div class="flex gap-2 flex-wrap">${admin ? `<button class="btn text-sm" type="button" onclick="machinesDlg(${jsArg(selectedMachine.id)})">แก้ไขโปรไฟล์</button>` : ""}<button class="btn text-sm" type="button" onclick="showMachines()">เครื่องจักรทั้งหมด</button><button class="btn text-sm" type="button" onclick="showParts()">อะไหล่ทุกเครื่อง</button><button class="btn btn-p text-sm" type="button" onclick="printMachine(${jsArg(selectedMachine.id)})">พิมพ์รายการ</button></div></div><dl class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">${[["ผู้ผลิต", selectedMachine.manufacturer], ["รุ่น", selectedMachine.model], ["หมายเลขเครื่อง", selectedMachine.serial_number], ["Station", selectedMachine.station]].filter(x => x[1]).map(([label, value]) => `<div><dt class="text-xs" style="color:var(--mute)">${label}</dt><dd class="font-medium">${esc(value)}</dd></div>`).join("")}</dl>${selectedMachine.remark ? `<p class="text-sm mt-3">${esc(selectedMachine.remark)}</p>` : ""}</div></div>`;
  } else {
    summary.hidden = true;
    summary.innerHTML = "";
  }
  $("#printView").hidden = !selectedMachine;
  document.querySelectorAll("[data-view]").forEach(b => { b.classList.toggle("btn-p", b.dataset.view === view); b.setAttribute("aria-pressed", String(b.dataset.view === view)); });
  if (!all.length) {
    $("#list").innerHTML = `<div class="bg-white rounded-lg p-8 text-center plate"><p class="font-bold text-lg">ยังไม่มีข้อมูลอะไหล่</p><p class="mt-1" style="color:var(--mute)">${admin ? "เริ่มจากเพิ่มเครื่องจักร แล้วเพิ่มอะไหล่ของเครื่องนั้น" : "ผู้ดูแลระบบยังไม่ได้เพิ่มข้อมูล"}</p>${admin ? `<div class="mt-4 flex gap-2 justify-center flex-wrap"><button class="btn btn-p" onclick="machinesDlg()">เพิ่มเครื่องจักร</button>${!CONFIG.firebase && !localDataError ? `<button class="btn" onclick="loadSample()">ใส่ข้อมูลตัวอย่าง</button>` : ""}</div>` : ""}</div>`;
    return;
  }
  if (!list.length) { $("#list").innerHTML = `<p class="py-10 text-center" style="color:var(--mute)">ไม่พบอะไหล่ที่ตรงกับเงื่อนไข ลองลบตัวกรองหรือเปลี่ยนคำค้นหา</p>`; return; }
  $("#list").innerHTML = view === "grid"
    ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${list.map(card).join("")}</div>`
    : `<div class="overflow-x-auto bg-white rounded-xl border shadow-sm" style="border-color:var(--line)"><table class="w-full text-sm min-w-[1200px]"><caption class="sr-only">รายการอะไหล่และเครื่องจักรที่เกี่ยวข้อง</caption><thead class="text-left surface-muted"><tr>${["Part No.", "ชื่ออะไหล่", "แผนกที่ใช้", "เครื่องจักรที่ใช้", "ระบบ / จุดติดตั้ง", "หมวดหมู่", "ยี่ห้อ / ผู้ผลิต", "ตำแหน่งจัดเก็บ", "สเปคย่อ", ""].map(h => `<th class="p-3">${h}</th>`).join("")}</tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>`;
}
const partNumber = p => safeUrl(p.images?.[0])
  ? `<span class="part-preview-trigger mono font-semibold" tabindex="0" data-preview-image="${esc(safeUrl(p.images[0]))}" data-preview-alt="${esc(p.part_name_th || p.part_number)}" aria-describedby="partImagePreview">${esc(p.part_number)}</span>`
  : `<span class="mono font-semibold">${esc(p.part_number)}</span>`;
const card = p => `<article class="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow" style="border-color:var(--line)">
  <div class="p-4"><div class="flex items-start gap-3">${safeUrl(p.images?.[0]) ? `<img loading="lazy" src="${esc(thumb(p.images[0], 160))}" alt="${esc(p.part_name_th || p.part_number)}" class="part-card-thumb">` : ""}
  <div class="min-w-0"><div class="text-lg">${partNumber(p)}</div>
  <div class="font-medium">${esc(p.part_name_th || p.part_name_en)}</div></div></div>
  ${p.subsystem || p.installation_point ? `<div class="text-sm mt-1" style="color:var(--mute)">${esc([p.subsystem, p.installation_point].filter(Boolean).join(" · "))}</div>` : ""}
  <div class="text-sm" style="color:var(--mute)">${esc(p.brand_vendor)}${p.supplier ? ` · ${esc(p.supplier)}` : ""}</div>
  <div class="flex flex-wrap gap-1 mt-2">${machineIds(p).slice(0, 3).map(id => `<button type="button" class="tag" onclick="selectMachine(${jsArg(id)})">${esc(mName(id))}</button>`).join("")}${depts(p).slice(0, 2).map(d => `<span class="tag">${esc(d)}</span>`).join("")}</div>
  <div class="text-sm mt-2" style="color:var(--mute)">${specLine(p)}</div>
  <button class="btn btn-p w-full mt-3" type="button" onclick="detail(${jsArg(p.id)})">ดูรายละเอียดอะไหล่</button></div></article>`;
const row = p => `<tr class="border-t" style="border-color:var(--line)"><td class="p-3">${partNumber(p)}</td><td class="p-3">${esc(p.part_name_th || p.part_name_en)}</td><td class="p-3">${esc(depts(p).join(", ") || "—")}</td><td class="p-3">${machineIds(p).map(id => `<button class="tag mr-1 mb-1" type="button" onclick="selectMachine(${jsArg(id)})">${esc(mName(id))}</button>`).join("") || "—"}</td><td class="p-3">${esc([p.subsystem, p.installation_point].filter(Boolean).join(" · ")) || "—"}</td><td class="p-3">${esc(p.category)}</td><td class="p-3">${esc(p.brand_vendor)}</td><td class="p-3">${esc(p.location_rack)}</td><td class="p-3">${specLine(p)}</td><td class="p-3"><button class="btn" type="button" onclick="detail(${jsArg(p.id)})">รายละเอียด</button></td></tr>`;
function exportCsv() {
  const columns = ["Part No.", "Manufacturer Part No.", "ชื่อไทย", "ชื่ออังกฤษ", "หมวดหมู่", "ยี่ห้อ / ผู้ผลิต", "รุ่น", "ระบบย่อย", "จุดติดตั้ง", "เครื่องจักรที่ใช้", "Station", "แผนก", "ตำแหน่งจัดเก็บ", "อะไหล่ทดแทน", "สเปค", "หมายเหตุ", "แก้ไขล่าสุด"];
  const csvCell = value => {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = filtered().map(p => [
    p.part_number, p.manufacturer_part_number, p.part_name_th, p.part_name_en, p.category, p.brand_vendor, p.model, p.subsystem, p.installation_point,
    machineIds(p).map(id => mName(id)).join("; "), [...new Set(machineIds(p).map(id => (mOf(id) || {}).station).filter(Boolean))].join("; "), depts(p).join("; "),
    p.location_rack, (p.substitute_ids || []).map(id => parts.find(x => x.id === id)?.part_number || id).join("; "), JSON.stringify(p.specifications || {}), p.remark, p.updated_at
  ]);
  const content = "\uFEFF" + [columns, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `spare-parts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function printMachine(id) {
  const machine = machines.find(m => m.id === id);
  if (!machine) { setConnection("ไม่พบเครื่องจักรสำหรับจัดทำรายการพิมพ์", true); return; }
  const machineParts = parts.filter(p => p.active !== false && machineIds(p).includes(id))
    .sort((a, b) => a.part_number.localeCompare(b.part_number));
  $("#printView").innerHTML = `<h1>รายการอะไหล่ประจำเครื่อง</h1>
    <p class="print-meta"><strong>${esc(machine.name)}</strong>${machine.station ? ` · Station ${esc(machine.station)}` : ""}${machine.department ? ` · ${esc(machine.department)}` : ""}<br>
    ${machine.manufacturer ? `ผู้ผลิต ${esc(machine.manufacturer)}　` : ""}${machine.model ? `รุ่น ${esc(machine.model)}　` : ""}${machine.serial_number ? `Serial No. ${esc(machine.serial_number)}` : ""}<br>
    จำนวน ${machineParts.length} รายการ · พิมพ์เมื่อ ${esc(new Date().toLocaleString("th-TH"))}</p>
    <table><thead><tr>${["Part No.", "Manufacturer Part No.", "ชื่ออะไหล่", "แผนกที่ใช้", "ระบบย่อย", "จุดติดตั้ง", "ยี่ห้อ / รุ่น", "หมวดหมู่", "สเปค", "เอกสารอ้างอิง"].map(h => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${machineParts.map(p => `<tr><td>${esc(p.part_number)}</td><td>${esc(p.manufacturer_part_number || "—")}</td><td>${esc(p.part_name_th || p.part_name_en || "—")}</td><td>${esc(depts(p).join(", ") || "—")}</td><td>${esc(p.subsystem || "—")}</td><td>${esc(p.installation_point || "—")}</td><td>${esc([p.brand_vendor, p.model].filter(Boolean).join(" / ") || "—")}</td><td>${esc(p.category || "—")}</td><td>${esc(Object.entries(p.specifications || {}).map(([k,v]) => `${k}: ${v}`).join(" · ") || "—")}</td><td>${esc((p.documents || []).filter(d => safeUrl(d.url)).map(d => d.name || d.url).join("; ") || "—")}</td></tr>`).join("") || `<tr><td colspan="10">ยังไม่มีรายการอะไหล่ที่เชื่อมกับเครื่องจักรนี้</td></tr>`}</tbody></table>
    ${machine.remark ? `<p class="print-meta"><strong>หมายเหตุ:</strong> ${esc(machine.remark)}</p>` : ""}`;
  $("#printView").hidden = false;
  document.body.classList.add("printing-machine");
  window.print();
}
window.addEventListener("afterprint", () => document.body.classList.remove("printing-machine"));

/* ============ Detail modal ============ */
function open(html) { $("#dlgBody").innerHTML = html; const d = $("#dlg"); if (!d.open) d.showModal(); }
function closeDlg() { $("#dlg").close(); }
$("#dlg").addEventListener("close", () => { if (location.hash.startsWith("#part=")) history.replaceState(null, "", location.pathname); });
$("#dlg").addEventListener("click", e => { if (e.target.id === "dlg") closeDlg(); });
const head = (t) => `<div class="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10" style="border-color:var(--line)"><h2 class="font-bold text-lg">${t}</h2><button class="btn" onclick="closeDlg()" aria-label="ปิด">ปิด</button></div>`;

function detail(id) {
  const p = parts.find(x => x.id === id); if (!p) return;
  history.replaceState(null, "", "#part=" + encodeURIComponent(id));
  const imgs = (p.images || []).filter(safeUrl);
  const installImgs = (p.installation_images || []).filter(safeUrl);
  const markers = p.installation_markers || [];
  const alternatives = parts.filter(x => x.active !== false && x.id !== p.id && (p.substitute_ids || []).includes(x.id));
  const substitutesFor = parts.filter(x => x.active !== false && x.id !== p.id && (x.substitute_ids || []).includes(p.id));
  open(`${head(`<span class="mono">${esc(p.part_number)}</span>`)}
  <div class="p-4 grid md:grid-cols-2 gap-5">
    <div>${imgs.length ? `<a id="mainLink" href="${esc(safeUrl(imgs[0]))}" target="_blank" rel="noopener"><img id="mainImg" src="${esc(thumb(imgs[0], 900))}" class="w-full rounded-lg border" alt="${esc(p.part_name_th || p.part_number)}"></a>
      <div class="flex gap-2 mt-2 overflow-x-auto">${imgs.map(u => `<img src="${esc(thumb(u, 120))}" class="w-16 h-16 object-cover rounded border cursor-pointer" onclick="mainImg.src=${jsArg(thumb(u, 900))};mainLink.href=${jsArg(safeUrl(u))}" alt="">`).join("")}</div>
      <p class="text-xs mt-1" style="color:var(--mute)">แตะรูปใหญ่เพื่อเปิดขนาดเต็มและซูมอ่านรหัสบนเพลท</p>` : `<div class="aspect-[4/3] surface-muted rounded-lg flex items-center justify-center" style="color:var(--mute)">ไม่มีรูป</div>`}</div>
    <div>
      <div class="text-xl font-bold">${esc(p.part_name_th)}</div><div style="color:var(--mute)">${esc(p.part_name_en)}</div>
      <div class="mt-2 flex flex-wrap gap-1"><span class="tag">${esc(p.category)}</span><span class="tag">${esc(p.brand_vendor)}</span></div>
      ${depts(p).length ? `<p class="text-sm mt-3"><strong>แผนกที่ใช้:</strong> ${esc(depts(p).join(", "))}</p>` : ""}
      ${p.manufacturer_part_number ? `<p class="text-sm mt-3"><strong>Manufacturer Part No.:</strong> <span class="mono">${esc(p.manufacturer_part_number)}</span></p>` : ""}
      ${p.model ? `<p class="text-sm mt-1"><strong>รุ่น:</strong> ${esc(p.model)}</p>` : ""}
      ${p.subsystem ? `<p class="text-sm mt-1"><strong>ระบบย่อย:</strong> ${esc(p.subsystem)}</p>` : ""}
      ${p.installation_point ? `<p class="text-sm mt-1"><strong>จุดติดตั้ง:</strong> ${esc(p.installation_point)}</p>` : ""}
          <h3 class="font-bold mt-4 mb-1">เครื่องจักรที่ใช้อะไหล่นี้</h3>
          ${machineIds(p).map(id => {
            const machine = mOf(id);
            return `<button type="button" class="plate pl-3 mb-1 w-full text-left" onclick="selectMachine(${jsArg(id)})"><span class="font-semibold">${esc(machine?.name || "เครื่องจักร")}</span>${machine?.station ? ` · Station ${esc(machine.station)}` : ""}<span class="block text-xs" style="color:var(--mute)">${esc(machine?.department || "")} · ดูอะไหล่ของเครื่องนี้</span></button>`;
          }).join("") || `<p style="color:var(--mute)">ยังไม่ระบุเครื่องจักร</p>`}
      <h3 class="font-bold mt-4 mb-1">ตำแหน่งจัดเก็บ</h3><p class="mono">${esc(p.location_rack) || "-"}</p>
      ${alternatives.length || substitutesFor.length ? `<h3 class="font-bold mt-4 mb-1">อะไหล่ทดแทน / ใช้แทนกันได้</h3>${[...alternatives, ...substitutesFor].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i).map(x => `<button type="button" class="plate pl-3 mb-1 w-full text-left" onclick="detail(${jsArg(x.id)})"><span class="mono font-semibold">${esc(x.part_number)}</span> · ${esc(x.part_name_th || x.part_name_en || x.part_number)}</button>`).join("")}` : ""}
    </div>
    <div class="md:col-span-2"><h3 class="font-bold mb-1">สเปค</h3>
      <table class="w-full text-sm border" style="border-color:var(--line)">${Object.entries(p.specifications || {}).map(([k, v]) => `<tr class="border-t" style="border-color:var(--line)"><td class="p-2 w-1/3 surface-muted" style="color:var(--mute)">${esc(k)}</td><td class="p-2">${esc(v)}</td></tr>`).join("") || `<tr><td class="p-2" style="color:var(--mute)">ยังไม่มีสเปค</td></tr>`}</table>
      ${(p.documents || []).some(d => safeUrl(d.url)) ? `<h3 class="font-bold mt-4 mb-1">เอกสาร</h3>${p.documents.filter(d => safeUrl(d.url)).map(d => `<a class="btn inline-block mr-2 mb-2" href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener">${esc(d.name || "เปิดเอกสาร")}</a>`).join("")}` : ""}
      ${installImgs.length ? `<h3 class="font-bold mt-4 mb-2">รูปตำแหน่งติดตั้ง</h3><div class="flex flex-col gap-4">${installImgs.map((u, i) => `<div><a href="${esc(safeUrl(u))}" target="_blank" rel="noopener" class="install-photo"><img src="${esc(thumb(u, 900))}" alt="ตำแหน่งติดตั้ง ${i + 1}">${markers.filter(m => m.image_index === i).map((m, n) => `<span class="install-photo-mark" style="left:${Number(m.x)}%;top:${Number(m.y)}%" title="${esc(m.label)}">${n + 1}</span>`).join("")}</a><p class="text-xs mt-1" style="color:var(--mute)">ภาพ ${i + 1}: ${markers.filter(m => m.image_index === i).map(m => esc(m.label)).join(" · ") || "ไม่มีจุดทำเครื่องหมาย"}</p></div>`).join("")}</div>` : ""}
      ${p.remark ? `<h3 class="font-bold mt-4 mb-1">หมายเหตุ</h3><p>${esc(p.remark)}</p>` : ""}
      ${admin ? `<div class="mt-5 flex gap-2"><button class="btn btn-p" onclick="partForm(${jsArg(p.id)})">แก้ไข</button><button class="btn btn-d" onclick="delPart(${jsArg(p.id)})">ลบ</button></div>` : ""}
    </div></div>`);
}
async function delPart(id) {
  if (!confirm("ลบอะไหล่นี้? (ข้อมูลจะถูกซ่อน ไม่ได้ลบถาวร)")) return;
  const p = parts.find(x => x.id === id); if (!p) { setConnection("ไม่พบอะไหล่ที่ต้องการลบ", true); return; }
  const { id: _, ...rest } = p;
  try { await DB.save("spare_parts", id, { ...rest, active: false }); closeDlg(); }
  catch (e) { setConnection(`ลบอะไหล่ไม่สำเร็จ: ${e.message}`, true); }
}

/* ============ Part form ============ */
let fImgs = [], fInstallImgs = [], fInstallMarkers = [];
let pendingPartUploads = 0, pendingInstallUploads = 0;
function updatePartSaveButton() {
  const button = $("#partSaveBtn");
  if (button) button.disabled = pendingPartUploads > 0 || pendingInstallUploads > 0;
}
const rowSpec = (k = "", v = "") => `<div class="flex gap-2 mb-2 spec"><input class="inp" list="sk" placeholder="หัวข้อ เช่น voltage" value="${esc(k)}"><input class="inp" placeholder="ค่า เช่น 24VDC" value="${esc(v)}"><button type="button" class="btn" onclick="this.parentElement.remove()" aria-label="ลบแถว">✕</button></div>`;
const rowDoc = (n = "", u = "") => `<div class="flex gap-2 mb-2 doc"><input class="inp" placeholder="ชื่อเอกสาร" value="${esc(n)}"><input class="inp" placeholder="URL (https://...)" value="${esc(u)}"><button type="button" class="btn" onclick="this.parentElement.remove()" aria-label="ลบแถว">✕</button></div>`;
function partForm(id) {
  const p = id ? parts.find(x => x.id === id) : { departments: [], machine_ids: [], specifications: {}, images: [], installation_images: [], installation_markers: [], substitute_ids: [], documents: [] };
  if (!p) { setConnection("ไม่พบอะไหล่ที่ต้องการแก้ไข", true); return; }
  const linkedMachineIds = machineIds(p);
  const partDepartments = p.departments || [...new Set(linkedMachineIds.map(id => (mOf(id) || {}).department).filter(Boolean))];
  const partDepartmentOptions = [...new Set([
    ...CONFIG.departments,
    ...partDepartments,
    ...linkedMachineIds.map(id => (mOf(id) || {}).department).filter(Boolean)
  ])];
  fImgs = [...(p.images || [])];
  fInstallImgs = [...(p.installation_images || [])];
  fInstallMarkers = (p.installation_markers || []).map(m => ({ ...m }));
  const opt = (arr, v) => `<option value="">เลือก</option>` + arr.map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("");
  open(`${head(id ? "แก้ไขอะไหล่" : "เพิ่มอะไหล่")}
  <div class="p-4"><datalist id="sk">${CONFIG.specKeys.map(k => `<option value="${k}">`).join("")}</datalist>
  <div class="grid sm:grid-cols-2 gap-x-3">
    <div><label class="lbl">Part No. *</label><input id="f_pn" class="inp mono" value="${esc(p.part_number)}"></div>
    <div><label class="lbl">หมวดหมู่ *</label><select id="f_cat" class="inp">${opt(CONFIG.categories, p.category)}</select></div>
    <div><label class="lbl">ชื่อไทย</label><input id="f_th" class="inp" value="${esc(p.part_name_th)}"></div>
    <div><label class="lbl">ชื่ออังกฤษ</label><input id="f_en" class="inp" value="${esc(p.part_name_en)}"></div>
    <div><label class="lbl">ยี่ห้อ / ผู้ผลิต</label><input id="f_br" class="inp" value="${esc(p.brand_vendor)}"></div>
    <div><label class="lbl">Manufacturer Part No.</label><input id="f_mpn" class="inp mono" value="${esc(p.manufacturer_part_number)}"></div>
    <div><label class="lbl">รุ่น / Model</label><input id="f_model" class="inp" value="${esc(p.model)}"></div>
    <div><label class="lbl">ผู้ขาย / ผู้จำหน่าย</label><input id="f_supplier" class="inp" value="${esc(p.supplier)}"></div>
    <div><label class="lbl">ตำแหน่งจัดเก็บ</label><input id="f_loc" class="inp" value="${esc(p.location_rack)}" placeholder="Rack A-02-03"></div>
    <div><label class="lbl">ระบบย่อย</label><input id="f_system" class="inp" value="${esc(p.subsystem)}" placeholder="เช่น ระบบลม, ชุดขับเคลื่อน"></div>
    <div><label class="lbl">จุดติดตั้ง</label><input id="f_point" class="inp" value="${esc(p.installation_point)}" placeholder="เช่น ด้านขับ, สถานี 2"></div>
  </div>
  <label class="lbl">เครื่องจักรที่ใช้ (เลือกได้หลายเครื่อง)</label>
  <div class="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded p-2" style="border-color:var(--line)">${machines.map(m => `<label class="flex items-center gap-2 min-h-[36px]"><input type="checkbox" class="f_m" value="${esc(m.id)}" ${linkedMachineIds.includes(m.id) ? "checked" : ""}>${esc(m.name)}${m.station ? ` · Station ${esc(m.station)}` : ""}</label>`).join("") || `<span style="color:var(--mute)">ยังไม่มีเครื่องจักร ให้เพิ่มก่อน</span>`}</div>
  <label class="lbl">แผนกที่ใช้อะไหล่นี้ (เลือกได้หลายแผนก)</label>
  <div class="grid sm:grid-cols-3 gap-1 border rounded p-2" style="border-color:var(--line)">${partDepartmentOptions.map(d => `<label class="flex items-center gap-2 min-h-[36px]"><input type="checkbox" class="f_part_dept" value="${esc(d)}" ${partDepartments.includes(d) ? "checked" : ""}>${esc(d)}</label>`).join("")}</div>
  <label class="lbl">สเปค</label><div id="specs">${Object.entries(p.specifications || {}).map(([k, v]) => rowSpec(k, v)).join("")}</div><button type="button" class="btn" onclick="specs.insertAdjacentHTML('beforeend',rowSpec())">+ เพิ่มสเปค</button>
  <label class="lbl">รูปภาพ</label><div id="imgs" class="flex gap-2 flex-wrap mb-2"></div>
  <div class="flex gap-2 flex-wrap"><button class="btn" type="button" onclick="document.getElementById('partUploadInput').click()">อัปโหลดรูปอะไหล่</button><input id="partUploadInput" type="file" accept="image/*" multiple class="sr-only" onchange="uploadFromInput(this,'part')">
  <input id="f_url" class="inp flex-1 min-w-[160px]" placeholder="หรือวาง URL รูป"><button type="button" class="btn" onclick="addImgUrl()">เพิ่ม</button></div><p id="upMsg" class="text-sm mt-1" style="color:var(--mute)"></p>
  <label class="lbl">รูปตำแหน่งติดตั้งและจุดอ้างอิง</label><p class="text-xs mb-2" style="color:var(--mute)">คลิกบนรูปเพื่อปักหมายเลขตำแหน่ง แล้วใส่ชื่อจุด เช่น มอเตอร์ด้านขับ</p>
  <div id="installImgs" class="flex gap-3 flex-wrap mb-2"></div>
  <div class="flex gap-2 flex-wrap"><button class="btn" type="button" onclick="document.getElementById('installUploadInput').click()">อัปโหลดรูปตำแหน่ง</button><input id="installUploadInput" type="file" accept="image/*" multiple class="sr-only" onchange="uploadFromInput(this,'install')">
  <input id="f_install_url" class="inp flex-1 min-w-[160px]" placeholder="หรือวาง URL รูปตำแหน่ง"><button type="button" class="btn" onclick="addInstallImgUrl()">เพิ่ม</button></div><p id="installUpMsg" class="text-sm mt-1" style="color:var(--mute)"></p>
  <label class="lbl">อะไหล่ทดแทน / ใช้แทนกันได้</label>
  <div class="grid sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto border rounded p-2" style="border-color:var(--line)">${parts.filter(x => x.active !== false && x.id !== p.id).map(x => `<label class="flex items-center gap-2 min-h-[36px]"><input type="checkbox" class="f_substitute" value="${esc(x.id)}" ${(p.substitute_ids || []).includes(x.id) ? "checked" : ""}><span class="mono">${esc(x.part_number)}</span> ${esc(x.part_name_th || x.part_name_en || "")}</label>`).join("") || `<span style="color:var(--mute)">ยังไม่มีอะไหล่อื่นให้เลือก</span>`}</div>
  <label class="lbl">เอกสาร / Datasheet</label><div id="docs">${(p.documents || []).map(d => rowDoc(d.name, d.url)).join("")}</div><button type="button" class="btn" onclick="docs.insertAdjacentHTML('beforeend',rowDoc())">+ เพิ่มเอกสาร</button>
  <label class="lbl">หมายเหตุ</label><textarea id="f_rm" class="inp" rows="2">${esc(p.remark)}</textarea>
  <div class="mt-5 flex gap-2"><button id="partSaveBtn" class="btn btn-p" onclick="savePart(${id ? jsArg(id) : "null"})">บันทึก</button><button class="btn" onclick="closeDlg()">ยกเลิก</button></div><p id="err" class="error-text text-sm mt-2"></p></div>`);
  drawImgs();
  drawInstallImgs();
}
function drawImgs() {
  $("#imgs").innerHTML = fImgs.map((u, i) => `<div class="relative"><img src="${esc(thumb(u, 120))}" class="w-16 h-16 object-cover rounded border" alt=""><button type="button" class="absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6" onclick="fImgs.splice(${i},1);drawImgs()" aria-label="ลบรูป">✕</button></div>`).join("");
}
function addImgUrl() {
  const value = $("#f_url").value.trim(), url = safeUrl(value);
  if (!url) { $("#upMsg").textContent = "กรุณาใส่ URL รูปภาพที่ขึ้นต้นด้วย https:// หรือ http://"; return; }
  fImgs.push(url); $("#f_url").value = ""; $("#upMsg").textContent = ""; drawImgs();
}
function drawInstallImgs() {
  const el = $("#installImgs");
  if (!el) return;
  el.innerHTML = fInstallImgs.map((u, i) => `<div class="min-w-0"><div class="install-photo install-photo-editor" onclick="markInstallation(event,${i})"><img src="${esc(thumb(u, 500))}" alt="รูปตำแหน่งติดตั้ง ${i + 1}">${fInstallMarkers.filter(m => m.image_index === i).map((m, n) => `<span class="install-photo-mark" style="left:${Number(m.x)}%;top:${Number(m.y)}%" title="${esc(m.label)}">${n + 1}</span>`).join("")}<button type="button" class="absolute -top-2 -right-2 bg-white border rounded-full w-6 h-6 leading-5" onclick="event.stopPropagation();removeInstallImg(${i})" aria-label="ลบรูปตำแหน่ง">✕</button></div><p class="text-xs mt-1" style="color:var(--mute)">ภาพ ${i + 1} · ${fInstallMarkers.filter(m => m.image_index === i).length} จุด</p></div>`).join("");
}
function markInstallation(event, imageIndex) {
  if (event.target.closest("button")) return;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
  const label = prompt("ระบุชื่อจุดติดตั้ง", `จุดติดตั้ง ${fInstallMarkers.filter(m => m.image_index === imageIndex).length + 1}`);
  if (!label?.trim()) return;
  fInstallMarkers.push({ image_index: imageIndex, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), label: label.trim() });
  drawInstallImgs();
}
function removeInstallImg(index) {
  fInstallImgs.splice(index, 1);
  fInstallMarkers = fInstallMarkers.filter(m => m.image_index !== index).map(m => ({ ...m, image_index: m.image_index > index ? m.image_index - 1 : m.image_index }));
  drawInstallImgs();
}
function addInstallImgUrl() {
  const value = $("#f_install_url").value.trim(), url = safeUrl(value);
  if (!url) { $("#installUpMsg").textContent = "กรุณาใส่ URL รูปภาพที่ขึ้นต้นด้วย https:// หรือ http://"; return; }
  fInstallImgs.push(url); $("#f_install_url").value = ""; $("#installUpMsg").textContent = ""; drawInstallImgs();
}
async function upload(files, target = "part") {
  const c = CONFIG.cloudinary;
  const msg = target === "machine" ? $("#mUpMsg") : target === "install" ? $("#installUpMsg") : $("#upMsg");
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return;
  if (!c.cloudName || !c.uploadPreset) { msg.textContent = "ยังไม่ได้ตั้งค่า Cloudinary cloud name หรือ Upload Preset"; return; }
  let uploaded = 0;
  const failures = [];
  for (const f of selectedFiles) {
    if (!f.type.startsWith("image/") || f.size > 10 * 1024 * 1024) { failures.push(`${f.name}: ต้องเป็นรูปภาพและมีขนาดไม่เกิน 10 MB`); continue; }
    msg.textContent = `กำลังอัปโหลด ${f.name}...`;
    const fd = new FormData(); fd.append("file", f); fd.append("upload_preset", c.uploadPreset); if (c.folder) fd.append("folder", c.folder);
    try {
      const r = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/image/upload`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok || !safeUrl(j.secure_url)) throw new Error(j.error?.message || `Cloudinary ตอบกลับสถานะ ${r.status}`);
      if (target === "machine") {
        machineFormImageUrl = j.secure_url;
        drawMachineImage();
      } else if (target === "install") { fInstallImgs.push(j.secure_url); drawInstallImgs(); } else { fImgs.push(j.secure_url); drawImgs(); }
      uploaded++;
    } catch (e) { failures.push(`${f.name}: ${e.message}`); }
  }
  msg.textContent = failures.length
    ? `${uploaded ? `อัปโหลดสำเร็จ ${uploaded} รูป · ` : ""}อัปโหลดไม่สำเร็จ: ${failures.join(" | ")}`
    : `อัปโหลดสำเร็จ ${uploaded} รูป`;
  msg.classList.toggle("error-text", failures.length > 0);
}
async function uploadFromInput(input, target) {
  try {
    if (target === "machine") {
      machineUploadPending = true;
      const saveButton = $("#mSaveBtn");
      if (saveButton) saveButton.disabled = true;
    } else if (target === "install") {
      pendingInstallUploads++;
      updatePartSaveButton();
    } else {
      pendingPartUploads++;
      updatePartSaveButton();
    }
    await upload(input.files, target);
  } catch (e) {
    const msg = target === "machine" ? $("#mUpMsg") : target === "install" ? $("#installUpMsg") : $("#upMsg");
    msg.textContent = `อัปโหลดไม่สำเร็จ: ${e.message}`;
    msg.classList.add("error-text");
  } finally {
    if (target === "machine") {
      machineUploadPending = false;
      const saveButton = $("#mSaveBtn");
      if (saveButton) saveButton.disabled = false;
    } else if (target === "install") {
      pendingInstallUploads--;
      updatePartSaveButton();
    } else {
      pendingPartUploads--;
      updatePartSaveButton();
    }
    input.value = "";
  }
}
async function savePart(id) {
  const pn = $("#f_pn").value.trim(), cat = $("#f_cat").value;
  if (!pn || !cat) { $("#err").textContent = "กรอก Part No. และเลือกหมวดหมู่"; return; }
  if (pendingPartUploads || pendingInstallUploads) { $("#err").textContent = "รอให้อัปโหลดรูปภาพเสร็จก่อน"; return; }
  const docs = [...document.querySelectorAll(".doc")].map(r => { const [n, u] = r.querySelectorAll("input"); return { name: n.value.trim(), url: u.value.trim() }; }).filter(d => d.url);
  if (docs.some(d => !safeUrl(d.url))) { $("#err").textContent = "URL เอกสารต้องเป็นลิงก์ http:// หรือ https://"; return; }
  const key = id || docId(pn);
  if (parts.some(p => p.id !== id && p.active !== false && (p.id === key || p.part_number === pn))) { $("#err").textContent = "มี Part No. นี้อยู่แล้ว"; return; }
  const specs = {}; document.querySelectorAll(".spec").forEach(r => { const [k, v] = r.querySelectorAll("input"); if (k.value.trim()) specs[k.value.trim()] = v.value.trim(); });
  if (fImgs.some(u => !safeUrl(u)) || fInstallImgs.some(u => !safeUrl(u))) { $("#err").textContent = "มี URL รูปภาพไม่ถูกต้อง กรุณาลบหรือแก้ไขรูปนั้น"; return; }
  if (fInstallMarkers.some(m => !Number.isFinite(m.x) || !Number.isFinite(m.y) || m.x < 0 || m.x > 100 || m.y < 0 || m.y > 100 || !fInstallImgs[m.image_index])) { $("#err").textContent = "พบจุดทำเครื่องหมายที่ไม่ถูกต้อง กรุณาตรวจรูปตำแหน่งติดตั้ง"; return; }
  const substituteIds = [...new Set([...document.querySelectorAll(".f_substitute:checked")].map(x => x.value))]
    .filter(ref => ref !== id && parts.some(x => x.id === ref && x.active !== false));
  const data = {
    part_number: pn, manufacturer_part_number: $("#f_mpn").value.trim(), part_name_th: $("#f_th").value.trim(), part_name_en: $("#f_en").value.trim(), category: cat, brand_vendor: $("#f_br").value.trim(),
    model: $("#f_model").value.trim(), subsystem: $("#f_system").value.trim(), installation_point: $("#f_point").value.trim(),
    departments: [...document.querySelectorAll(".f_part_dept:checked")].map(x => x.value),
    machine_ids: [...document.querySelectorAll(".f_m:checked")].map(x => x.value), specifications: specs, location_rack: $("#f_loc").value.trim(),
    supplier: $("#f_supplier").value.trim(),
    images: fImgs, installation_images: fInstallImgs, installation_markers: fInstallMarkers, substitute_ids: substituteIds,
    documents: docs, remark: $("#f_rm").value.trim(), active: true, updated_at: new Date().toISOString()
  };
  try { await DB.save("spare_parts", key, data); closeDlg(); } catch (e) { $("#err").textContent = "บันทึกไม่สำเร็จ: " + e.message; }
}

/* ============ Machines ============ */
let machineFormEditing = false, machineFormId = null, machineFormImageUrl = "", machineUploadPending = false;
function machinesDlg(edit) {
  machineFormEditing = !!edit;
  machineFormId = edit || null;
  const m = edit ? machines.find(x => x.id === edit) : {};
  if (edit && !m) { setConnection("ไม่พบเครื่องจักรที่ต้องการแก้ไข", true); return; }
  machineFormImageUrl = safeUrl(m.image_url);
  machineUploadPending = false;
  open(`${head("จัดการเครื่องจักร")}<div class="p-4">
  <div class="grid sm:grid-cols-2 gap-x-3">
    <div><label class="lbl">ชื่อเครื่อง *</label><input id="m_name" class="inp" value="${esc(m.name)}"></div>
    <div><label class="lbl">แผนก / ไลน์</label><select id="m_dept" class="inp"><option value="">เลือก</option>${[...new Set([...CONFIG.departments, ...(m.department ? [m.department] : [])])].map(d => `<option value="${esc(d)}" ${d === m.department ? "selected" : ""}>${esc(d)}${!CONFIG.departments.includes(d) ? " (ค่าเดิม)" : ""}</option>`).join("")}</select></div>
    <div><label class="lbl">Station</label><input id="m_station" class="inp" value="${esc(m.station)}" placeholder="เช่น Station 1"></div>
    <div><label class="lbl">ผู้ผลิต</label><input id="m_manufacturer" class="inp" value="${esc(m.manufacturer)}" placeholder="เช่น Siemens"></div>
    <div><label class="lbl">รุ่น</label><input id="m_model" class="inp" value="${esc(m.model)}" placeholder="Model"></div>
    <div><label class="lbl">หมายเลขเครื่อง / Serial No.</label><input id="m_serial" class="inp mono" value="${esc(m.serial_number)}"></div>
  </div>
  <label class="lbl">รูปภาพเครื่องจักร</label><div id="mImagePreview" class="mb-2"></div>
  <button class="btn" type="button" onclick="document.getElementById('mImageInput').click()">อัปโหลดรูปเครื่องจักร</button><input id="mImageInput" type="file" accept="image/*" class="sr-only" onchange="uploadFromInput(this,'machine')">
  <p id="mUpMsg" class="text-sm mt-1" style="color:var(--mute)"></p>
  <label class="lbl">หมายเหตุประจำเครื่อง</label><textarea id="m_remark" class="inp" rows="2">${esc(m.remark)}</textarea>
  <button id="mSaveBtn" class="btn btn-p mt-3" onclick="saveMachine()">${edit ? "บันทึกการแก้ไข" : "เพิ่มเครื่องจักร"}</button><p id="err" class="error-text text-sm mt-2"></p>
  <h3 class="font-bold mt-5 mb-2">เครื่องจักรทั้งหมด (${machines.length})</h3>
  ${machines.map(x => `<div class="flex justify-between items-center border-t py-2" style="border-color:var(--line)"><div><span class="font-semibold">${esc(x.name)}</span>${x.station ? ` · Station ${esc(x.station)}` : ""}<div class="text-xs" style="color:var(--mute)">${esc(x.department)}</div></div><div class="flex gap-2"><button class="btn" onclick="machinesDlg(${jsArg(x.id)})">แก้ไข</button><button class="btn btn-d" onclick="delMachine(${jsArg(x.id)})">ลบ</button></div></div>`).join("") || `<p style="color:var(--mute)">ยังไม่มีเครื่องจักร</p>`}</div>`);
  drawMachineImage();
}
function drawMachineImage() {
  const preview = $("#mImagePreview");
  if (!preview) return;
  const image = safeUrl(machineFormImageUrl);
  preview.innerHTML = image
    ? `<div class="machine-image-editor"><img src="${esc(thumb(image, 640))}" alt="ตัวอย่างรูปเครื่องจักร"><button class="btn btn-d text-sm" type="button" onclick="machineFormImageUrl='';drawMachineImage()">ลบรูป</button></div>`
    : `<div class="machine-photo-placeholder machine-photo-editor-placeholder">ยังไม่มีรูปเครื่องจักร</div>`;
}
async function saveMachine() {
  const name = $("#m_name").value.trim(), department = $("#m_dept").value;
  if (!name) { $("#err").textContent = "กรอกชื่อเครื่องให้ครบ"; return; }
  if (machineUploadPending) { $("#err").textContent = "รอให้อัปโหลดรูปภาพเสร็จก่อน"; return; }
  const id = machineFormId || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const data = {
    name, department, station: $("#m_station").value.trim(), manufacturer: $("#m_manufacturer").value.trim(),
    model: $("#m_model").value.trim(), serial_number: $("#m_serial").value.trim(),
    image_url: safeUrl(machineFormImageUrl), remark: $("#m_remark").value.trim()
  };
  try {
    await DB.save("machines", id, data);
    if (machineFormEditing) {
      machineFormEditing = false;
      machineFormId = null;
      closeDlg();
    } else machinesDlg();
  }
  catch (e) { $("#err").textContent = `บันทึกเครื่องจักรไม่สำเร็จ: ${e.message}`; }
}
async function delMachine(id) {
  const m = machines.find(x => x.id === id); if (!m) { setConnection("ไม่พบเครื่องจักรที่ต้องการลบ", true); return; }
  const used = parts.filter(p => p.active !== false && machineIds(p).includes(m.id)).length;
  if (!confirm(used ? `เครื่องนี้ถูกอ้างอิงโดยอะไหล่ ${used} รายการ การลบจะทำให้รายการเหล่านั้นไม่ผูกกับเครื่องจักรนี้ ต้องการลบ?` : "ลบเครื่องจักรนี้?")) return;
  try { await DB.del("machines", id); machinesDlg(); }
  catch (e) { setConnection(`ลบเครื่องจักรไม่สำเร็จ: ${e.message}`, true); }
}

/* ============ Auth / admin bar ============ */
function adminBar() {
  const el = $("#adminBar");
  if (!admin) {
    const currentUser = auth?.currentUser;
    el.innerHTML = currentUser
      ? `<span class="auth-user" title="${esc(currentUser.email || currentUser.uid)}">เข้าสู่ระบบแล้ว · ไม่มีสิทธิ์แก้ไข</span><button class="btn" style="color:var(--ink)" onclick="logout()">ออกจากระบบ</button>`
      : `<button class="btn" style="color:var(--ink)" onclick="loginDlg()">เข้าสู่ระบบผู้ดูแล</button>`;
    return;
  }
  const email = auth?.currentUser?.email;
  el.innerHTML = `${!CONFIG.firebase ? `<span class="tag">DEMO · เครื่องนี้เท่านั้น</span>` : ""}${email ? `<span class="auth-user" title="บัญชีที่เข้าสู่ระบบ">เข้าสู่ระบบแล้ว · ${esc(email)}</span>` : ""}<button class="btn btn-p" onclick="partForm()">+ เพิ่มอะไหล่</button><button class="btn" style="color:var(--ink)" onclick="machinesDlg()">เครื่องจักร</button>${auth ? `<button class="btn" style="color:var(--ink)" onclick="logout()">ออกจากระบบ</button>` : ""}`;
}
function loginDlg() {
  if (!auth) { showAuthNotice("ระบบเข้าสู่ระบบยังไม่ได้เชื่อมต่อ Firebase Authentication", true); return; }
  const localFileWarning = location.protocol === "file:"
    ? `<p class="notice notice-error rounded-lg p-3 mb-3 text-sm">กำลังเปิดเว็บจากไฟล์ในเครื่อง (file://) ซึ่งอาจทำให้ Firebase Authentication ปฏิเสธการเข้าสู่ระบบ ให้เปิดเว็บผ่าน localhost หรือโดเมนที่เพิ่มไว้ใน Firebase Authentication → Settings → Authorized domains</p>`
    : "";
  open(`${head("เข้าสู่ระบบ Admin")}<form class="p-4" onsubmit="event.preventDefault();login()">${localFileWarning}<label class="lbl">อีเมล</label><input id="l_e" type="email" class="inp" autocomplete="username" required><label class="lbl">รหัสผ่าน</label><input id="l_p" type="password" class="inp" autocomplete="current-password" required>
  <div class="flex gap-2 flex-wrap"><button id="loginButton" class="btn btn-p mt-4" type="submit">เข้าสู่ระบบ</button><button id="resetPasswordButton" class="btn mt-4" type="button" onclick="resetPassword()">ส่งลิงก์ตั้งรหัสผ่านใหม่</button></div><p id="err" class="text-sm mt-2" role="alert" aria-live="polite"></p></form>`);
}
function authErrorMessage(error) {
  const messages = {
    "auth/invalid-email": "รูปแบบอีเมลไม่ถูกต้อง",
    "auth/invalid-credential": "Firebase ไม่ยืนยันบัญชีนี้ ตรวจว่าอีเมลถูกต้อง บัญชีได้รับอนุญาตให้เข้าสู่ระบบ และตั้งรหัสผ่านแล้ว",
    "auth/invalid-login-credentials": "Firebase ไม่ยืนยันบัญชีนี้ ตรวจว่าอีเมลถูกต้อง บัญชีได้รับอนุญาตให้เข้าสู่ระบบ และตั้งรหัสผ่านแล้ว",
    "auth/user-not-found": "ไม่พบบัญชีอีเมลนี้",
    "auth/wrong-password": "รหัสผ่านไม่ถูกต้องสำหรับบัญชีนี้",
    "auth/user-disabled": "บัญชีนี้ถูกปิดใช้งาน",
    "auth/too-many-requests": "พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่",
    "auth/network-request-failed": "เชื่อมต่อ Firebase ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต",
    "auth/operation-not-allowed": "ยังไม่ได้เปิดวิธีเข้าสู่ระบบ Email/Password ใน Firebase Authentication → Sign-in method",
    "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาต: เปิด Firebase Console → Authentication → Settings → Authorized domains แล้วเพิ่มโดเมนที่ใช้ (สำหรับทดสอบให้เปิดเว็บผ่าน localhost ไม่ใช่ file://)",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Firebase API key ไม่ถูกต้องหรือถูกจำกัดการใช้งาน ตรวจค่า apiKey และ API restrictions ใน Google Cloud Console",
    "auth/invalid-api-key": "Firebase API key ไม่ถูกต้อง ตรวจค่า apiKey ใน app.js",
    "auth/configuration-not-found": "ยังไม่ได้ตั้งค่า Firebase Authentication ในโปรเจกต์นี้",
    "auth/account-exists-with-different-credential": "บัญชีนี้มีวิธีเข้าสู่ระบบแบบอื่น ไม่ใช่อีเมลและรหัสผ่าน"
  };
  const code = String(error.code || "").toLowerCase();
  const detail = messages[code] || error.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
  return `${detail}${code ? ` [${code}]` : ""}`;
}
async function resetPassword() {
  const email = $("#l_e").value.trim();
  const error = $("#err"), button = $("#resetPasswordButton");
  error.classList.remove("error-text");
  error.style.color = "var(--mute)";
  if (!email) {
    error.classList.add("error-text");
    error.textContent = "กรอกอีเมลบัญชีผู้ดูแลก่อน แล้วกดส่งลิงก์ตั้งรหัสผ่านใหม่";
    $("#l_e").focus();
    return;
  }
  button.disabled = true;
  button.textContent = "กำลังส่ง...";
  try {
    await auth.sendPasswordResetEmail(email);
    error.textContent = `ส่งคำขอรีเซ็ตรหัสผ่านแล้ว หาก ${email} เป็นบัญชีในโปรเจกต์นี้ ระบบจะส่งอีเมลพร้อมลิงก์ให้ตรวจ Inbox และ Spam`;
  } catch (e) {
    error.classList.add("error-text");
    error.textContent = authErrorMessage(e);
  } finally {
    button.disabled = false;
    button.textContent = "ส่งลิงก์ตั้งรหัสผ่านใหม่";
  }
}
async function login() {
  const button = $("#loginButton"), error = $("#err");
  error.classList.add("error-text");
  error.style.color = "";
  button.disabled = true;
  button.textContent = "กำลังเข้าสู่ระบบ...";
  error.textContent = "";
  try {
    const credential = await auth.signInWithEmailAndPassword($("#l_e").value.trim(), $("#l_p").value);
    closeDlg();
    if (CONFIG.adminUids.includes(credential.user.uid)) {
      showAuthNotice(`เข้าสู่ระบบผู้ดูแลสำเร็จ${credential.user.email ? ` · ${credential.user.email}` : ""}`);
    } else {
      showAuthNotice(`เข้าสู่ระบบสำเร็จ แต่บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูล (UID: ${credential.user.uid})`, true);
    }
  } catch (e) {
    error.textContent = authErrorMessage(e);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = "เข้าสู่ระบบ";
    }
  }
}
async function logout() {
  try {
    await auth.signOut();
    showAuthNotice("ออกจากระบบแล้ว สิทธิ์แก้ไขข้อมูลถูกปิด");
  } catch (e) { showAuthNotice(`ออกจากระบบไม่สำเร็จ: ${e.message}`, true); }
}
function banner() {
  if (!CONFIG.firebase && localDataError) {
    $("#modeBanner").innerHTML = `<div class="notice notice-error plate rounded-lg p-3 mb-4 text-sm" role="alert">${esc(localDataError)} ข้อมูลเดิมยังไม่ถูกเขียนทับ</div>`;
    return;
  }
  $("#modeBanner").innerHTML = CONFIG.firebase
    ? ""
    : `<div class="notice plate rounded-lg p-3 mb-4 text-sm" role="note"><strong>โหมดทดลอง:</strong> ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น หากต้องการให้ช่างและฝ่ายซ่อมบำรุงใช้ทะเบียนเครื่องจักรร่วมกัน ให้ตั้ง Firebase พร้อม Authentication และ Security Rules</div>`;
}

/* ============ Sample data (โหมดทดลองเท่านั้น) ============ */
async function loadSample() {
  const machine1 = "sample-machine-1", machine2 = "sample-machine-2";
  await DB.save("machines", machine1, { name: "เครื่องบรรจุอัตโนมัติ Line 1", department: "GA", station: "Station 1" });
  await DB.save("machines", machine2, { name: "เครื่องอัดขึ้นรูป 2", department: "Welding", station: "Station 2" });
  await DB.save("spare_parts", "BRG-6204-2RS", { part_number: "BRG-6204-2RS", part_name_th: "ตลับลูกปืนเม็ดกลม", part_name_en: "Deep Groove Ball Bearing", category: "Bearing", brand_vendor: "SKF", supplier: "ตัวอย่างผู้จำหน่าย", machine_ids: [machine1, machine2], departments: ["GA", "Welding"], specifications: { size: "20x47x14 mm", material: "Chrome steel" }, location_rack: "Rack A-02-03", images: [], documents: [], remark: "", active: true });
  await DB.save("spare_parts", "SV-VF3130", { part_number: "SV-VF3130", part_name_th: "โซลินอยด์วาล์ว", part_name_en: "Solenoid Valve", category: "Pneumatics", brand_vendor: "SMC", supplier: "ตัวอย่างผู้จำหน่าย", machine_ids: [machine1], departments: ["GA"], specifications: { voltage: "24VDC", pressure: "0.15-0.7 MPa", thread_size: "Rc1/8" }, location_rack: "Rack B-01-01", images: [], documents: [], remark: "", active: true });
}

/* ============ Boot ============ */
applyTheme(preferredTheme());
$("#themeToggle").addEventListener("click", toggleTheme);
document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { view = b.dataset.view; render(); });
$("#q").addEventListener("input", render);
["#fDept", "#fMach", "#fCat", "#fSystem"].forEach(s => $(s).addEventListener("change", render));
$("#exportCsv").addEventListener("click", exportCsv);
$("#clearFilters").addEventListener("click", () => {
  $("#q").value = "";
  ["#fDept", "#fMach", "#fCat", "#fSystem"].forEach(s => { $(s).value = ""; });
  render();
});
DB.watch("machines", a => {
  machines = a.map(raw => {
    const { id, code, location, ...machine } = raw;
    if (code) legacyMachineIds.set(code, id);
    return { ...machine, image_url: safeUrl(machine.image_url), id, station: machine.station || "" };
  }).sort((x, y) => x.name.localeCompare(y.name));
  refreshFilters(); render();
}, e => {
  setConnection(`โหลดข้อมูลเครื่องจักรไม่สำเร็จ: ${e.message}`, true);
});
DB.watch("spare_parts", a => {
  parts = a; refreshFilters(); render(); openFromHash();
}, e => {
  setConnection(`โหลดข้อมูลอะไหล่ไม่สำเร็จ: ${e.message}`, true);
});
function openFromHash() {
  const m = location.hash.match(/^#part=(.+)/);
  if (m && !$("#dlg").open) {
    try { detail(decodeURIComponent(m[1])); }
    catch (e) { setConnection(`เปิดรายการจากลิงก์ไม่สำเร็จ: ${e.message}`, true); }
  }
}
if (auth) auth.onAuthStateChanged(u => {
  admin = !!u && CONFIG.adminUids.includes(u.uid);
  adminBar();
  render();
  if (u && admin) showAuthNotice(`เข้าสู่ระบบผู้ดูแลแล้ว · ${u.email || u.uid}`);
  else if (u) showAuthNotice(`เข้าสู่ระบบแล้ว แต่ไม่มีสิทธิ์แก้ไขข้อมูล · UID: ${u.uid}`, true);
}, e => {
  admin = false; adminBar(); setConnection(`ตรวจสอบสิทธิ์ไม่สำเร็จ: ${e.message}`, true);
});
banner(); adminBar(); refreshFilters(); render();
setConnection(CONFIG.firebase ? "กำลังเชื่อมต่อฐานข้อมูล..." : "ข้อมูลทดลองในเบราว์เซอร์นี้");
