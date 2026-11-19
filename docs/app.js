(() => {
  "use strict";

  const WORKSHOP_SCHEDULE = {
    0: { name: "Domenica", slots: [] },
    1: { name: "Lunedì", slots: [[480, 780], [900, 1140]] },      // 08:00-13:00, 15:00-19:00
    2: { name: "Martedì", slots: [[480, 780], [900, 1140]] },     // 08:00-13:00, 15:00-19:00
    3: { name: "Mercoledì", slots: [[480, 780], [900, 1140]] },   // 08:00-13:00, 15:00-19:00
    4: { name: "Giovedì", slots: [[480, 780], [900, 1140]] },     // 08:00-13:00, 15:00-19:00
    5: { name: "Venerdì", slots: [[480, 780], [900, 1140]] },     // 08:00-13:00, 15:00-19:00
    6: { name: "Sabato", slots: [[480, 780]] }                    // 08:00-13:00
  };

  const WEEKDAY_MAP = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  let holidayState = {
    active: false,
    startDate: "",
    endDate: "",
    message: ""
  };

  let holidayModalHandlersBound = false;

  function formatMinutes(totalMinutes) {
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function formatDateIt(isoDate, includeWeekday = false) {
    if (!ISO_DATE_RE.test(isoDate)) return "";
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const options = {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric"
    };
    if (includeWeekday) {
      options.weekday = "long";
      delete options.year;
    }
    return new Intl.DateTimeFormat("it-IT", options).format(dt);
  }

  function getReopenDayLabelIt(endIsoDate) {
    if (!ISO_DATE_RE.test(endIsoDate)) return "";
    const [y, m, d] = endIsoDate.split("-").map(Number);
    for (let offset = 1; offset <= 14; offset++) {
      const candidate = new Date(Date.UTC(y, m - 1, d + offset));
      const schedule = WORKSHOP_SCHEDULE[candidate.getUTCDay()];
      if (schedule && schedule.slots.length > 0) {
        const formatted = new Intl.DateTimeFormat("it-IT", {
          timeZone: "UTC",
          weekday: "long",
          day: "numeric",
          month: "long"
        }).format(candidate);
        return `Riapriamo ${formatted} alle ${formatMinutes(schedule.slots[0][0])}`;
      }
    }
    return "";
  }

  function isHolidayCurrentlyActive(config, todayIsoDate) {
    if (!config || !config.active) return false;
    if (!ISO_DATE_RE.test(config.startDate) || !ISO_DATE_RE.test(config.endDate)) return false;
    return todayIsoDate >= config.startDate && todayIsoDate <= config.endDate;
  }

  function getRomeDateParts() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }
    const day = WEEKDAY_MAP[map.weekday] ?? now.getDay();
    const hour = Number(map.hour) % 24;
    const minute = Number(map.minute);
    const isoDate = `${map.year}-${map.month}-${map.day}`;
    return { day, minutes: hour * 60 + minute, isoDate };
  }

  function evaluateWorkshopStatus() {
    const { day, minutes, isoDate } = getRomeDateParts();

    if (isHolidayCurrentlyActive(holidayState, isoDate)) {
      const reopenLabel = getReopenDayLabelIt(holidayState.endDate);
      return {
        isOpen: false,
        isHoliday: true,
        day,
        isoDate,
        label: "CHIUSI · FERIE",
        detail: reopenLabel || `Chiusi fino al ${formatDateIt(holidayState.endDate)}`
      };
    }

    const today = WORKSHOP_SCHEDULE[day];

    for (const [start, end] of today.slots) {
      if (minutes >= start && minutes < end) {
        return {
          isOpen: true,
          isHoliday: false,
          day,
          isoDate,
          label: "APERTI ORA",
          detail: `Chiude alle ${formatMinutes(end)}`
        };
      }
    }

    // Closed: check if it reopens later today
    for (const [start] of today.slots) {
      if (minutes < start) {
        return {
          isOpen: false,
          isHoliday: false,
          day,
          isoDate,
          label: "CHIUSI ORA",
          detail: `Riapre alle ${formatMinutes(start)}`
        };
      }
    }

    // Otherwise find next open day
    for (let offset = 1; offset <= 7; offset++) {
      const nextDay = (day + offset) % 7;
      const nextSchedule = WORKSHOP_SCHEDULE[nextDay];
      if (nextSchedule.slots.length > 0) {
        const openTime = formatMinutes(nextSchedule.slots[0][0]);
        const when = offset === 1 ? "domani" : nextSchedule.name;
        return {
          isOpen: false,
          isHoliday: false,
          day,
          isoDate,
          label: "CHIUSI ORA",
          detail: `Riapre ${when} alle ${openTime}`
        };
      }
    }

    return { isOpen: false, isHoliday: false, day, isoDate, label: "CHIUSI ORA", detail: "" };
  }

  function updateWorkshopStatusUI() {
    const status = evaluateWorkshopStatus();
    const signs = document.querySelectorAll("[data-live-status]");

    signs.forEach((sign) => {
      sign.classList.toggle("is-open", status.isOpen);
      sign.classList.toggle("is-closed", !status.isOpen);

      const labelEl = sign.querySelector("[data-status-label]");
      const detailEl = sign.querySelector("[data-status-detail]");
      if (labelEl) labelEl.textContent = status.label;
      if (detailEl) detailEl.textContent = status.detail;
    });

    const rows = document.querySelectorAll("[data-day]");
    rows.forEach((row) => {
      const rowDay = Number(row.getAttribute("data-day"));
      const isToday = rowDay === status.day;
      row.classList.toggle("is-today", isToday);

      const badge = row.querySelector("[data-today-badge]");
      if (badge) {
        badge.hidden = !isToday;
      }
    });
  }

  function initMobileMenu() {
    const btn = document.getElementById("menu-btn");
    const nav = document.getElementById("primary-nav");
    if (!btn || !nav) return;

    const closeMenu = () => {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    };

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  function initConsentMapLoader() {
    const btn = document.getElementById("load-map-btn");
    const container = document.getElementById("map-container");
    if (!btn || !container) return;

    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.className = "map-iframe";
      iframe.title = "Mappa Google Maps — Sergio Pappalardo Gomme, Via Ercole Patti 45, Pedara";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.src = "https://www.google.com/maps?q=37.6186113,15.0551563&z=16&output=embed";

      container.innerHTML = "";
      container.classList.remove("map-preview");
      container.appendChild(iframe);
    });
  }

  function initScrollReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );

    items.forEach((el) => observer.observe(el));
  }

  function initHeroVideo() {
    const video = document.querySelector(".hero-video");
    if (!video) return;

    video.muted = true;
    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    };

    tryPlay();
    video.addEventListener("canplay", tryPlay, { once: true });
    document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
  }

  function bindHolidayModalCloseHandlers() {
    if (holidayModalHandlersBound) return;
    holidayModalHandlersBound = true;

    const modal = document.getElementById("holiday-modal");
    if (!modal) return;

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove("has-holiday-modal");
      if (holidayState.startDate && holidayState.endDate) {
        const key = `ts_ferie_seen_${holidayState.startDate}_${holidayState.endDate}`;
        try {
          window.sessionStorage.setItem(key, "1");
        } catch {
          // sessionStorage non disponibile in modalità restrittive
        }
      }
    };

    modal.querySelectorAll("[data-holiday-close]").forEach((el) => {
      el.addEventListener("click", closeModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        closeModal();
      }
    });
  }

  function renderHolidayNotice(todayIsoDate) {
    const bar = document.getElementById("holiday-bar");
    const modal = document.getElementById("holiday-modal");
    const activeNow = isHolidayCurrentlyActive(holidayState, todayIsoDate);

    if (!activeNow) {
      if (bar) bar.hidden = true;
      if (modal) modal.hidden = true;
      document.body.classList.remove("has-holiday-modal");
      return;
    }

    const startIt = formatDateIt(holidayState.startDate);
    const endIt = formatDateIt(holidayState.endDate);
    const periodText = startIt === endIt ? `Oggi ${startIt}` : `Dal ${startIt} al ${endIt}`;
    const reopenText = getReopenDayLabelIt(holidayState.endDate);
    const userMessage = (holidayState.message || "").trim() || "L'officina è chiusa per ferie nelle date indicate.";

    if (bar) {
      const tickerText = `AVVISO FERIE · ${periodText}: ${userMessage}${reopenText ? ` · ${reopenText}` : ""}`;
      bar.querySelectorAll("[data-holiday-ticker]").forEach((el) => {
        el.textContent = tickerText;
      });
      bar.hidden = false;
    }

    if (modal) {
      bindHolidayModalCloseHandlers();
      const datesEl = document.getElementById("holiday-modal-dates");
      const msgEl = document.getElementById("holiday-modal-message");
      const reopenEl = document.getElementById("holiday-modal-reopen");

      if (datesEl) datesEl.textContent = periodText;
      if (msgEl) msgEl.textContent = userMessage;
      if (reopenEl) {
        reopenEl.textContent = reopenText;
        reopenEl.hidden = !reopenText;
      }

      const seenKey = `ts_ferie_seen_${holidayState.startDate}_${holidayState.endDate}`;
      let alreadySeen = false;
      try {
        alreadySeen = window.sessionStorage.getItem(seenKey) === "1";
      } catch {
        alreadySeen = false;
      }

      if (!alreadySeen) {
        modal.hidden = false;
        document.body.classList.add("has-holiday-modal");
      }
    }
  }

  function shouldUseStaticFerieFallback() {
    const host = window.location.hostname || "";
    return (
      window.location.protocol === "file:" ||
      host === "127.0.0.1" ||
      host === "localhost" ||
      host.endsWith(".github.io")
    );
  }

  async function loadHolidayConfig() {
    const endpoints = shouldUseStaticFerieFallback() ? ["./ferie.json"] : ["./api/ferie", "./ferie.json"];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && typeof data === "object") {
          holidayState = {
            active: Boolean(data.active),
            startDate: typeof data.startDate === "string" ? data.startDate.trim() : "",
            endDate: typeof data.endDate === "string" ? data.endDate.trim() : "",
            message: typeof data.message === "string" ? data.message.trim() : ""
          };
          const { isoDate } = getRomeDateParts();
          updateWorkshopStatusUI();
          renderHolidayNotice(isoDate);
          return;
        }
      } catch {
        // Fallback al percorso successivo o stato standard orari
      }
    }
  }

  updateWorkshopStatusUI();
  setInterval(updateWorkshopStatusUI, 60000);
  loadHolidayConfig();
  initMobileMenu();
  initConsentMapLoader();
  initScrollReveal();
  initHeroVideo();
})();
