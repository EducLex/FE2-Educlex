// /user/artikel/fetch/artikel.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";
  const PDF_ICON_URL = "/assets/img/pdf.png";

  // IndexedDB cache (FE-only)
  const DOC_DB = "educlex_docs";
  const DOC_STORE = "docs";

  const artikelList = document.getElementById("artikelList");
  const filterBidang = document.getElementById("filterBidang");

  const modal = document.getElementById("artikelModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalImage = document.getElementById("modalImage");
  const modalContent = document.getElementById("modalContent");
  const modalFile = document.getElementById("modalFile");
  const modalClose = document.querySelector("#artikelModal .close");

  let allArticles = [];
  let categoryMap = {}; // id -> subkategori label
  const docCandidatesById = new Map(); // articleId -> [url...]
  const resolvedDocUrlById = new Map(); // articleId -> resolvedUrl (kalau ketemu 200)

  // ==========================
  // Helpers
  // ==========================
  function pickField(obj, keys, fallback = "") {
    if (!obj) return fallback;
    for (const k of keys) {
      const parts = k.split(".");
      let val = obj;
      for (const p of parts) {
        if (val && Object.prototype.hasOwnProperty.call(val, p)) val = val[p];
        else {
          val = undefined;
          break;
        }
      }
      if (val !== undefined && val !== null) return val;
    }
    return fallback;
  }

  function safeText(v) {
    return String(v ?? "").trim();
  }

  // ✅ ambil field tapi harus non-empty
  function pickNonEmpty(obj, keys, fallback = "") {
    const v = safeText(pickField(obj, keys, ""));
    return v ? v : fallback;
  }

  function normalizeUrl(url) {
    if (!url) return "";
    const s = String(url).trim();
    if (!s) return "";
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("/")) return API_BASE + s;
    return API_BASE + "/" + s.replace(/^\/+/, "");
  }

  // ✅ handle path Windows "uploads\file.pdf"
  function normalizePath(p) {
    return String(p || "").trim().replace(/\\/g, "/");
  }

  function guessFileNameFromUrl(url) {
    try {
      const u = new URL(url);
      const last = u.pathname.split("/").filter(Boolean).pop() || "dokumen";
      return decodeURIComponent(last);
    } catch {
      return String(url).split("/").filter(Boolean).pop() || "dokumen";
    }
  }

  function showToast(msg) {
    alert(msg);
  }

  function formatTanggal(tanggalRaw) {
    let dateToUse = null;
    if (tanggalRaw) {
      const parsed = new Date(tanggalRaw);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) dateToUse = parsed;
    }
    if (!dateToUse) dateToUse = new Date();

    return dateToUse.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  // ==========================
  // IndexedDB
  // ==========================
  function openDocDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DOC_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DOC_STORE)) {
          db.createObjectStore(DOC_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    try {
      const db = await openDocDB();
      return await new Promise((resolve) => {
        const tx = db.transaction(DOC_STORE, "readonly");
        const store = tx.objectStore(DOC_STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // ==========================
  // Categories
  // ==========================
  async function loadCategories() {
    categoryMap = {};
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.categories)) list = data.categories;

      if (!res.ok || !Array.isArray(list)) return;

      const labels = new Set();

      list.forEach((cat) => {
        const id = safeText(cat._id || cat.id || cat.value || cat.slug || cat.categoryId || "");
        if (!id) return;

        const nameRaw = safeText(cat.name || cat.nama || "");
        const sub = safeText(cat.subkategori || cat.subcategory || "");

        let label = "";
        const lower = nameRaw.toLowerCase();
        if (lower === "internal" || lower === "eksternal") {
          label = sub || nameRaw;
        } else {
          label = nameRaw || sub || id;
        }
        label = label || "Umum";

        categoryMap[id] = label;
        labels.add(label);
      });

      if (filterBidang) {
        const existing = Array.from(filterBidang.options || []).map((o) => o.value);
        const onlyDefault = existing.length <= 1;

        if (onlyDefault) {
          if (filterBidang.options.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "Semua Bidang";
            filterBidang.appendChild(opt);
          }

          [...labels].sort((a, b) => a.localeCompare(b, "id")).forEach((label) => {
            const opt = document.createElement("option");
            opt.value = label;
            opt.textContent = label;
            filterBidang.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.warn("Gagal memuat /categories:", err);
    }
  }

  function getBidangLabel(art) {
    const catId = safeText(
      pickField(art, ["categoryId", "category_id", "category._id", "category.id"], "")
    );
    if (catId && categoryMap[catId]) return categoryMap[catId];

    const direct = safeText(pickField(art, ["kategori", "bidang", "category.name", "category"], ""));
    if (direct) return direct;

    if (catId.includes("-")) {
      const tail = catId.split("-").slice(1).join(" ").trim();
      if (tail) return tail.replace(/\b\w/g, (m) => m.toUpperCase());
    }

    return "Umum";
  }

  // ==========================
  // Document
  // ==========================
  function getDokumenRaw(art) {
    let raw =
      pickField(art, ["dokumenUrl", "dokumen_url", "documentUrl", "document_url"], "") ||
      pickField(art, ["dokumen", "file", "attachment", "fileUrl", "file_url", "document"], "");

    if (raw && typeof raw === "object") {
      raw = raw.url || raw.path || raw.location || raw.href || raw.filename || "";
    }

    raw = safeText(raw);
    raw = normalizePath(raw);
    if (!raw) return "";
    if (raw.toLowerCase().includes("example.com")) return "";
    return raw;
  }

  // ✅ Kandidat dibuat agar /uploads jadi NOMOR 1
  function buildDocCandidates(articleId, raw) {
    raw = normalizePath(raw);
    if (!raw) return [];

    if (raw.startsWith("http://") || raw.startsWith("https://")) return [raw];

    const rawNoLeading = raw.replace(/^\/+/, "");
    const filename = rawNoLeading.includes("/") ? rawNoLeading.split("/").pop() : rawNoLeading;
    const encodedFile = encodeURIComponent(filename).replace(/%2F/g, "/");

    const candidates = [];

    // 1) paling prioritas: sesuai gin static
    candidates.push(`${API_BASE}/uploads/${encodedFile}`);

    // 2) kalau raw sudah "uploads/xxx.pdf" atau path lain, coba persis itu
    candidates.push(`${API_BASE}/${rawNoLeading}`);

    // 3) raw apa adanya (tetap ada)
    candidates.push(normalizeUrl(raw));

    // base folder umum (tetap)
    const bases = [
      "uploads",
      "upload",
      "docs",
      "documents",
      "files",
      "public/uploads",
      "public/docs",
      "static/uploads",
      "static/docs",
      "assets/uploads",
      "assets/docs",
    ];
    bases.forEach((b) => candidates.push(`${API_BASE}/${b}/${encodedFile}`));

    // endpoint alternatif (tetap)
    candidates.push(`${API_BASE}/articles/${articleId}/dokumen`);
    candidates.push(`${API_BASE}/articles/${articleId}/document`);
    candidates.push(`${API_BASE}/articles/${articleId}/download`);
    candidates.push(`${API_BASE}/articles/download/${articleId}`);
    candidates.push(`${API_BASE}/download/${encodedFile}`);
    candidates.push(`${API_BASE}/files/${encodedFile}`);

    return [...new Set(candidates)];
  }

  async function tryFetchOk(url) {
    try {
      const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function resolveDocUrl(candidates) {
    for (const u of candidates) {
      const ok = await tryFetchOk(u);
      if (ok) return u;
    }
    return "";
  }

  function getDokumenName(art, resolvedUrl, raw) {
    const name =
      safeText(pickField(art, ["dokumenName", "dokumen_name", "documentName", "document_name"], "")) ||
      safeText(pickField(art, ["filename", "fileName", "file_name"], "")) ||
      (resolvedUrl ? guessFileNameFromUrl(resolvedUrl) : raw ? raw.split("/").pop() : "dokumen");
    return name || "dokumen";
  }

  // ======= (kode lama tetap ada) =======
  async function fetchAsBlob(url) {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  }

  async function openBlobInNewTab(blob) {
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }

  async function downloadBlob(blob, filename) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "dokumen";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
  // ====================================

  // ✅ direct open
  function openUrlInNewTab(url) {
    window.open(url, "_blank", "noopener");
  }

  // ✅ NEW: unduh “paksa download”
  async function forceDownload(url, filename) {
    // 1) coba paksa download via blob (paling auto-download)
    try {
      const blob = await fetchAsBlob(url);
      await downloadBlob(blob, filename || guessFileNameFromUrl(url));
      return true;
    } catch (e) {
      // 2) fallback: buka url (kadang browser preview pdf)
      // tetap kita coba trigger anchor download (walau cross-origin bisa di-ignore)
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || guessFileNameFromUrl(url);
        a.target = "_self";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {}
      return false;
    }
  }

  // ==========================
  // Render UI
  // ==========================
  async function renderArticles() {
    if (!artikelList) return;

    const selectedBidang = safeText(filterBidang?.value || "");
    let filtered = allArticles;

    if (selectedBidang && selectedBidang.toLowerCase() !== "semua bidang") {
      filtered = allArticles.filter(
        (a) => getBidangLabel(a).toLowerCase() === selectedBidang.toLowerCase()
      );
    }

    if (!filtered.length) {
      artikelList.innerHTML = `
        <p style="text-align:center; color:#555; margin-top:20px;">
          Belum ada artikel untuk filter ini.
        </p>
      `;
      return;
    }

    docCandidatesById.clear();
    resolvedDocUrlById.clear();

    filtered.forEach((art) => {
      const id = String(art._id || art.id || art.article_id || "");
      const raw = getDokumenRaw(art);
      docCandidatesById.set(id, buildDocCandidates(id, raw));
    });

    artikelList.innerHTML = filtered
      .map((art) => {
        const id = String(art._id || art.id || art.article_id || "");
        const judul = String(pickField(art, ["judul", "title", "nama"], "Tanpa Judul"));
        const isi = String(pickField(art, ["isi", "content", "deskripsi", "body"], ""));
        const ringkas = isi.length > 220 ? isi.slice(0, 217).trimEnd() + "..." : isi;

        const bidang = getBidangLabel(art);

        // ✅ FIX: kalau penulis kosong, jangan jadi "" (biar ga hilang)
        const penulis = pickNonEmpty(
          art,
          ["penulis", "author", "createdBy", "created_by", "authorName", "nama_penulis", "penulis_nama"],
          "Admin EducLex"
        );

        const tanggalRaw = pickField(art, ["tanggal", "createdAt", "created_at"], "");
        const tanggal = formatTanggal(tanggalRaw);

        const rawDoc = getDokumenRaw(art);
        const hasDokumen = !!rawDoc;

        const candidates = docCandidatesById.get(id) || [];
        const docGuess = candidates[0] || "";
        const docName = getDokumenName(art, docGuess, rawDoc);

        return `
          <article class="artikel-card" data-id="${id}" data-docname="${docName}">
            <div class="pdf-icon-box"
                 style="
                  width: 110px;
                  height: 140px;
                  margin: 0 auto 18px;
                  background-image: url('${PDF_ICON_URL}');
                  background-size: contain;
                  background-position: center;
                  background-repeat: no-repeat;
                 "></div>

            <div class="artikel-body" style="max-width:95%;margin:0 auto;">
              <div class="artikel-header-box"
                   style="
                    border-radius: 14px;
                    border: 1px solid #f0e2d9;
                    background: #fff7f2;
                    padding: 10px 16px 12px;
                    margin-bottom: 14px;
                   ">
                <p class="artikel-kategori"
                   style="
                    text-transform:uppercase;
                    font-size:12px;
                    letter-spacing:1.2px;
                    color:#a1887f;
                    margin:0 0 4px;
                    text-align:center;
                   ">${bidang}</p>

                <h3 class="artikel-title"
                    style="
                      font-size:19px;
                      font-weight:600;
                      color:#4e342e;
                      text-align:center;
                      margin:0 0 6px;
                    ">${judul}</h3>

                <p class="artikel-meta"
                   style="
                    font-size:12px;
                    color:#7b5a4a;
                    text-align:center;
                    margin:0;
                   ">
                  <span>${penulis}</span>
                  <span style="margin:0 6px;">•</span>
                  <span>${tanggal}</span>
                </p>
              </div>

              <div class="artikel-divider"
                   style="height:1px; background:#f0e2d9; margin:0 auto 14px; width:80%;"></div>

              <p class="artikel-excerpt"
                 style="
                  font-size:14px;
                  line-height:1.6;
                  color:#4a4a4a;
                  text-align:justify;
                  margin-bottom:16px;
                 ">${ringkas}</p>

              ${
                hasDokumen
                  ? `
                <div class="artikel-doc"
                     style="
                      margin-bottom:16px;
                      display:flex;
                      justify-content:center;
                      gap:10px;
                      flex-wrap:wrap;
                     ">
                  <button type="button" class="dokumen-action dokumen-lihat" data-id="${id}"
                     style="
                      display:inline-flex;
                      align-items:center;
                      gap:6px;
                      padding:8px 16px;
                      border-radius:999px;
                      border:1px solid #5d4037;
                      font-size:13px;
                      font-weight:600;
                      color:#5d4037;
                      background-color:#fbe9e7;
                      cursor:pointer;
                     ">
                    <span style="font-size:14px;">👁</span>
                    <span>Lihat</span>
                  </button>

                  <button type="button" class="dokumen-action dokumen-unduh" data-id="${id}"
                     style="
                      display:inline-flex;
                      align-items:center;
                      gap:6px;
                      padding:8px 16px;
                      border-radius:999px;
                      border:1px solid #4e342e;
                      font-size:13px;
                      font-weight:600;
                      color:#ffffff;
                      background-color:#5d4037;
                      cursor:pointer;
                     ">
                    <span style="font-size:14px;">⬇</span>
                    <span>Unduh</span>
                  </button>
                </div>`
                  : ""
              }

              <div style="text-align:center;">
                <button class="btn-detail" data-id="${id}"
                        style="
                          display:inline-flex;
                          align-items:center;
                          gap:6px;
                          padding:10px 20px;
                          border-radius:999px;
                          border:none;
                          background-color:#5d4037;
                          color:#fff;
                          font-size:14px;
                          cursor:pointer;
                        ">
                  <span>📖 Baca Selengkapnya</span>
                  <span class="arrow">➜</span>
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ==========================
  // Modal
  // ==========================
  function openModalById(id) {
    const art = allArticles.find((a) => String(a._id || a.id || a.article_id || "") === String(id));
    if (!art || !modal) return;

    const judul = String(pickField(art, ["judul", "title", "nama"], "Tanpa Judul"));
    const isi = String(pickField(art, ["isi", "content", "deskripsi", "body"], "(Konten belum tersedia)"));

    modalTitle.textContent = judul;
    modalContent.textContent = isi;

    if (modalImage) {
      modalImage.style.display = "none";
      modalImage.removeAttribute("src");
      modalImage.removeAttribute("alt");
    }

    const rawDoc = getDokumenRaw(art);
    if (rawDoc) {
      modalFile.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
          <button type="button" class="dokumen-action dokumen-lihat" data-id="${id}"
             style="
              display:inline-flex;
              align-items:center;
              gap:6px;
              padding:8px 14px;
              border-radius:999px;
              border:1px solid #5d4037;
              font-size:13px;
              font-weight:600;
              background:#fbe9e7;
              color:#5d4037;
              cursor:pointer;
             ">
            <span style="font-size:14px;">👁</span>
            <span>Lihat</span>
          </button>

          <button type="button" class="dokumen-action dokumen-unduh" data-id="${id}"
             style="
              display:inline-flex;
              align-items:center;
              gap:6px;
              padding:8px 14px;
              border-radius:999px;
              border:1px solid #4e342e;
              font-size:13px;
              font-weight:600;
              background:#5d4037;
              color:#fff;
              cursor:pointer;
             ">
            <span style="font-size:14px;">⬇</span>
            <span>Unduh</span>
          </button>
        </div>
      `;
    } else {
      modalFile.innerHTML = "";
    }

    modal.style.display = "block";
  }

  // ==========================
  // Document Action
  // ==========================
  async function handleDocAction(articleId, mode) {
    const id = String(articleId);
    const art = allArticles.find((a) => String(a._id || a.id || a.article_id || "") === id);
    if (!art) return;

    const raw = getDokumenRaw(art);
    const filename = raw ? safeText(raw.split("/").pop()) : "";

    // 1) kalau sudah resolved
    if (resolvedDocUrlById.has(id)) {
      const resolved = resolvedDocUrlById.get(id);
      const name = filename || guessFileNameFromUrl(resolved);

      if (mode === "lihat") {
        openUrlInNewTab(resolved);
        return;
      } else {
        const ok = await forceDownload(resolved, name);
        if (!ok) {
          showToast(
            "Unduh otomatis tidak bisa (kemungkinan CORS/Browser). File sudah dibuka, silakan download dari viewer browser."
          );
          openUrlInNewTab(resolved);
        }
        return;
      }
    }

    // 2) resolve dari kandidat
    const candidates = docCandidatesById.get(id) || buildDocCandidates(id, raw);
    const resolved = await resolveDocUrl(candidates);

    if (resolved) {
      resolvedDocUrlById.set(id, resolved);
      const name = filename || guessFileNameFromUrl(resolved);

      if (mode === "lihat") {
        openUrlInNewTab(resolved);
        return;
      } else {
        const ok = await forceDownload(resolved, name);
        if (!ok) {
          showToast(
            "Unduh otomatis tidak bisa (kemungkinan CORS/Browser). File sudah dibuka, silakan download dari viewer browser."
          );
          openUrlInNewTab(resolved);
        }
        return;
      }
    }

    // 3) fallback IndexedDB by article id
    const cachedById = await idbGet(`article:${id}`);
    if (cachedById?.data && cachedById?.mime) {
      const blob = new Blob([cachedById.data], { type: cachedById.mime });
      if (mode === "lihat") await openBlobInNewTab(blob);
      else await downloadBlob(blob, cachedById.name || filename || "dokumen");
      return;
    }

    // 4) fallback IndexedDB by filename
    if (filename) {
      const cachedByFile = await idbGet(`file:${filename}`);
      if (cachedByFile?.data && cachedByFile?.mime) {
        const blob = new Blob([cachedByFile.data], { type: cachedByFile.mime });
        if (mode === "lihat") await openBlobInNewTab(blob);
        else await downloadBlob(blob, cachedByFile.name || filename || "dokumen");
        return;
      }
    }

    // 5) mentok
    showToast(
      "Masih belum bisa akses file.\n\n" +
        "Pastikan file bisa dibuka manual:\n" +
        "http://localhost:8080/uploads/NAMA_FILE.pdf"
    );
  }

  // ==========================
  // Load Articles
  // ==========================
  async function loadArticles() {
    if (artikelList) {
      artikelList.innerHTML = `
        <p style="text-align:center; color:#555; margin-top:20px;">⏳ Memuat artikel...</p>
      `;
    }

    await loadCategories();

    try {
      const res = await fetch(`${API_BASE}/articles`, { method: "GET" });
      const raw = await res.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.articles)) list = data.articles;

      if (!res.ok) {
        console.error("❌ Error GET /articles:", data);
        if (artikelList) {
          artikelList.innerHTML = `
            <p style="text-align:center; color:#d32f2f; margin-top:20px;">
              Gagal memuat artikel. Coba beberapa saat lagi.
            </p>
          `;
        }
        return;
      }

      allArticles = Array.isArray(list) ? list : [];
      await renderArticles();
    } catch (err) {
      console.error("❌ FETCH ERROR /articles:", err);
      if (artikelList) {
        artikelList.innerHTML = `
          <p style="text-align:center; color:#d32f2f; margin-top:20px;">
            Tidak dapat terhubung ke server.
          </p>
        `;
      }
    }
  }

  // ==========================
  // Events
  // ==========================
  if (filterBidang) filterBidang.addEventListener("change", () => renderArticles());

  if (artikelList) {
    artikelList.addEventListener("click", async (e) => {
      const btn = e.target.closest(".btn-detail");
      if (btn) {
        const id = btn.getAttribute("data-id");
        if (id) openModalById(id);
        return;
      }

      const docBtn = e.target.closest(".dokumen-action");
      if (docBtn) {
        const id = docBtn.getAttribute("data-id");
        if (!id) return;

        if (docBtn.classList.contains("dokumen-lihat")) await handleDocAction(id, "lihat");
        else await handleDocAction(id, "unduh");
      }
    });
  }

  if (modalClose) {
    modalClose.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    modal.addEventListener("click", async (e) => {
      const docBtn = e.target.closest(".dokumen-action");
      if (!docBtn) return;
      const id = docBtn.getAttribute("data-id");
      if (!id) return;

      if (docBtn.classList.contains("dokumen-lihat")) await handleDocAction(id, "lihat");
      else await handleDocAction(id, "unduh");
    });
  }

  // init
  loadArticles();
});
