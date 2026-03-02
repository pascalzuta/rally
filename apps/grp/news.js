(function () {
  const STORAGE_KEY = "grp-custom-posts-v1";
  const AUTH_KEY = "grp-owner-auth-v1";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseParagraphs(value) {
    return String(value)
      .split(/\n\s*\n/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function formatDate(isoDate) {
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function getCustomPosts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function setCustomPosts(posts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }

  function allPosts() {
    const seed = Array.isArray(window.GRP_NEWS_SEED_POSTS) ? window.GRP_NEWS_SEED_POSTS : [];
    const custom = getCustomPosts();
    return [...seed, ...custom].sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  function publishedPosts() {
    return allPosts().filter((post) => post.status === "published");
  }

  function postUrl(slug, page) {
    return `./post.html?slug=${encodeURIComponent(slug)}&page=${page}`;
  }

  function renderNewsList() {
    const mount = document.querySelector("[data-news-list]");
    if (!mount) return;

    const posts = publishedPosts();
    if (!posts.length) {
      mount.innerHTML = "<p>No published posts yet.</p>";
      return;
    }

    mount.innerHTML = posts
      .map((post) => {
        const tags = (post.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
        return `
          <article class="news-card">
            <p class="news-date">${escapeHtml(formatDate(post.publishedAt))}</p>
            <h3><a href="${postUrl(post.slug, 1)}">${escapeHtml(post.title)}</a></h3>
            <p>${escapeHtml(post.summary)}</p>
            <div class="article-tags">${tags}</div>
            <a class="read-more" href="${postUrl(post.slug, 1)}">Read article</a>
          </article>
        `;
      })
      .join("");
  }

  function parsePostFromForm(form) {
    const data = new FormData(form);
    const id = String(data.get("id") || "").trim();
    const slug = String(data.get("slug") || "").trim();

    return {
      id: id || `custom-${Date.now()}`,
      slug,
      title: String(data.get("title") || "").trim(),
      monthKey: String(data.get("monthKey") || "").trim(),
      publishedAt: String(data.get("publishedAt") || "").trim(),
      author: String(data.get("author") || "").trim(),
      summary: String(data.get("summary") || "").trim(),
      tags: String(data.get("tags") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      status: String(data.get("status") || "draft").trim() === "published" ? "published" : "draft",
      pages: [
        {
          heading: String(data.get("page1Heading") || "").trim(),
          body: parseParagraphs(data.get("page1Body"))
        },
        {
          heading: String(data.get("page2Heading") || "").trim(),
          body: parseParagraphs(data.get("page2Body"))
        },
        {
          heading: String(data.get("page3Heading") || "").trim(),
          body: parseParagraphs(data.get("page3Body"))
        }
      ]
    };
  }

  function setForm(form, post) {
    form.elements.id.value = post?.id || "";
    form.elements.title.value = post?.title || "";
    form.elements.author.value = post?.author || "Green Room Partners";
    form.elements.publishedAt.value = post?.publishedAt || "";
    form.elements.monthKey.value = post?.monthKey || "";
    form.elements.slug.value = post?.slug || "";
    form.elements.summary.value = post?.summary || "";
    form.elements.tags.value = (post?.tags || []).join(", ");
    form.elements.status.value = post?.status || "draft";
    form.elements.page1Heading.value = post?.pages?.[0]?.heading || "";
    form.elements.page1Body.value = (post?.pages?.[0]?.body || []).join("\n\n");
    form.elements.page2Heading.value = post?.pages?.[1]?.heading || "";
    form.elements.page2Body.value = (post?.pages?.[1]?.body || []).join("\n\n");
    form.elements.page3Heading.value = post?.pages?.[2]?.heading || "";
    form.elements.page3Body.value = (post?.pages?.[2]?.body || []).join("\n\n");
  }

  function renderCustomPosts(form) {
    const mount = document.querySelector("[data-custom-posts]");
    if (!mount) return;

    const posts = getCustomPosts().sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    if (!posts.length) {
      mount.innerHTML = "<p>No custom posts yet.</p>";
      return;
    }

    mount.innerHTML = posts
      .map(
        (post) => `
      <article class="custom-post-item">
        <h4>${escapeHtml(post.title)}</h4>
        <p>${escapeHtml(post.status.toUpperCase())} · ${escapeHtml(formatDate(post.publishedAt))}</p>
        <div class="custom-post-actions">
          <button type="button" data-edit-post="${escapeHtml(post.id)}" class="btn-secondary">Edit</button>
          <button type="button" data-delete-post="${escapeHtml(post.id)}" class="btn-danger">Delete</button>
          <a href="${postUrl(post.slug, 1)}" class="btn-secondary">Preview</a>
        </div>
      </article>
    `
      )
      .join("");

    mount.querySelectorAll("[data-edit-post]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-edit-post");
        const post = getCustomPosts().find((item) => item.id === id);
        if (post) setForm(form, post);
      });
    });

    mount.querySelectorAll("[data-delete-post]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-delete-post");
        const filtered = getCustomPosts().filter((item) => item.id !== id);
        setCustomPosts(filtered);
        renderCustomPosts(form);
        renderNewsList();
      });
    });
  }

  function setupAdmin() {
    const panel = document.querySelector("[data-admin-panel]");
    const form = document.querySelector("[data-post-form]");
    const resetButton = document.querySelector("[data-new-post]");
    if (!panel || !form || !resetButton) return;

    const isOwner = localStorage.getItem(AUTH_KEY) === "true";
    panel.hidden = !isOwner;
    if (!isOwner) return;

    setForm(form, null);
    renderCustomPosts(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const post = parsePostFromForm(form);
      const posts = getCustomPosts();
      const index = posts.findIndex((item) => item.id === post.id);
      const duplicateSlug = posts.some((item) => item.slug === post.slug && item.id !== post.id);
      const seedSlug = (window.GRP_NEWS_SEED_POSTS || []).some((item) => item.slug === post.slug);
      if (duplicateSlug || seedSlug) {
        alert("Slug already exists. Please choose a unique slug.");
        return;
      }

      if (index >= 0) {
        posts[index] = post;
      } else {
        posts.push(post);
      }

      setCustomPosts(posts);
      renderCustomPosts(form);
      renderNewsList();
      setForm(form, post);
    });

    resetButton.addEventListener("click", () => setForm(form, null));
  }

  function renderPostPage() {
    const shell = document.querySelector("[data-article-shell]");
    if (!shell) return;

    const params = new URLSearchParams(window.location.search);
    const slug = params.get("slug") || "";
    const pageParam = Number(params.get("page") || "1");

    const post = allPosts().find((item) => item.slug === slug && item.status === "published");
    if (!post) {
      shell.innerHTML = "<h2>Post not found</h2><p>The article may be a draft or may not exist.</p>";
      return;
    }

    const pageIndex = Number.isFinite(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
    const page = post.pages?.[pageIndex] || post.pages?.[0];
    const totalPages = Array.isArray(post.pages) ? post.pages.length : 1;

    const titleNode = document.querySelector("[data-post-title]");
    const metaNode = document.querySelector("[data-post-meta]");
    const tagNode = document.querySelector("[data-post-tags]");
    const headingNode = document.querySelector("[data-page-heading]");
    const bodyNode = document.querySelector("[data-page-body]");
    const navNode = document.querySelector("[data-page-nav]");

    if (titleNode) titleNode.textContent = post.title;
    if (metaNode) metaNode.textContent = `${formatDate(post.publishedAt)} · ${post.author}`;
    if (tagNode) {
      tagNode.innerHTML = (post.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    }

    if (headingNode) headingNode.textContent = page?.heading || "Article";
    if (bodyNode) {
      bodyNode.innerHTML = (page?.body || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
    }

    if (navNode) {
      let links = '<a class="btn-secondary" href="./news.html">All posts</a>';
      if (pageIndex > 0) {
        links += `<a class="btn-secondary" href="${postUrl(post.slug, pageIndex)}">Previous page</a>`;
      }
      if (pageIndex + 1 < totalPages) {
        links += `<a class="btn-primary" href="${postUrl(post.slug, pageIndex + 2)}">Next page</a>`;
      }
      links += `<span class="page-counter">Page ${pageIndex + 1} of ${totalPages}</span>`;
      navNode.innerHTML = links;
    }

    document.title = `${post.title} | Green Room Partners`;
  }

  renderNewsList();
  setupAdmin();
  renderPostPage();
})();
