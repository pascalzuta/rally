(function () {
  const AUTH_KEY = "grp-owner-auth-v1";
  const STORAGE_KEY = "grp-cms-areas-v4";
  const LEGACY_STORAGE_KEYS = ["grp-cms-areas-v3", "grp-cms-areas-v2", "grp-cms-overrides-v1"];
  const FORCED_IMAGE_FIX_FLAG = "grp-cms-image-fix-20260225";
  const HOME_IMAGE_REPLACEMENTS = {
    "https://images.pexels.com/photos/7567560/pexels-photo-7567560.jpeg?auto=compress&cs=tinysrgb&w=1800":
      "https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1800",
    "https://images.pexels.com/photos/325229/pexels-photo-325229.jpeg?auto=compress&cs=tinysrgb&w=1800":
      "./assets/optimized/inline-financial-dashboard-3d98c37b-800.jpg",
    "https://images.pexels.com/photos/256381/pexels-photo-256381.jpeg?auto=compress&cs=tinysrgb&w=1600":
      "./assets/optimized/inline-container-shipping-96ee96e2-800.jpg",
    "https://images.pexels.com/photos/4386467/pexels-photo-4386467.jpeg?auto=compress&cs=tinysrgb&w=1600":
      "./assets/optimized/inline-laboratory-11dd7aaa-800.jpg",
    "https://images.pexels.com/photos/373543/pexels-photo-373543.jpeg?auto=compress&cs=tinysrgb&w=1600":
      "./assets/optimized/inline-laboratory-11dd7aaa-800.jpg",
    "https://images.pexels.com/photos/3952234/pexels-photo-3952234.jpeg?auto=compress&cs=tinysrgb&w=1600":
      "./assets/optimized/inline-laboratory-11dd7aaa-800.jpg"
  };

  function pageKey() {
    const path = window.location.pathname || "/index.html";
    const normalized = path.endsWith("/") ? `${path}index.html` : path;
    return normalized.split("/").pop() || "index.html";
  }

  const CURRENT_PAGE = pageKey();
  const EXCLUDED = new Set();

  const CMS_CONFIG = {
    "index.html": [
      { key: "hero_image", label: "Hero Background Image URL", type: "css-image", variable: "--hero-home-image", defaultValue: "./assets/optimized/hero-home-ocean-176bfb9c-1600.jpg" },
      { key: "hero_main", label: "Hero Main", type: "pair", heading: ".hero h1", body: ".hero h1 + p" },
      { key: "hero_support", label: "Hero Supporting Line", type: "single", selector: ".hero .wave-copy" },
      { key: "mission_image", label: "Mission Section Image URL", type: "image", selector: "main .section-card:nth-of-type(1) .media-slab img", defaultValue: "./assets/optimized/inline-financial-dashboard-3d98c37b-800.jpg" },
      { key: "mission", label: "Our Mission", type: "pair", heading: "main .section-card:nth-of-type(1) .page-intro h2", body: "main .section-card:nth-of-type(1) .page-intro p" },
      { key: "conviction", label: "Conviction-Led Investing", type: "pair", heading: "main .section-card:nth-of-type(1) .block:nth-of-type(1) h3", body: "main .section-card:nth-of-type(1) .block:nth-of-type(1) p" },
      { key: "partnership", label: "Long-Term Partnership", type: "pair", heading: "main .section-card:nth-of-type(1) .block:nth-of-type(2) h3", body: "main .section-card:nth-of-type(1) .block:nth-of-type(2) p" },
      { key: "sector_image_1", label: "Sector Image 1 URL", type: "image", selector: "main .section-card:nth-of-type(2) .story-stripe figure:nth-of-type(1) img", defaultValue: "./assets/optimized/inline-container-shipping-96ee96e2-800.jpg" },
      { key: "sector_image_2", label: "Sector Image 2 URL", type: "image", selector: "main .section-card:nth-of-type(2) .story-stripe figure:nth-of-type(2) img", defaultValue: "./assets/optimized/inline-laboratory-11dd7aaa-800.jpg" },
      { key: "core_themes", label: "Core Themes", type: "list", heading: "main .section-card:nth-of-type(2) .block:nth-of-type(1) h3", list: "main .section-card:nth-of-type(2) .block:nth-of-type(1) li" },
      { key: "portfolio_discipline", label: "Portfolio Discipline", type: "list", heading: "main .section-card:nth-of-type(2) .block:nth-of-type(2) h3", list: "main .section-card:nth-of-type(2) .block:nth-of-type(2) li" }
    ],
    "structure.html": [
      { key: "hero_image", label: "Hero Background Image URL", type: "css-image", variable: "--hero-structure-image", defaultValue: "./assets/optimized/hero-structure-forest-a16edf34-1600.jpg" },
      { key: "hero", label: "Hero", type: "pair", heading: ".hero h1", body: ".hero h1 + p" },
      { key: "alignment_image", label: "Alignment Section Image URL", type: "image", selector: "main .section-card:nth-of-type(1) .media-slab img", defaultValue: "./assets/optimized/inline-forest-perspective-7306b8de-800.jpg" },
      { key: "investors", label: "We Are Investors", type: "pair", heading: "main .section-card:nth-of-type(1) .page-intro h2", body: "main .section-card:nth-of-type(1) .page-intro p" },
      { key: "long_term", label: "Long-Term First", type: "pair", heading: "main .section-card:nth-of-type(1) .block:nth-of-type(1) h3", body: "main .section-card:nth-of-type(1) .block:nth-of-type(1) p" },
      { key: "tactical", label: "Tactical Flexibility", type: "pair", heading: "main .section-card:nth-of-type(1) .block:nth-of-type(2) h3", body: "main .section-card:nth-of-type(1) .block:nth-of-type(2) p" },
      { key: "partners", label: "We Are Partners", type: "pair", heading: "main .section-card:nth-of-type(2) .page-intro h2", body: "main .section-card:nth-of-type(2) .page-intro p" }
    ],
    "investment-approach.html": [
      { key: "hero_image", label: "Hero Background Image URL", type: "css-image", variable: "--hero-investment-image", defaultValue: "./assets/optimized/hero-investment-climbing-ef6eb1c2-1600.jpg" },
      { key: "hero", label: "Hero", type: "pair", heading: ".hero h1", body: ".hero h1 + p" },
      { key: "execution_image", label: "Execution Section Image URL", type: "image", selector: "main .section-card:nth-of-type(1) .media-slab img", defaultValue: "./assets/optimized/inline-rock-climber-fa216a94-800.jpg" },
      { key: "market_focus", label: "Market and Sector Focus", type: "pair", heading: "main .section-card:nth-of-type(1) .page-intro h2", body: "main .section-card:nth-of-type(1) .page-intro p" },
      { key: "sector_focus", label: "Sector Focus", type: "list", heading: "main .section-card:nth-of-type(1) .block:nth-of-type(1) h3", list: "main .section-card:nth-of-type(1) .block:nth-of-type(1) li" },
      { key: "key_beliefs", label: "Our Key Beliefs", type: "list", heading: "main .section-card:nth-of-type(1) .block:nth-of-type(2) h3", list: "main .section-card:nth-of-type(1) .block:nth-of-type(2) li" },
      { key: "portfolio_construction", label: "Portfolio Construction", type: "pair", heading: "main .section-card:nth-of-type(2) .page-intro h2", body: "main .section-card:nth-of-type(2) .page-intro p" }
    ],
    "team.html": [
      { key: "hero_image", label: "Hero Background Image URL", type: "css-image", variable: "--hero-team-image", defaultValue: "./assets/optimized/hero-team-bridge-914fa7aa-1600.jpg" },
      { key: "hero", label: "Hero", type: "pair", heading: ".hero h1", body: ".hero h1 + p" },
      { key: "all_team_photos", label: "All Team Photo URL", type: "image-multi", selector: "main .person-photo", defaultValue: "./assets/person-placeholder.svg" },
      { key: "founder_intro", label: "Meet Our Founder", type: "single", selector: "main .section-card:nth-of-type(1) .page-intro h2" },
      { key: "founder_profile", label: "Founder Profile", type: "triple", heading: "main .section-card:nth-of-type(1) .person-card:nth-of-type(1) h3", subheading: "main .section-card:nth-of-type(1) .person-card:nth-of-type(1) .role", body: "main .section-card:nth-of-type(1) .person-card:nth-of-type(1) p:last-of-type" },
      { key: "founder_background", label: "Background Highlights", type: "triple", heading: "main .section-card:nth-of-type(1) .person-card:nth-of-type(2) h3", subheading: "main .section-card:nth-of-type(1) .person-card:nth-of-type(2) .role", body: "main .section-card:nth-of-type(1) .person-card:nth-of-type(2) p:last-of-type" },
      { key: "advisory_intro", label: "Advisory Board Intro", type: "pair", heading: "main .section-card:nth-of-type(2) .page-intro h2", body: "main .section-card:nth-of-type(2) .page-intro p" },
      { key: "fund_intro", label: "Fund Advisors Intro", type: "pair", heading: "main .section-card:nth-of-type(3) .page-intro h2", body: "main .section-card:nth-of-type(3) .page-intro p" }
    ],
    "contact.html": [
      { key: "hero_image", label: "Hero Background Image URL", type: "css-image", variable: "--hero-contact-image", defaultValue: "./assets/optimized/hero-contact-sf-71ea468f-1600.jpg" },
      { key: "hero", label: "Hero", type: "pair", heading: ".hero h1", body: ".hero h1 + p" },
      { key: "reach_intro", label: "Reach Green Room Partners", type: "pair", heading: "main .section-card:nth-of-type(1) .page-intro h2", body: "main .section-card:nth-of-type(1) .page-intro p" },
      { key: "general_inquiries", label: "General Inquiries Card", type: "single", selector: "main .section-card:nth-of-type(1) .contact-card:nth-of-type(1) h3" },
      { key: "address_card", label: "Address Card", type: "single", selector: "main .section-card:nth-of-type(1) .contact-card:nth-of-type(2) h3" },
      { key: "hours_card", label: "Office Hours Card", type: "single", selector: "main .section-card:nth-of-type(1) .contact-card:nth-of-type(3) h3" },
      { key: "map_embed", label: "Google Maps Embed URL", type: "iframe-src", selector: "main .map-shell iframe", defaultValue: "https://www.google.com/maps?q=415+Mission+Street,+San+Francisco,+CA+94105&output=embed" },
      { key: "send_intro", label: "Send Us A Message", type: "pair", heading: "main .section-card:nth-of-type(2) .page-intro h2", body: "main .section-card:nth-of-type(2) .page-intro p" }
    ],
    "news.html": [
      { key: "hero", label: "Hero", type: "pair", heading: ".hero h1", body: ".hero h1 + p" },
      { key: "latest_posts_intro", label: "Latest Posts Intro", type: "pair", heading: "main .section-card:nth-of-type(1) .page-intro h2", body: "main .section-card:nth-of-type(1) .page-intro p" },
      { key: "blog_module_intro", label: "Partner Blog Module Intro", type: "pair", heading: "main .section-card:nth-of-type(2) .page-intro h2", body: "main .section-card:nth-of-type(2) .page-intro p" }
    ],
    "post.html": [
      { key: "hero_title", label: "Article Hero Title", type: "single", selector: ".hero [data-post-title]" },
      { key: "hero_meta", label: "Article Hero Meta", type: "single", selector: ".hero [data-post-meta]" },
      { key: "article_heading", label: "Article Heading", type: "single", selector: "main [data-page-heading]" }
    ]
  };

  const IMAGE_TYPES = new Set(["image", "image-multi", "css-image", "iframe-src"]);

  function isSafeUrl(url) {
    const trimmed = String(url).trim();
    return (
      trimmed.startsWith("https://") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("./") ||
      trimmed.startsWith("/")
    );
  }

  function migrateLegacyIfNeeded() {
    if (localStorage.getItem(STORAGE_KEY)) return;

    let legacy = null;
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          legacy = parsed;
          break;
        }
      } catch {
        // Ignore malformed legacy payload.
      }
    }
    if (!legacy) return;

    // Migrate only text-based fields. Image-like fields are intentionally reset
    // to avoid stale/cached URLs overriding current page defaults.
    const migrated = {};
    Object.keys(CMS_CONFIG).forEach((page) => {
      const areas = CMS_CONFIG[page] || [];
      const source = legacy[page];
      if (!source || typeof source !== "object") return;
      const target = {};
      areas.forEach((area) => {
        if (IMAGE_TYPES.has(area.type)) return;
        if (typeof source[area.key] === "string") target[area.key] = source[area.key];
      });
      if (Object.keys(target).length) migrated[page] = target;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  }

  function getStore() {
    try {
      migrateLegacyIfNeeded();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!localStorage.getItem(FORCED_IMAGE_FIX_FLAG) && parsed && typeof parsed === "object") {
        Object.keys(parsed).forEach((page) => {
          const pageData = parsed[page];
          if (!pageData || typeof pageData !== "object") return;
          Object.keys(pageData).forEach((field) => {
            const value = pageData[field];
            if (typeof value === "string" && HOME_IMAGE_REPLACEMENTS[value]) {
              pageData[field] = HOME_IMAGE_REPLACEMENTS[value];
            }
          });
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        localStorage.setItem(FORCED_IMAGE_FIX_FLAG, "true");
      }
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function forceReplaceLegacyWomanPhotoEverywhere() {
    // 1) Replace in all known CMS storage buckets.
    [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return;

        Object.keys(parsed).forEach((page) => {
          const pageData = parsed[page];
          if (!pageData || typeof pageData !== "object") return;
          Object.keys(pageData).forEach((field) => {
            const value = pageData[field];
            if (typeof value === "string" && HOME_IMAGE_REPLACEMENTS[value]) {
              pageData[field] = HOME_IMAGE_REPLACEMENTS[value];
            } else if (typeof value === "string" && value.includes("pexels-photo-4386467")) {
              pageData[field] = "./assets/optimized/inline-laboratory-11dd7aaa-800.jpg";
            }
          });
        });
        localStorage.setItem(key, JSON.stringify(parsed));
      } catch {
        // Ignore malformed payloads.
      }
    });

    // 2) Replace in live DOM immediately.
    document.querySelectorAll("img").forEach((img) => {
      if (!(img instanceof HTMLImageElement)) return;
      Object.entries(HOME_IMAGE_REPLACEMENTS).forEach(([from, to]) => {
        if (img.src.includes(from.split("?")[0].split("/").pop() || "")) {
          img.src = to;
        }
      });
      if (img.src.includes("pexels-photo-4386467")) {
        img.src = "./assets/optimized/inline-laboratory-11dd7aaa-800.jpg";
      }
    });
  }

  function setStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function q(selector) {
    return document.querySelector(selector);
  }

  function qa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function getAreaValue(area) {
    if (area.type === "single") {
      const node = q(area.selector);
      return node ? node.textContent.trim() : "";
    }

    if (area.type === "pair") {
      const h = q(area.heading);
      const b = q(area.body);
      return [h?.textContent?.trim() || "", b?.textContent?.trim() || ""].join("\n\n").trim();
    }

    if (area.type === "triple") {
      const h = q(area.heading);
      const s = q(area.subheading);
      const b = q(area.body);
      return [h?.textContent?.trim() || "", s?.textContent?.trim() || "", b?.textContent?.trim() || ""].join("\n\n").trim();
    }

    if (area.type === "list") {
      const h = q(area.heading);
      const items = qa(area.list).map((li) => li.textContent.trim());
      return [h?.textContent?.trim() || "", ...items].join("\n").trim();
    }

    if (area.type === "image") {
      const node = q(area.selector);
      return node instanceof HTMLImageElement ? node.src : area.defaultValue || "";
    }

    if (area.type === "image-multi") {
      const node = q(area.selector);
      return node instanceof HTMLImageElement ? node.src : area.defaultValue || "";
    }

    if (area.type === "iframe-src") {
      const node = q(area.selector);
      return node instanceof HTMLIFrameElement ? node.src : area.defaultValue || "";
    }

    if (area.type === "css-image") {
      return area.defaultValue || "";
    }

    return "";
  }

  function applyAreaValue(area, value) {
    if (!value) return;

    if (area.type === "single") {
      const node = q(area.selector);
      if (node) node.textContent = value.trim();
      return;
    }

    if (area.type === "pair") {
      const parts = String(value).split(/\n\s*\n/);
      const h = q(area.heading);
      const b = q(area.body);
      if (h && parts[0]) h.textContent = parts[0].trim();
      if (b && parts[1]) b.textContent = parts.slice(1).join("\n\n").trim();
      return;
    }

    if (area.type === "triple") {
      const parts = String(value).split(/\n\s*\n/);
      const h = q(area.heading);
      const s = q(area.subheading);
      const b = q(area.body);
      if (h && parts[0]) h.textContent = parts[0].trim();
      if (s && parts[1]) s.textContent = parts[1].trim();
      if (b && parts[2]) b.textContent = parts.slice(2).join("\n\n").trim();
      return;
    }

    if (area.type === "list") {
      const lines = String(value)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const h = q(area.heading);
      const listItems = qa(area.list);
      if (h && lines[0]) h.textContent = lines[0];
      listItems.forEach((item, index) => {
        if (lines[index + 1]) item.textContent = lines[index + 1];
      });
      return;
    }

    if (area.type === "image") {
      if (!isSafeUrl(value)) return;
      const node = q(area.selector);
      if (node instanceof HTMLImageElement) node.src = value.trim();
      return;
    }

    if (area.type === "image-multi") {
      if (!isSafeUrl(value)) return;
      qa(area.selector).forEach((node) => {
        if (node instanceof HTMLImageElement) node.src = value.trim();
      });
      return;
    }

    if (area.type === "iframe-src") {
      if (!isSafeUrl(value)) return;
      const node = q(area.selector);
      if (node instanceof HTMLIFrameElement) node.src = value.trim();
      return;
    }

    if (area.type === "css-image") {
      if (!isSafeUrl(value)) return;
      document.documentElement.style.setProperty(area.variable, `url("${value.trim()}")`);
    }
  }

  function applyOverrides() {
    const areas = CMS_CONFIG[CURRENT_PAGE] || [];
    if (!areas.length) return;
    const store = getStore();
    const pageValues = store[CURRENT_PAGE] || {};
    areas.forEach((area) => {
      if (typeof pageValues[area.key] === "string") {
        applyAreaValue(area, pageValues[area.key]);
      }
    });
  }

  function isLoggedIn() {
    return localStorage.getItem(AUTH_KEY) === "true";
  }

  function renderPanel() {
    if (EXCLUDED.has(CURRENT_PAGE)) return;
    if (!isLoggedIn()) return;

    const areas = CMS_CONFIG[CURRENT_PAGE] || [];
    if (!areas.length) return;

    const panel = document.createElement("aside");
    panel.className = "cms-panel";
    panel.setAttribute("hidden", "hidden");

    const fields = areas
      .map((area) => {
        const imageLike = area.type === "image" || area.type === "image-multi" || area.type === "css-image" || area.type === "iframe-src";
        const placeholder = imageLike
          ? "Paste image or map URL"
          : area.type === "single"
            ? "One text block"
            : "Headline and body separated by a blank line";
        return `
          <label>
            ${area.label}
            <textarea data-area-key="${area.key}" rows="3" placeholder="${placeholder}"></textarea>
          </label>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="cms-head">
        <h3>Page CMS</h3>
        <button type="button" class="btn-secondary" data-cms-close>Close</button>
      </div>
      <p>One field per area. Images and maps also use one URL field each.</p>
      <div class="cms-fields" data-cms-fields>${fields}</div>
      <div class="cms-actions">
        <button type="button" class="btn-primary" data-cms-save>Save</button>
        <button type="button" class="btn-secondary" data-cms-reset>Reset Page</button>
        <button type="button" class="btn-secondary" data-cms-reset-images>Reset Page Images</button>
      </div>
      <p class="cms-note">For News, this page-level CMS controls layout copy while the blog editor manages posts.</p>
    `;

    const toggle = document.createElement("button");
    toggle.className = "cms-toggle";
    toggle.type = "button";
    toggle.textContent = "CMS";

    function hydrate() {
      const store = getStore();
      const pageValues = store[CURRENT_PAGE] || {};
      areas.forEach((area) => {
        const input = panel.querySelector(`textarea[data-area-key="${area.key}"]`);
        if (!(input instanceof HTMLTextAreaElement)) return;
        input.value = typeof pageValues[area.key] === "string" ? pageValues[area.key] : getAreaValue(area);
      });
    }

    toggle.addEventListener("click", () => {
      const isHidden = panel.hasAttribute("hidden");
      if (isHidden) {
        hydrate();
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "hidden");
      }
    });

    panel.querySelector("[data-cms-close]")?.addEventListener("click", () => {
      panel.setAttribute("hidden", "hidden");
    });

    panel.querySelector("[data-cms-save]")?.addEventListener("click", () => {
      const store = getStore();
      const pageValues = store[CURRENT_PAGE] || {};
      areas.forEach((area) => {
        const input = panel.querySelector(`textarea[data-area-key="${area.key}"]`);
        if (!(input instanceof HTMLTextAreaElement)) return;
        pageValues[area.key] = input.value.trim();
      });
      store[CURRENT_PAGE] = pageValues;
      setStore(store);
      applyOverrides();
    });

    panel.querySelector("[data-cms-reset]")?.addEventListener("click", () => {
      const store = getStore();
      delete store[CURRENT_PAGE];
      setStore(store);
      window.location.reload();
    });

    panel.querySelector("[data-cms-reset-images]")?.addEventListener("click", () => {
      const store = getStore();
      const pageValues = { ...(store[CURRENT_PAGE] || {}) };
      areas.forEach((area) => {
        if (IMAGE_TYPES.has(area.type)) delete pageValues[area.key];
      });
      store[CURRENT_PAGE] = pageValues;
      setStore(store);
      window.location.reload();
    });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);
  }

  forceReplaceLegacyWomanPhotoEverywhere();
  applyOverrides();
  window.addEventListener("DOMContentLoaded", applyOverrides);
  window.addEventListener("load", () => {
    forceReplaceLegacyWomanPhotoEverywhere();
    applyOverrides();
  });
  renderPanel();
})();
