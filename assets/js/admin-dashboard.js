import {
  requireAdminSession,
  showSidebarUser,
  wireLogoutButton,
} from "./authGuard.js";
import { statusBadgeClass, statusLabel } from "./statusUtils.js";
import { supabase } from "./supabaseClient.js";

const STATUSES = ["pending", "in_progress", "resolved"];
const STATUS_VAR = {
  pending: "var(--st-pending)",
  in_progress: "var(--st-progress)",
  resolved: "var(--st-resolved)",
};
const DAY_MS = 24 * 60 * 60 * 1000;
const SVG_NS = "http://www.w3.org/2000/svg";
const tooltip = document.getElementById("dash-tooltip");
const trendEl = document.getElementById("trend-chart");

let allTickets = [];
let allSystems = [];
let rangeDays = 30;

// ---------- helpers ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const numberFmt = new Intl.NumberFormat("th-TH");
const fmt = (n) => numberFmt.format(n);

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function shortDate(date) {
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function pct(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

// Round an axis max up to a clean number with a whole-number step
function niceScale(max, tickCount = 4) {
  if (max <= 0) return { max: tickCount, step: 1 };
  const raw = max / tickCount;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10]
    .map((m) => Math.max(1, m * mag))
    .find((s) => s >= raw);
  return { max: step * Math.ceil(max / step), step };
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

// ---------- tooltip ----------
function showTooltip(html, clientX, clientY) {
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  const pad = 12;
  const { width, height } = tooltip.getBoundingClientRect();
  let x = clientX + pad;
  let y = clientY - height - pad;
  if (x + width > window.innerWidth - 8) x = clientX - width - pad;
  if (y < 8) y = clientY + pad;
  tooltip.style.left = `${Math.max(8, x)}px`;
  tooltip.style.top = `${y}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

// ---------- range ----------
function rangeStart(days) {
  if (!days) return null;
  return new Date(startOfDay(Date.now()).getTime() - (days - 1) * DAY_MS);
}

function ticketsInRange(days) {
  const start = rangeStart(days);
  return start
    ? allTickets.filter((t) => new Date(t.created_at) >= start)
    : allTickets;
}

// ---------- KPIs ----------
function renderKpis(tickets) {
  const counts = { pending: 0, in_progress: 0, resolved: 0 };
  tickets.forEach((t) => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });
  const total = tickets.length;

  document.getElementById("kpi-total").textContent = fmt(total);
  document.getElementById("kpi-pending").textContent = fmt(counts.pending);
  document.getElementById("kpi-progress").textContent = fmt(counts.in_progress);
  document.getElementById("kpi-resolved").textContent = fmt(counts.resolved);
  document.getElementById("kpi-pending-share").textContent =
    `${pct(counts.pending, total)}% ของทั้งหมด`;
  document.getElementById("kpi-progress-share").textContent =
    `${pct(counts.in_progress, total)}% ของทั้งหมด`;
  document.getElementById("kpi-resolved-share").textContent =
    `${pct(counts.resolved, total)}% ของทั้งหมด`;

  const rate = pct(counts.resolved, total);
  document.getElementById("kpi-rate").textContent = `${rate}%`;
  document.getElementById("kpi-rate-bar").style.width = `${rate}%`;

  // Delta vs the previous period of the same length
  const deltaEl = document.getElementById("kpi-delta");
  if (!rangeDays) {
    deltaEl.textContent = "ตั้งแต่เริ่มใช้งานระบบ";
    deltaEl.dataset.dir = "flat";
    return;
  }
  const start = rangeStart(rangeDays).getTime();
  const prevStart = start - rangeDays * DAY_MS;
  const prev = allTickets.filter((t) => {
    const ts = new Date(t.created_at).getTime();
    return ts >= prevStart && ts < start;
  }).length;
  const diff = total - prev;
  const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
  const pctText = prev
    ? ` (${diff > 0 ? "+" : ""}${Math.round((diff / prev) * 100)}%)`
    : "";
  deltaEl.textContent = `${arrow} ${diff > 0 ? "+" : ""}${fmt(diff)}${pctText} เทียบกับ ${rangeDays} วันก่อนหน้า`;
  deltaEl.dataset.dir = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
}

// ---------- trend line ----------
function buildSeries(tickets) {
  const today = startOfDay(Date.now());
  let start = rangeStart(rangeDays);
  if (!start) {
    const first = tickets.reduce(
      (min, t) => Math.min(min, new Date(t.created_at).getTime()),
      today.getTime(),
    );
    start = startOfDay(first);
  }
  const spanDays = Math.round((today - start) / DAY_MS) + 1;
  const bucketDays = spanDays > 120 ? 7 : 1;

  const counts = new Map();
  tickets.forEach((t) => {
    const k = dayKey(t.created_at);
    counts.set(k, (counts.get(k) || 0) + 1);
  });

  const points = [];
  for (let i = 0; i < spanDays; i += bucketDays) {
    const from = new Date(start.getTime() + i * DAY_MS);
    let count = 0;
    for (let j = 0; j < bucketDays && i + j < spanDays; j++) {
      count += counts.get(dayKey(new Date(from.getTime() + j * DAY_MS))) || 0;
    }
    const to = new Date(
      from.getTime() + (Math.min(bucketDays, spanDays - i) - 1) * DAY_MS,
    );
    points.push({ from, to, count });
  }
  return { points, bucketDays };
}

function renderTrend(tickets) {
  const { points, bucketDays } = buildSeries(tickets);
  document.getElementById("trend-sub").textContent =
    bucketDays === 1 ? "จำนวนต่อวัน" : "จำนวนต่อสัปดาห์";

  trendEl.innerHTML = "";
  const width = trendEl.clientWidth;
  const height = trendEl.clientHeight || 240;
  if (!width) return;

  const m = { top: 16, right: 44, bottom: 30, left: 36 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const { max, step } = niceScale(Math.max(...points.map((p) => p.count), 0));
  const x = (i) =>
    m.left + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v) => m.top + h - (v / max) * h;

  const svg = svgEl("svg", {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
  });

  // grid + y ticks
  for (let v = 0; v <= max; v += step) {
    svg.appendChild(
      svgEl("line", {
        x1: m.left,
        x2: m.left + w,
        y1: y(v),
        y2: y(v),
        class: v === 0 ? "dash-axis" : "dash-grid",
      }),
    );
    const label = svgEl("text", {
      x: m.left - 8,
      y: y(v) + 4,
      "text-anchor": "end",
      class: "dash-tick",
    });
    label.textContent = fmt(v);
    svg.appendChild(label);
  }

  // x ticks: ~5 evenly spaced dates
  const xTickCount = Math.min(points.length, width < 480 ? 3 : 5);
  for (let k = 0; k < xTickCount; k++) {
    const i =
      xTickCount === 1
        ? 0
        : Math.round((k / (xTickCount - 1)) * (points.length - 1));
    const anchor = k === 0 ? "start" : k === xTickCount - 1 ? "end" : "middle";
    const label = svgEl("text", {
      x: x(i),
      y: height - 8,
      "text-anchor": anchor,
      class: "dash-tick",
    });
    label.textContent = shortDate(points[i].from);
    svg.appendChild(label);
  }

  // area wash + line
  const linePath = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.count)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  svg.appendChild(svgEl("path", { d: areaPath, class: "dash-area" }));
  svg.appendChild(svgEl("path", { d: linePath, class: "dash-linepath" }));

  // end marker + direct label on the latest value
  const last = points.length - 1;
  svg.appendChild(
    svgEl("circle", {
      cx: x(last),
      cy: y(points[last].count),
      r: 4,
      class: "dash-marker",
    }),
  );
  const endLabel = svgEl("text", {
    x: x(last) + 10,
    y: y(points[last].count) + 4,
    class: "dash-endlabel",
  });
  endLabel.textContent = fmt(points[last].count);
  svg.appendChild(endLabel);

  // hover layer: crosshair + dot + tooltip
  const cross = svgEl("line", {
    y1: m.top,
    y2: m.top + h,
    class: "dash-crosshair",
    visibility: "hidden",
  });
  const hoverDot = svgEl("circle", {
    r: 5,
    class: "dash-marker",
    visibility: "hidden",
  });
  const hit = svgEl("rect", {
    x: m.left,
    y: 0,
    width: w,
    height,
    fill: "transparent",
  });
  svg.append(cross, hoverDot, hit);

  const onMove = (e) => {
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i =
      points.length === 1
        ? 0
        : Math.max(0, Math.min(last, Math.round(((px - m.left) / w) * last)));
    const p = points[i];
    cross.setAttribute("x1", x(i));
    cross.setAttribute("x2", x(i));
    hoverDot.setAttribute("cx", x(i));
    hoverDot.setAttribute("cy", y(p.count));
    cross.setAttribute("visibility", "visible");
    hoverDot.setAttribute("visibility", "visible");
    const dateText =
      bucketDays === 1
        ? shortDate(p.from)
        : `${shortDate(p.from)} – ${shortDate(p.to)}`;
    showTooltip(
      `<span class="dash-tt-muted">${dateText}</span><strong>${fmt(p.count)} เรื่อง</strong>`,
      e.clientX,
      e.clientY,
    );
  };
  const onLeave = () => {
    cross.setAttribute("visibility", "hidden");
    hoverDot.setAttribute("visibility", "hidden");
    hideTooltip();
  };
  hit.addEventListener("pointermove", onMove);
  hit.addEventListener("pointerdown", onMove);
  hit.addEventListener("pointerleave", onLeave);

  trendEl.appendChild(svg);
}

// ---------- by system (stacked bars) ----------
function renderSystemBars(tickets) {
  const container = document.getElementById("system-bars");
  // Inactive systems only show up when they have tickets in the range
  const bySystem = new Map(
    allSystems.filter((s) => s.is_active).map((s) => [
      s.id,
      { name: s.name, pending: 0, in_progress: 0, resolved: 0, total: 0 },
    ]),
  );
  tickets.forEach((t) => {
    if (!bySystem.has(t.system_id)) {
      bySystem.set(t.system_id, {
        name: t.systems?.name || "(ไม่ทราบระบบ)",
        pending: 0,
        in_progress: 0,
        resolved: 0,
        total: 0,
      });
    }
    const row = bySystem.get(t.system_id);
    row[t.status] += 1;
    row.total += 1;
  });

  const rows = [...bySystem.values()].sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...rows.map((r) => r.total), 0);
  container.innerHTML = "";

  if (!rows.length) {
    container.innerHTML = '<p class="dash-empty">ยังไม่มีระบบ</p>';
    return;
  }

  rows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "dash-bar-row";
    el.innerHTML = `
      <span class="dash-bar-name" title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</span>
      <div class="dash-bar-track">
        <div class="dash-bar" style="width: ${maxTotal ? (row.total / maxTotal) * 100 : 0}%;"></div>
        <span class="dash-bar-value">${fmt(row.total)}</span>
      </div>
    `;
    const bar = el.querySelector(".dash-bar");
    STATUSES.forEach((status) => {
      if (!row[status]) return;
      const seg = document.createElement("span");
      seg.className = "dash-seg";
      seg.style.flexGrow = row[status];
      seg.style.background = STATUS_VAR[status];
      const html =
        `<span class="dash-tt-muted">${escapeHtml(row.name)}</span>` +
        `<span class="dash-tt-row"><span class="dash-dot" style="background: ${STATUS_VAR[status]};"></span>${statusLabel(status)}</span>` +
        `<strong>${fmt(row[status])} เรื่อง · ${pct(row[status], row.total)}%</strong>`;
      seg.addEventListener("pointermove", (e) =>
        showTooltip(html, e.clientX, e.clientY),
      );
      seg.addEventListener("pointerdown", (e) =>
        showTooltip(html, e.clientX, e.clientY),
      );
      seg.addEventListener("pointerleave", hideTooltip);
      bar.appendChild(seg);
    });
    container.appendChild(el);
  });
}

// ---------- oldest open tickets ----------
function renderAging() {
  const list = document.getElementById("aging-list");
  const open = allTickets
    .filter((t) => t.status !== "resolved")
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(0, 6);

  if (!open.length) {
    list.innerHTML =
      '<li class="dash-empty">ไม่มีเรื่องค้าง แก้ไขครบทุกเรื่องแล้ว</li>';
    return;
  }

  const today = startOfDay(Date.now());
  list.innerHTML = open
    .map((t) => {
      const days = Math.round((today - startOfDay(t.created_at)) / DAY_MS);
      const age = days === 0 ? "วันนี้" : `${fmt(days)} วัน`;
      return `
      <li class="dash-aging-item">
        <div class="dash-aging-age" data-level="${days >= 7 ? "high" : days >= 3 ? "mid" : "low"}">
          <strong>${age}</strong>
        </div>
        <div class="dash-aging-body">
          <p class="dash-aging-system">${escapeHtml(t.systems?.name || "(ไม่ทราบระบบ)")}</p>
          <p class="dash-aging-msg" title="${escapeHtml(t.message)}">${escapeHtml(t.message)}</p>
        </div>
        <span class="badge ${statusBadgeClass(t.status)}"><span class="badge-dot"></span>${statusLabel(t.status)}</span>
      </li>`;
    })
    .join("");
}

// ---------- wiring ----------
function renderRange() {
  const tickets = ticketsInRange(rangeDays);
  renderKpis(tickets);
  renderTrend(tickets);
  renderSystemBars(tickets);
}

function wireRange() {
  const buttons = document.querySelectorAll(".dash-range-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      rangeDays = Number(btn.dataset.days);
      buttons.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
      renderRange();
    });
  });
}

async function loadData() {
  const [ticketsRes, systemsRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, message, status, created_at, system_id, systems(name)"),
    supabase
      .from("systems")
      .select("id, name, is_active")
      .order("created_at", { ascending: true }),
  ]);

  if (ticketsRes.error || systemsRes.error) {
    document.getElementById("dash-updated").textContent =
      "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่";
    console.error(ticketsRes.error || systemsRes.error);
    return;
  }

  allTickets = ticketsRes.data || [];
  allSystems = systemsRes.data || [];
  document.getElementById("dash-updated").textContent =
    `อัปเดตล่าสุด ${new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}`;

  renderRange();
  renderAging();

  let lastWidth = trendEl.clientWidth;
  new ResizeObserver(() => {
    if (trendEl.clientWidth === lastWidth) return;
    lastWidth = trendEl.clientWidth;
    renderTrend(ticketsInRange(rangeDays));
  }).observe(trendEl);
}

wireLogoutButton(document.getElementById("logout-btn"));
wireRange();

async function init() {
  const session = await requireAdminSession();
  if (!session) return;
  showSidebarUser(session);
  loadData();
}

init();
