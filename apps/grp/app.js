(function () {
  const SITE_GATE_KEY = "grp-site-gate-auth-v1";
  const SITE_PASSWORD = "forbidden";
  const AUTH_KEY = "grp-owner-auth-v1";
  const OWNER_USERNAME = "christian";
  const OWNER_PASSWORD = "Schmuck";

  function hasSiteAccess() {
    return localStorage.getItem(SITE_GATE_KEY) === "true";
  }

  function grantSiteAccess() {
    localStorage.setItem(SITE_GATE_KEY, "true");
  }

  function trapFocus(container) {
    function getFocusable() {
      return Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (el) {
        return el.offsetParent !== null;
      });
    }

    function handleKeydown(event) {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeydown);
    return function removeTrap() {
      container.removeEventListener("keydown", handleKeydown);
    };
  }

  function renderSiteGate() {
    const modal = document.createElement("div");
    modal.className = "site-gate";
    modal.innerHTML = `
      <div class="site-gate__backdrop"></div>
      <div class="site-gate__panel" role="dialog" aria-modal="true" aria-label="Website Password">
        <h3>Protected Website</h3>
        <p>Please enter the site password to continue.</p>
        <form data-site-gate-form>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          <p class="site-gate__error" data-site-gate-error hidden>Invalid password.</p>
          <div class="site-gate__actions">
            <button type="submit" class="btn-primary">Enter</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const panel = modal.querySelector(".site-gate__panel");
    if (panel) trapFocus(panel);

    const passwordInput = modal.querySelector('input[name="password"]');
    if (passwordInput) passwordInput.focus();

    document.addEventListener("keydown", function onEscape(event) {
      if (event.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", onEscape);
      }
    });

    const form = modal.querySelector("[data-site-gate-form]");
    const error = modal.querySelector("[data-site-gate-error]");
    if (form instanceof HTMLFormElement && error instanceof HTMLElement) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const password = String(data.get("password") || "").trim();
        if (password === SITE_PASSWORD) {
          grantSiteAccess();
          window.location.reload();
          return;
        }
        error.hidden = false;
      });
    }
  }

  if (!hasSiteAccess()) {
    renderSiteGate();
    return;
  }

  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-nav]");

  const navPath = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".main-nav a[href]").forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    const hrefPath = (link.getAttribute("href") || "").replace("./", "").toLowerCase();
    const isHomeMatch = (navPath === "" || navPath === "index.html") && (hrefPath === "" || hrefPath === "index.html");
    const isDirectMatch = hrefPath !== "" && hrefPath === navPath;
    link.classList.toggle("active", isHomeMatch || isDirectMatch);
  });

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const yearTarget = document.querySelector("[data-year]");
  if (yearTarget) {
    yearTarget.textContent = String(new Date().getFullYear());
  }

  function isOwnerAuthenticated() {
    return localStorage.getItem(AUTH_KEY) === "true";
  }

  function setOwnerAuthenticated(value) {
    localStorage.setItem(AUTH_KEY, value ? "true" : "false");
  }

  function syncLoginButtons() {
    const buttons = document.querySelectorAll("[data-login-trigger]");
    const isAuth = isOwnerAuthenticated();
    buttons.forEach((button) => {
      if (button instanceof HTMLButtonElement) {
        button.textContent = isAuth ? "Partner Logout" : "Partner Login";
      }
    });
  }

  let _loginModalTrigger = null;
  let _loginModalCleanup = null;

  function removeModal() {
    const existing = document.querySelector("[data-login-modal]");
    if (existing) existing.remove();
    if (_loginModalCleanup) {
      _loginModalCleanup();
      _loginModalCleanup = null;
    }
    if (_loginModalTrigger) {
      try { _loginModalTrigger.focus(); } catch { /* element may be gone */ }
      _loginModalTrigger = null;
    }
  }

  function openLoginModal(triggerElement) {
    removeModal();
    _loginModalTrigger = triggerElement || null;

    const modal = document.createElement("div");
    modal.className = "login-modal";
    modal.setAttribute("data-login-modal", "true");
    modal.innerHTML = `
      <div class="login-modal__backdrop" data-login-close></div>
      <div class="login-modal__panel" role="dialog" aria-modal="true" aria-label="Partner Login">
        <h3>Partner Login</h3>
        <p>Use partner credentials to access the blog editor in the News section.</p>
        <form data-login-form>
          <label>Username<input name="username" type="text" autocomplete="username" required /></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
          <p class="login-error" data-login-error hidden>Invalid credentials.</p>
          <div class="login-actions">
            <button type="submit" class="btn-primary">Log in</button>
            <button type="button" class="btn-secondary" data-login-close>Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const panel = modal.querySelector(".login-modal__panel");
    const removeTrap = panel ? trapFocus(panel) : null;

    const usernameInput = modal.querySelector('input[name="username"]');
    if (usernameInput) usernameInput.focus();

    function onEscape(event) {
      if (event.key === "Escape") removeModal();
    }
    document.addEventListener("keydown", onEscape);

    _loginModalCleanup = function () {
      document.removeEventListener("keydown", onEscape);
      if (removeTrap) removeTrap();
    };

    modal.querySelectorAll("[data-login-close]").forEach((item) => {
      item.addEventListener("click", () => removeModal());
    });

    const form = modal.querySelector("[data-login-form]");
    const error = modal.querySelector("[data-login-error]");
    if (form instanceof HTMLFormElement && error instanceof HTMLElement) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const username = String(data.get("username") || "").trim().toLowerCase();
        const password = String(data.get("password") || "").trim();

        if ((username === OWNER_USERNAME || username === "login christian") && password === OWNER_PASSWORD) {
          setOwnerAuthenticated(true);
          syncLoginButtons();
          removeModal();
          if (window.location.pathname.endsWith("/news.html") || window.location.pathname.endsWith("news.html")) {
            window.location.reload();
          }
          return;
        }

        error.hidden = false;
      });
    }
  }

  document.querySelectorAll("[data-login-trigger]").forEach((button) => {
    button.addEventListener("click", function () {
      if (isOwnerAuthenticated()) {
        setOwnerAuthenticated(false);
        syncLoginButtons();
        if (window.location.pathname.endsWith("/news.html") || window.location.pathname.endsWith("news.html")) {
          window.location.reload();
        }
        return;
      }

      openLoginModal(this);
    });
  });

  syncLoginButtons();

  const contactForm = document.querySelector("[data-contact-form]");
  const feedback = document.querySelector("[data-contact-feedback]");
  if (contactForm instanceof HTMLFormElement && feedback instanceof HTMLElement) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(contactForm);
      const trap = String(formData.get("website") || "").trim();
      if (trap) return;

      const fields = {
        firstName: String(formData.get("firstName") || "").trim(),
        lastName: String(formData.get("lastName") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        company: String(formData.get("company") || "").trim(),
        inquiryType: String(formData.get("inquiryType") || "").trim(),
        message: String(formData.get("message") || "").trim()
      };

      const lines = [
        `Name: ${fields.firstName} ${fields.lastName}`.trim(),
        `Email: ${fields.email}`,
        `Phone: ${fields.phone || "Not provided"}`,
        `Company: ${fields.company || "Not provided"}`,
        `Inquiry Type: ${fields.inquiryType}`,
        "",
        "Message:",
        fields.message
      ];

      const subject = `Contact Form - ${fields.inquiryType}`;
      const body = lines.join("\n");
      window.location.href = `mailto:info@greenroompartners.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      feedback.hidden = false;
      feedback.textContent = "Your email draft has been opened. Please send it to complete your inquiry.";
    });
  }
})();
