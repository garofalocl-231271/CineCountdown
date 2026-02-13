/*if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("SW registrato"))
    .catch(err => console.error("SW errore", err));
}
*/

// --- VARIABILI GLOBALI ---
let notificationsEnabled = false;         // flag globale
let notifiedSessions = new Set();         // sessioni già notificate
let scheduledNotificationKey = null;      // film imminente già schedulato

/* =======================
   CONFIG
======================= */
const PUBBLICITA_MINUTI = 20;
const GIORNI_VISIBILI = 7;

const filmDurations = {
  "Avatar": 197,
  "Dune": 155,
  "Matrix": 136,
  "Buen Camino": 90
};

function populateMultiplexSelect() {
  multiplexSelect.innerHTML = "";

  CinemaAdapter.getMultiplexList().forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.label;
    opt.textContent = m.label;
    multiplexSelect.appendChild(opt);
  });
}


function getCurrentContext() {
  const selectedCityOption = citySelect.selectedOptions[0];
  if (!selectedCityOption) return null;

  const cityId = selectedCityOption.dataset.id;
  const multiplexId =
    CinemaAdapter.getMultiplexIdFromUI(multiplexSelect.value);

  if (!cityId || !multiplexId) return null;

  return { multiplexId, cityId };
}

function ensureDefaultCinema() {
  const saved = getDefaultCinema();

  // Se già esiste, ok
  if (saved) return;

  // Altrimenti prendo prima option multiplex + città
  const firstMultiplexId =
    Object.keys(window.MockSource.programmazione)[0];

  const firstCityId =
    Object.keys(
      window.MockSource.programmazione[firstMultiplexId]
    )[0];

  localStorage.setItem(
    "defaultCinema",
    JSON.stringify({
      multiplexId: firstMultiplexId,
      cityId: firstCityId
    })
  );
}
/* =======================
   STORAGE
======================= */
const getFavs = () => JSON.parse(localStorage.getItem("favs") || "[]");
const saveFavs = f => localStorage.setItem("favs", JSON.stringify(f));
const getCityFav = () => localStorage.getItem("favCity");
const setCityFav = c => localStorage.setItem("favCity", c);
const cityCache = new Map();



/* ================= STATE ================= */
let activeDay = null;
let currentView = "programmazione";

function syncCitySelectByMultiplex(multiplexId) {
  citySelect.innerHTML = "";

  const cities =
    CinemaAdapter.getCitiesByMultiplex(multiplexId);

  if (!cities.length) {
    citySelect.innerHTML =
      `<option>Nessuna città disponibile</option>`;
    return;
  }

  cities.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.label;      // UI
    opt.textContent = c.label;
    opt.dataset.id = c.id;   // 🔑 ID nascosto
    citySelect.appendChild(opt);
  });

  const saved = getDefaultCinema();

  if (
    saved &&
    saved.multiplexId === multiplexId
  ) {
    const match = cities.find(c => c.id === saved.cityId);
    if (match) {
      citySelect.value = match.label;
      updateCitySelectStar();
      return;
    }
  }

  citySelect.selectedIndex = 0;
  updateCitySelectStar();
}


/* =======================
   DATE UTILS
======================= */
function startSummaryClock() {
  const now = new Date();
  const msToNextMinute =
    (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  // primo sync esatto
  setTimeout(() => {
    updateSummaryStatuses();

    // poi ogni minuto preciso
    setInterval(updateSummaryStatuses, 60000);
  }, msToNextMinute);
}

function formatGroupDate(d) {
  const date = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = (date - today) / 86400000;

  if (diff === 0) return "OGGI";
  if (diff === 1) return "DOMANI";
  return date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + minutes, 0, 0);
  return d.toTimeString().slice(0, 5);
}

function filmDurationLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function getSessionDateTime(day, time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

function formatCountdown(ms) {
  if (ms <= 0) return "INIZIATO";
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function sortFavoritesByDateTime(favs) {
  return favs.sort((a, b) => {
    return (
      getSessionDateTime(a.day, a.time) -
      getSessionDateTime(b.day, b.time)
    );
  });
}

function setAppHeight() {
  document.documentElement.style.setProperty(
    "--app-height",
    `${window.innerHeight}px`
  );
}

window.addEventListener("resize", setAppHeight);
setAppHeight();

/* =======================
   DAYS
======================= */
const daysWrapper = document.querySelector(".filter-days-wrapper");

function hideDays() {
  daysWrapper.style.opacity = 0;
  setTimeout(() => daysWrapper.style.display = "none", 1);
}

function showDays() {
  daysWrapper.style.display = "block";
  requestAnimationFrame(() => daysWrapper.style.opacity = 1);
}

function generateDays() {
  daysList.innerHTML = "";
  activeDay = null;

  const ctx = getCurrentContext();
  if (!ctx) return;

  const data = CinemaAdapter.getProgrammazioneByCityId(ctx.multiplexId, ctx.cityId);
  const days = Object.keys(data);

  if (!days.length) {
    daysList.innerHTML = "<li>Nessuna data disponibile</li>";
    programmazione.innerHTML = "<p>Nessuna programmazione.</p>";
    return;
  }

  /* ===== TUTTI I GIORNI ===== */
  const allLi = document.createElement("li");
  const allBtn = document.createElement("button");
  allBtn.className = "filter-data-list__button";
  allBtn.textContent = "Tutti i giorni";

  allBtn.onclick = () => {
    document.querySelectorAll(".filter-data-list__button")
      .forEach(b => b.classList.remove("active"));
    allBtn.classList.add("active");
    activeDay = "ALL";
    renderProgrammazione();
    renderSummary();
  };

  allLi.appendChild(allBtn);
  daysList.appendChild(allLi);

  /* ===== GIORNI SINGOLI ===== */
days.forEach((day, i) => {
  const btn = document.createElement("button");
  btn.className = "filter-data-list__button";
  btn.textContent = formatGroupDate(day);

  const dayData = data[day];
  const isClosed = !dayData || Object.keys(dayData).length === 0;

  if (isClosed) {
    btn.classList.add("disabled");
  } else {
    btn.onclick = () => {
      document.querySelectorAll(".filter-data-list__button")
        .forEach(b => b.classList.remove("active"));

      btn.classList.add("active");
      activeDay = day;
      renderProgrammazione();
      renderSummary();
    };
  }

  const li = document.createElement("li");
  li.appendChild(btn);
  daysList.appendChild(li);

  // primo giorno valido diventa attivo
  if (!isClosed && activeDay === null) {
    btn.classList.add("active");
    activeDay = day;
  }
});

}

/* =======================
   PROGRAMMAZIONE
======================= */
function sortTimes(times) {
  return [...times].sort((a, b) => {
    const [h1, m1] = a.split(":").map(Number);
    const [h2, m2] = b.split(":").map(Number);
    return h1 * 60 + m1 - (h2 * 60 + m2);
  });
}

function renderProgrammazione() {
  programmazione.innerHTML = "";

  const ctx = getCurrentContext();
  if (!ctx) return;

  const { multiplexId, cityId } = ctx;

  const cityData =
    CinemaAdapter.getProgrammazioneByCityId(
      multiplexId,
      cityId
    );

  if (!activeDay) return;

  const daysToRender =
  activeDay === "ALL"
    ? Object.keys(cityData).filter(day => {
        const d = cityData[day];
        return d && Object.keys(d).length > 0;
      })
    : [activeDay];


  daysToRender.forEach(day => {
    const data = cityData[day];
    if (!data) return;

    const dayTitle = document.createElement("div");
    dayTitle.className = "sessions__group-date";
    dayTitle.textContent = formatGroupDate(day);
    programmazione.appendChild(dayTitle);

    Object.entries(data).forEach(([film, times]) => {

      const dur = filmDurations[film] || 0;

      const filmDiv = document.createElement("div");
      filmDiv.className = "film";
      filmDiv.innerHTML =
        `🎬 ${film} • ${filmDurationLabel(dur)}`;

      const ul = document.createElement("ul");
      ul.className = "sessions__list";

      sortTimes(times).forEach(start => {

        const end =
          addMinutes(start, dur + PUBBLICITA_MINUTI);

        const li = document.createElement("li");
        li.className = "sessions__list__item";
        li.dataset.day = day;

        li.innerHTML = `
          <span class="session-time__start">${start}</span>
          <span class="session-time__end">${end}</span>
        `;

        const active = getFavs().some(f =>
          f.multiplexId === multiplexId &&
          f.cityId === cityId &&
          f.day === day &&
          f.film === film &&
          f.time === start
        );

        if (active) li.classList.add("active");

        li.onclick = () =>
          toggleTime(film, start, li);

        ul.appendChild(li);
      });

      filmDiv.appendChild(ul);
      programmazione.appendChild(filmDiv);
    });
  });
}


/* =======================
   PREFERITI
======================= */
let preferitiRendered = false;

function renderPreferitiSafe() {
  if (preferitiRendered) return;
  renderPreferiti();
  preferitiRendered = true;
}

function renderPreferiti() {
  const list = document.getElementById("preferitiList");
  list.innerHTML = "";

  const selectedCityOption = citySelect.selectedOptions[0];
  if (!selectedCityOption) return;

  const cityId = selectedCityOption.dataset.id;
  const multiplexId =
    CinemaAdapter.getMultiplexIdFromUI(multiplexSelect.value);

  const favs = sortFavoritesByDateTime(
    getFavs().filter(f =>
      f.multiplexId === multiplexId &&
      f.cityId === cityId
    )
  ).slice(0, 3);

  if (!favs.length) {
    list.innerHTML = "⭐ Nessun preferito";
    return;
  }

  favs.forEach(f => {
    const div = document.createElement("div");
    div.className = "sessions__list__item preferito-item";

    div.innerHTML = `
      <div class="preferito-header">
        <strong>${formatGroupDate(f.day)}</strong>
        <button class="remove-single">🗑️</button>
      </div>

      🎬 ${f.film} – ${f.time}<br>
      ⏱️<span class="countdown"
        data-day="${f.day}"
        data-time="${f.time}"
        data-film="${f.film}">
      </span>
    `;

    div.querySelector(".remove-single").onclick = () => {
      removeFavoriteByData(
        f.multiplexId,
        f.cityId,
        f.day,
        f.film,
        f.time
      );
    };

    list.appendChild(div);
  });

  syncAllCountdownStates();
}

function setActiveView(view) {
  btnProgrammazione.classList.toggle("active", view === "programmazione");
  btnPreferiti.classList.toggle("active", view === "preferiti");
}

function updateFavoritesCounter() {
  const countDisplay = document.getElementById("count-item");
  if (!countDisplay) return;

  const ctx = getCurrentContext();
  if (!ctx) {
    countDisplay.textContent = "0";
    return;
  }

  const { multiplexId, cityId } = ctx;

  const count = getFavs().filter(f =>
    f.multiplexId === multiplexId &&
    f.cityId === cityId
  ).length;

  countDisplay.textContent = ` • ${count}`;
  countDisplay.classList.toggle("visible", count > 0);
  countDisplay.classList.add("pop");
  setTimeout(() => countDisplay.classList.remove("pop"), 200);


}

/* =======================
   TOGGLE
======================= */
function toggleTime(film, time, el) {
  const selectedCityOption = citySelect.selectedOptions[0];
  if (!selectedCityOption) return;

  const cityId = selectedCityOption.dataset.id;
  const multiplexLabel = multiplexSelect.value;
  const multiplexId =
    CinemaAdapter.getMultiplexIdFromUI(multiplexLabel);

  const day = el.dataset.day;

  let favs = getFavs();

  const idx = favs.findIndex(f =>
    f.multiplexId === multiplexId &&
    f.cityId === cityId &&
    f.day === day &&
    f.film === film &&
    f.time === time
  );

  // ➕ AGGIUNTA
  if (idx === -1) {

    const cityFavsCount = favs.filter(f =>
      f.multiplexId === multiplexId &&
      f.cityId === cityId
    ).length;

    if (cityFavsCount >= 3) {
      showToast("⏱️ Max 3 orari per questa città", 2500);
      return;
    }

    favs.push({
      multiplexId,
      cityId,
      day,
      film,
      time
    });

    el.classList.add("active");
  }
  // ➖ RIMOZIONE
  else {
    favs.splice(idx, 1);
    el.classList.remove("active");
  }

  saveFavs(favs);

  renderSummary();
  renderPreferiti();
  updateClearButtons();
  updateFavoritesCounter();
}


/* =======================
   SUMMARY
======================= */
function renderSummary() {
  const selectedCityOption = citySelect.selectedOptions[0];
  if (!selectedCityOption) return;

  const cityId = selectedCityOption.dataset.id;
  const multiplexId =
    CinemaAdapter.getMultiplexIdFromUI(multiplexSelect.value);

  const favs = sortFavoritesByDateTime(
    getFavs().filter(f =>
      f.multiplexId === multiplexId &&
      f.cityId === cityId
    )
  ).slice(0, 3);

  programSummary.innerHTML = favs.length
    ? favs.map(f => `
      <div class="summary-item">
        <span class="summary-label">
          ${formatGroupDate(f.day)} • ${f.film} ${f.time}
        </span>

        <div class="summary-meta">
          <small
            class="summary-status"
            data-day="${f.day}"
            data-time="${f.time}"
            data-film="${f.film}">
          </small>

          <button
            class="summary-remove"
            data-multiplex="${f.multiplexId}"
            data-city="${f.cityId}"
            data-day="${f.day}"
            data-film="${f.film}"
            data-time="${f.time}">
            🗑️
          </button>
        </div>
      </div>
    `).join("")
    : "Nessun orario selezionato";

  updateSummaryStatuses();
}


programSummary.addEventListener("click", e => {
  const btn = e.target.closest(".summary-remove");
  if (!btn) return;

  const {
    multiplex,
    city,
    day,
    film,
    time
  } = btn.dataset;

  removeFavoriteByData(
    multiplex,
    city,
    day,
    film,
    time
  );
});


function removeFavoriteByData(
  multiplexId,
  cityId,
  day,
  film,
  time
) {
  let favs = getFavs();

  favs = favs.filter(f =>
    !(
      f.multiplexId === multiplexId &&
      f.cityId === cityId &&
      f.day === day &&
      f.film === film &&
      f.time === time
    )
  );

  saveFavs(favs);

  renderSummary();
  renderPreferiti();
  renderProgrammazione();
  updateClearButtons();
  syncAllCountdownStates();
  updateFavoritesCounter();
  scheduledNotificationKey = null;
}


function syncAllCountdownStates() {
  document.querySelectorAll(".countdown").forEach(el => {
    const { day, time, film } = el.dataset;
    const s = getSessionStatus(day, time, film);
    syncSessionVisualState(el, s);
  });
}

function updateSummaryStatuses() {
  document.querySelectorAll(".summary-status").forEach(el => {
    const { day, time, film } = el.dataset;
    const s = getSummaryStatus(day, time, film);

    el.textContent = s.text;

    el.classList.remove(
      "status-upcoming",
      "status-live",
      "status-ended"
    );
    el.classList.add(`status-${s.state}`);
  });
}

function formatMinutesOnly(ms) {
  if (ms <= 0) return "00:00";

  const totalMinutes = Math.ceil(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    : `${m} min`;
}

function getSummaryStatus(day, time, film) {
  const s = getSessionStatus(day, time, film);

  if (s.state === "upcoming") {
    return {
      state: "upcoming",
      text: `⏳ Inizia tra ${formatMinutesOnly(s.diffStart)}`
    };
  }

  if (s.state === "live") {
    return {
      state: "live",
      text: `🎬 In corso • fine tra ${formatMinutesOnly(s.diffEnd)}`
    };
  }

  return {
    state: "ended",
    text: "✔️ Terminato"
  };
}

/* =======================
   CITY-FAVORITE/FAVORITE
======================= */
const DEFAULT_CINEMA_KEY = "defaultCinema";

function setDefaultCinema(multiplexId, cityId) {
  const payload = {
    multiplexId,
    cityId
  };

  localStorage.setItem(
    DEFAULT_CINEMA_KEY,
    JSON.stringify(payload)
  );

  updateCitySelectStar();
}

function getDefaultCinema() {
  const raw = localStorage.getItem(DEFAULT_CINEMA_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function updateCitySelectStar() {
  const saved = getDefaultCinema();
  const ctx = getCurrentContext();

  if (!saved || !ctx) {
    cityFav.classList.remove("disabled");
    return;
  }

  const isDefault =
    saved.cityId === ctx.cityId &&
    saved.multiplexId === ctx.multiplexId;

  cityFav.classList.toggle("disabled", isDefault);
}

function updateCityOptionsStar() {
  const saved = getDefaultCinema();
  if (!saved) return;

  Array.from(citySelect.options).forEach(opt => {
    const cityId = opt.dataset.id;
    const multiplexId =
      CinemaAdapter.getMultiplexIdFromUI(multiplexSelect.value);

    // reset testo originale usando label dal mock
    const cityData =
      window.MockSource.cities?.[cityId];

    if (!cityData) return;

    const baseLabel = cityData.label;

    opt.textContent = baseLabel;

    if (
      saved.cityId === cityId &&
      saved.multiplexId === multiplexId
    ) {
      opt.textContent = baseLabel + " ⭐";
    }
  });
}

function syncUIState() {
  updateCitySelectStar();
  updateClearButtons();
}

function getCityDisplayName(multiplexId, cityId) {
  const city = CinemaAdapter.getCityById(cityId);
  const multiplex = CinemaAdapter.getMultiplexById(multiplexId);

  if (!city || !multiplex) return cityId;

  return `- ${multiplex.shortLabel} • ${city.label} -`;
}



cityFav.onclick = () => {
  const ctx = getCurrentContext();
  if (!ctx) return;

  const { multiplexId, cityId } = ctx;

  setDefaultCinema(multiplexId, cityId);

  showToast(
    `⭐ ${getCityDisplayName(multiplexId, cityId)} impostata come città predefinita`
  );

  updateCityOptionsStar();
};


function syncSessionVisualState(el, status) {
  const item = el.closest(".preferito-item");
  if (!item) return;
  item.classList.toggle("upcoming", status.state === "upcoming");
  item.classList.toggle("live", status.state === "live");
  item.classList.toggle("expired", status.state === "ended");
}

function updateClearButtons() {
  const favs = getFavs();
  const ctx = getCurrentContext();

  if (!ctx) return;

  const { multiplexId, cityId } = ctx;

  const hasCityFavs = favs.some(f =>
    f.multiplexId === multiplexId &&
    f.cityId === cityId
  );

  const hasAnyFavs = favs.length > 0;

  btnClearCityFavs.disabled = !hasCityFavs;
  btnClearAllFavs.disabled = !hasAnyFavs;

  btnClearCityFavs.classList.toggle("disabled", !hasCityFavs);
  btnClearAllFavs.classList.toggle("disabled", !hasAnyFavs);
}

btnClearCityFavs.onclick = async () => {
  const ctx = getCurrentContext();
  if (!ctx) return;

  const confirmed = await showModal(
    "Eliminare i preferiti di questa città?"
  );
  if (!confirmed) return;

  let favs = getFavs();

  favs = favs.filter(f =>
    !(
      f.multiplexId === ctx.multiplexId &&
      f.cityId === ctx.cityId
    )
  );

  saveFavs(favs);

  renderProgrammazione();
  renderPreferiti();
  renderSummary();
  updateClearButtons();
  updateFavoritesCounter();
};

document.getElementById("btnClearAllFavs").onclick = async () => {
  const confirmed = await showModal(
    "Eliminare TUTTI i preferiti di TUTTE le città?"
  );
  if (!confirmed) return;

  saveFavs([]);
  renderProgrammazione();
  renderPreferiti();
  renderSummary();
  updateClearButtons();
  updateFavoritesCounter();
};

function removeSingleFavorite(fav) {
  let favs = getFavs();

  favs = favs.filter(f =>
    !(
      f.multiplexId === fav.multiplexId &&
      f.cityId === fav.cityId &&
      f.day === fav.day &&
      f.film === fav.film &&
      f.time === fav.time
    )
  );

  saveFavs(favs);
  renderProgrammazione();
  renderPreferiti();
  renderSummary();
  updateClearButtons();
  updateFavoritesCounter();
}

function sanitizeFavorites() {
  let favs = getFavs();
  const validFavs = [];

  favs.forEach(f => {
    const cityData =
      window.MockSource.programmazione
      ?.[f.multiplexId]
      ?.[f.cityId];

    const dayData = cityData?.[f.day];

    if (dayData?.[f.film]?.includes(f.time)) {
      validFavs.push(f);
    }
  });

  if (validFavs.length !== favs.length) {
    saveFavs(validFavs);
  }
}


/* ================= VIEW ================= */
btnProgrammazione.onclick = goProgrammazione;

function goProgrammazione() {
  if (currentView === "programmazione") return;

  currentView = "programmazione";
  document.body.classList.add("view-programmazione");
  document.body.classList.remove("view-preferiti");

  applyTranslate(0, true);
  showDays();

  btnProgrammazione.classList.add("active");
  btnPreferiti.classList.remove("active");
}

btnPreferiti.onclick = goPreferiti;

function goPreferiti() {
  if (currentView === "preferiti") return;

  currentView = "preferiti";
  document.body.classList.add("view-preferiti");
  document.body.classList.remove("view-programmazione");

  applyTranslate(-window.innerWidth, true);
  hideDays();
  renderPreferitiSafe();

  btnPreferiti.classList.add("active");
  btnProgrammazione.classList.remove("active");
}

/* =======================
   SWIPE PRO ENGINE
======================= */

const swipeTrack = document.getElementById("swipeTrack");

let startX = 0;
let currentX = 0;
let deltaX = 0;
let isDragging = false;
let startTime = 0;

const SWIPE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.35;
let hasCaptured = false;

function baseTranslate() {
  return currentView === "programmazione" ? 0 : -window.innerWidth;
}

function applyTranslate(px, animated = false) {
  swipeTrack.style.transition = animated
    ? "transform 0.35s cubic-bezier(.4,0,.2,1)"
    : "none";
  swipeTrack.style.transform = `translateX(${px}px)`;
}

/* POINTER DOWN */
swipeTrack.addEventListener("pointerdown", e => {
  if (e.target.closest(".sticky")) return;

  startX = e.clientX;
  currentX = startX;
  deltaX = 0;
  isDragging = true;
  startTime = performance.now();

  //swipeTrack.setPointerCapture(e.pointerId);
});

/* POINTER MOVE */
swipeTrack.addEventListener("pointermove", e => {
  if (!isDragging) return;

  deltaX = e.clientX - startX;

  const base =
    currentView === "programmazione"
      ? 0
      : -window.innerWidth;

  let next = base + deltaX;

  next = Math.max(
    -window.innerWidth,
    Math.min(0, next)
  );

  applyTranslate(next);
});

/* POINTER UP */
swipeTrack.addEventListener("pointerup", e => {
  if (!isDragging) return;

  swipeTrack.releasePointerCapture(e.pointerId);
  isDragging = false;

  const elapsed = performance.now() - startTime;
  const velocity = deltaX / elapsed;

  if (
    currentView === "programmazione" &&
    (deltaX < -SWIPE_THRESHOLD || velocity < -VELOCITY_THRESHOLD)
  ) {
    goPreferiti();
  } else if (
    currentView === "preferiti" &&
    (deltaX > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD)
  ) {
    goProgrammazione();
  } else {
    applyTranslate(baseTranslate(), true);
  }
});
/* CANCEL */
swipeTrack.addEventListener("pointercancel", () => {
  isDragging = false;
  applyTranslate(baseTranslate(), true);
});


/* MODALE GENERICO */
const confirmModal = document.getElementById("confirmModal");
const modalMessage = document.getElementById("modalMessage");
const modalCancel = document.getElementById("modalCancel");
const modalConfirm = document.getElementById("modalConfirm");

let modalResolve = null;

function showModal(message) {
  modalMessage.textContent = message;
  confirmModal.style.display = "flex";

  return new Promise(resolve => {
    modalResolve = resolve;
  });
}

function showToast(message, duration = 2000) {
  modalMessage.textContent = message;

  confirmModal.classList.add("toast");
  confirmModal.style.display = "flex";

  // opzionale: haptic leggero
  if (navigator.vibrate) navigator.vibrate(10);

  setTimeout(() => {
    confirmModal.style.display = "none";
    confirmModal.classList.remove("toast");
  }, duration);
}

modalCancel.onclick = () => {
  confirmModal.style.display = "none";
  modalResolve?.(false);
};

modalConfirm.onclick = () => {
  confirmModal.style.display = "none";
  modalResolve?.(true);
};


/* =======================
   COUNTDOWN
======================= */
function getSessionStatus(day, time, film) {
  const start = getSessionDateTime(day, time);
  const duration = (filmDurations[film] || 0) + PUBBLICITA_MINUTI;
  const end = new Date(start.getTime() + duration * 60000);

  const now = new Date();

  if (now < start) {
    return {
      state: "upcoming",
      diffStart: start - now,
      diffEnd: end - now
    };
  }

  if (now >= start && now < end) {
    return {
      state: "live",
      diffEnd: end - now
    };
  }

  return {
    state: "ended"
  };
}

function formatSummaryStatus(day, time, film) {
  const s = getSessionStatus(day, time, film);

  if (s.state === "upcoming") {
    const min = Math.ceil(s.diffStart / 60000);
    return `⏳ Inizia tra ${min} min`;
  }

  if (s.state === "live") {
    const min = Math.ceil(s.diffEnd / 60000);
    return `🎬 In corso • fine tra ${min} min`;
  }

  return "✔️ Terminato";
}


function formatAdvancedCountdown(day, time, film) {
  const s = getSessionStatus(day, time, film);

  if (s.state === "upcoming") {
    return `⏳ Inizia tra ${formatCountdown(s.diffStart)}`;
  }

  if (s.state === "live") {
    return `🎬 In corso • fine tra ${formatCountdown(s.diffEnd)}`;
  }

  return "✔️ Terminato";
}
/* =======================
   INIT
======================= */

startSummaryClock();
setActiveView("programmazione");

citySelect.onchange = async () => {
  sanitizeFavorites();
  generateDays();
  renderProgrammazione();
  renderPreferiti();
  renderSummary();
  syncUIState();
  updateCityOptionsStar();
  updateFavoritesCounter();
};

multiplexSelect.onchange = async () => {
  const multiplexLabel = multiplexSelect.value;
  const multiplexId = CinemaAdapter.getMultiplexIdFromUI(multiplexLabel);

  syncCitySelectByMultiplex(multiplexId);
  sanitizeFavorites();
  generateDays();
  renderProgrammazione();
  renderPreferiti();
  renderSummary();
  syncUIState();
  updateCityOptionsStar();
  updateFavoritesCounter();
};

document.addEventListener("DOMContentLoaded", async () => {

  sanitizeFavorites();

  // 1️⃣ Popola multiplex
  populateMultiplexSelect();

  // 2️⃣ Garantisce defaultCinema
  ensureDefaultCinema();

  const saved = getDefaultCinema();

  // 3️⃣ Applica multiplex
  const multiplex =
    CinemaAdapter.getMultiplexById(saved.multiplexId);

  multiplexSelect.value = multiplex.label;

  // 4️⃣ Popola città del multiplex
  syncCitySelectByMultiplex(saved.multiplexId);

  // 5️⃣ Seleziona città default
  const opt = Array.from(citySelect.options)
    .find(o => o.dataset.id === saved.cityId);

  if (opt) citySelect.value = opt.value;

  updateCitySelectStar();
  updateCityOptionsStar();
  generateDays();
  renderProgrammazione();
  renderSummary();
  renderPreferiti();
  updateClearButtons();
  updateFavoritesCounter();
});

/* =======================
   NOTIFICHE PUSH
======================= */
const btnNotifiche = document.getElementById("btnNotifiche");

// --- AGGIORNA VISIBILITÀ DEL PULSANTE ---
function updateNotificationButton() {
  if (!("Notification" in window)) {
    btnNotifiche.style.display = "none";
    return;
  }

  if (Notification.permission === "granted") {
    btnNotifiche.style.display = "none";
    notificationsEnabled = true; // se già concesso, abilitiamo subito
  } else {
    btnNotifiche.style.display = "block";
  }
}

// --- CHIEDI AUTORIZZAZIONE ---
async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("Notifiche non supportate");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    notificationsEnabled = true;
    btnNotifiche.style.display = "none";
    console.log("🔔 Notifiche abilitate");
  } else {
    notificationsEnabled = false;
    console.log("❌ Notifiche non abilitate");
  }
}

// --- CLICK DEL PULSANTE ---
btnNotifiche.addEventListener("click", enableNotifications);

// --- RITORNA IL PROSSIMO FILM IMMINENTE ---
function getNextUpcomingSession() {
  const now = Date.now();

  return getFavs()
    .map(f => {
      const s = getSessionStatus(f.day, f.time, f.film);
      return { ...f, status: s };
    })
    .filter(f => f.status.state === "upcoming")
    .sort((a, b) => a.status.diffStart - b.status.diffStart)[0];
}

// --- INVIA NOTIFICA TRAMITE SERVICE WORKER ---
function notifyUpcomingFilm(session) {
  if (!notificationsEnabled) return;
  if (Notification.permission !== "granted") return;
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.ready.then(reg => {
    reg.active.postMessage({
      type: "NOTIFY",
      payload: {
        title: "🎬 Film in arrivo tra 5 min",
        body: `${session.film} inizia alle ${session.time}`,
        badge: "icons/badge.png",
        icon: "icons/icon-192.png",
        vibrate: [200, 100, 200],
        sound: true
      }
    });
  });
}

// --- SCHEDULER DELLA NOTIFICA (5 MINUTI PRIMA) ---
function notificationScheduler() {
  if (!notificationsEnabled) return;

  const next = getNextUpcomingSession();
  if (!next) {
    scheduledNotificationKey = null;
    return;
  }

  const minutes = Math.floor(next.status.diffStart / 60000);
  const key = `${next.day}|${next.time}|${next.film}`;

  // reset se cambia il film imminente
  if (scheduledNotificationKey && scheduledNotificationKey !== key) {
    scheduledNotificationKey = null;
  }

  if (minutes === 5 && !scheduledNotificationKey) {
    notifyUpcomingFilm(next);
    scheduledNotificationKey = key;
    notifiedSessions.add(key);
    console.log("🔔 Notifica inviata per:", key);
  }
}

// --- INTEGRAZIONE NEL COUNTDOWN ---
setInterval(() => {
  document.querySelectorAll(".countdown").forEach(el => {
    if (!el.isConnected) return;
    if (el.dataset.done === "1") return;

    const { day, time, film } = el.dataset;
    const s = getSessionStatus(day, time, film);

    let nextText = "";

    if (s.state === "upcoming") {
      const minutes = Math.floor(s.diffStart / 60000);
      nextText = `⏳ Inizia tra ${formatCountdown(s.diffStart)}`;

      // invia notifica solo 5 minuti prima
      if (minutes === 5) {
        const key = `${day}|${time}|${film}`;
        if (!notifiedSessions.has(key)) {
          notifyUpcomingFilm({ day, time, film, status: s });
          notifiedSessions.add(key);
          scheduledNotificationKey = key;
        }
      }

    } else if (s.state === "live") {
      nextText = `🎬 In corso • fine tra ${formatCountdown(s.diffEnd)}`;
    } else {
      nextText = "✔️ Terminato";
      el.dataset.done = "1";
    }

    if (el.textContent !== nextText) {
      el.textContent = nextText;
    }

    syncSessionVisualState(el, s);
  });

  notificationScheduler();
}, 1000);

// --- AGGIORNA PULSANTE AL LOAD ---
document.addEventListener("DOMContentLoaded", updateNotificationButton);
