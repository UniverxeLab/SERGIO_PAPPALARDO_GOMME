(() => {
  "use strict";

  const WORKSHOP_SCHEDULE = {
    0: { name: "Domenica", slots: [] },
    1: { name: "Lunedì", slots: [[480, 780], [870, 1170]] },      // 08:00-13:00, 14:30-19:30
    2: { name: "Martedì", slots: [[480, 780], [870, 1170]] },     // 08:00-13:00, 14:30-19:30
    3: { name: "Mercoledì", slots: [[480, 780], [870, 1140]] },   // 08:00-13:00, 14:30-19:00
    4: { name: "Giovedì", slots: [[480, 780], [870, 1170]] },     // 08:00-13:00, 14:30-19:30
    5: { name: "Venerdì", slots: [[480, 780], [870, 1170]] },     // 08:00-13:00, 14:30-19:30
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

  function formatMinutes(totalMinutes) {
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function getRomeDateParts() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      weekday: "short",
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
    return { day, minutes: hour * 60 + minute };
  }

  function evaluateWorkshopStatus() {
    const { day, minutes } = getRomeDateParts();
    const today = WORKSHOP_SCHEDULE[day];

    for (const [start, end] of today.slots) {
      if (minutes >= start && minutes < end) {
        return {
          isOpen: true,
          day,
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
          day,
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
          day,
          label: "CHIUSI ORA",
          detail: `Riapre ${when} alle ${openTime}`
        };
      }
    }

    return { isOpen: false, day, label: "CHIUSI ORA", detail: "" };
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

  updateWorkshopStatusUI();
  setInterval(updateWorkshopStatusUI, 60000);
  initMobileMenu();
  initConsentMapLoader();
  initScrollReveal();
  initHeroVideo();
})();
