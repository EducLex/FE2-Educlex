// /user/peraturan/fetch/peraturan.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";
  const container = document.getElementById("peraturanContainer");
  const PDF_ICON_URL = "/assets/img/pdf.png";

  let categoryMapById = {}; // id -> {name, subkategori}
  let categoriesLoaded = false;

  // untuk resolve dokumen per index
  const docCandidatesByIndex = new Map(); // index -> [url...]
  const resolvedDocUrlByIndex = new Map(); // index -> url

  if (container) container.classList.add("peraturan-root");

  // ==========================
  // Helpers
  // ==========================
  function safeText(v) {
    return String(v ?? "").trim();
  }

  function normalizePath(p) {
    return String(p || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  }

  function normalizeUrl(raw) {
    if (!raw) return "";
    let url = normalizePath(raw);
    if (!url) return "";

    // kalau sudah full URL
    if (url.startsWith("http://") || url.startsWith("https://")) return url;

    // pastikan ada leading /
    if (!url.startsWith("/")) url = "/" + url;
    return API_BASE + url;
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

  function formatTanggal(tanggalRaw) {
    let d = null;
    if (tanggalRaw) {
      const parsed = new Date(tanggalRaw);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) d = parsed;
    }
    if (!d) d = new Date();

    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  function labelJenis(jenisRaw) {
    if (!jenisRaw) return "";
    const lower = String(jenisRaw).toLowerCase();
    if (lower === "internal") return "Internal";
    if (lower === "eksternal") return "Eksternal";
    return jenisRaw;
  }

  // ==========================
  // Kandidat URL dokumen (dibuat mirip artikel: /uploads paling depan)
  // ==========================
  function buildDocCandidates(raw) {
    raw = normalizePath(raw);
    if (!raw) return [];
    if (raw.startsWith("http://") || raw.startsWith("https://")) return [raw];

    const rawNoLeading = raw.replace(/^\/+/, "");
    const filename = rawNoLeading.includes("/") ? rawNoLeading.split("/").pop() : rawNoLeading;
    const encodedFile = encodeURIComponent(filename).replace(/%2F/g, "/");

    const candidates = [];

    // prioritas: gin static /uploads
    candidates.push(`${API_BASE}/uploads/${encodedFile}`);

    // raw persis
    candidates.push(`${API_BASE}/${rawNoLeading}`);
    candidates.push(normalizeUrl(raw));

    // alternatif umum
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

    // endpoint alternatif (kalau suatu saat dibuat)
    candidates.push(`${API_BASE}/peraturan/download/${encodedFile}`);
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

  function openUrlInNewTab(url) {
    window.open(url, "_blank", "noopener");
  }

  // ✅ Unduh yang bener: coba blob dulu (auto-download). Kalau gagal (CORS), fallback open tab.
  async function forceDownload(url, filename) {
    try {
      const blob = await fetchAsBlob(url);
      await downloadBlob(blob, filename || guessFileNameFromUrl(url));
      return true;
    } catch (e) {
      // fallback: tetap buka (user bisa save manual)
      openUrlInNewTab(url);
      return false;
    }
  }

  // ==========================
  // Load categories untuk mapping
  // ==========================
  async function loadCategories() {
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

      categoryMapById = {};
      (Array.isArray(list) ? list : []).forEach((c) => {
        const id = c._id || c.id || c.categoryId;
        if (!id) return;
        categoryMapById[String(id)] = { name: c.name || "", subkategori: c.subkategori || "" };
      });

      categoriesLoaded = true;
    } catch (err) {
      console.warn("Gagal memuat /categories untuk FE:", err);
      categoriesLoaded = true;
    }
  }

  // ==========================
  // Normalisasi peraturan
  // ==========================
  function normalizePeraturan(p) {
    const judul = p.judul || p.title || "-";
    const isi = p.isi || p.content || "";

    let jenisRaw = p.kategori || p.kategoriUtama || p.jenis || p.type || "";
    let bidang = p.bidang || p.kategoriDetail || p.subkategori || p.subKategori || "";

    const categoryId =
      p.categoryId || p.category_id || (p.category && (p.category._id || p.category.id));

    if (categoryId && categoryMapById[String(categoryId)]) {
      const cat = categoryMapById[String(categoryId)];
      if (!jenisRaw && cat.name) jenisRaw = cat.name;
      if (!bidang && cat.subkategori) bidang = cat.subkategori;
    }

    if (p.category && (p.category.name || p.category.subkategori)) {
      if (!jenisRaw && p.category.name) jenisRaw = p.category.name;
      if (!bidang && p.category.subkategori) bidang = p.category.subkategori;
    }

    const jenis = labelJenis(jenisRaw);
    const tanggalRaw = p.tanggal || p.created_at || p.createdAt || null;

    const dokumenRaw =
      p.dokumen_url || p.dokumenUrl || p.dokumen || p.file || p.documentUrl || p.attachment || "";

    const isiParts = String(isi)
      .split(/\n{2,}|\r\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);

    const kategoriLabel = jenis && bidang ? `${jenis} • ${bidang}` : bidang || jenis || "Umum";

    const firstParagraph = isiParts[0] || "";
    const excerpt =
      firstParagraph.length > 220 ? firstParagraph.slice(0, 217).trimEnd() + "..." : firstParagraph;

    return {
      judul,
      kategori: kategoriLabel,
      tanggalRaw,
      tanggalFormatted: formatTanggal(tanggalRaw),
      isiParts,
      excerpt,
      dokumenRaw: safeText(dokumenRaw),
    };
  }

  // ==========================
  // Render UI
  // ==========================
  function renderPeraturan(list) {
    if (!container) return;

    if (!Array.isArray(list) || list.length === 0) {
      container.innerHTML = `
        <p class="loading-text"
           style="font-weight:600; font-family:'Poppins','Segoe UI',sans-serif; color:#c0392b; text-align:center;">
          Tidak ada data peraturan yang tersedia.
        </p>
      `;
      return;
    }

    docCandidatesByIndex.clear();
    resolvedDocUrlByIndex.clear();

    list.forEach((p, idx) => {
      const raw = p.dokumenRaw;
      docCandidatesByIndex.set(idx, buildDocCandidates(raw));
    });

    const cardsHtml = list
      .map((p, index) => {
        const bodyHtmlText = p.isiParts.map((par) => `<p>${par}</p>`).join("");
        const hasDoc = !!p.dokumenRaw;

        const docHtml = hasDoc
          ? `
            <div class="artikel-doc-actions peraturan-doc-actions"
                 style="margin-top:14px; display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
              <button type="button" class="dokumen-action dokumen-lihat btn-doc btn-lihat" data-index="${index}">
                <span>👁 Lihat</span>
              </button>
              <button type="button" class="dokumen-action dokumen-unduh btn-doc btn-unduh" data-index="${index}">
                <span>⬇ Unduh</span>
              </button>
            </div>
          `
          : "";

        return `
          <article class="artikel-card peraturan-card" data-index="${index}">
            ${
              hasDoc
                ? `
              <div class="pdf-icon-box"
                   style="
                    width: 120px; height: 150px; margin: 0 auto 16px;
                    background-image: url('${PDF_ICON_URL}');
                    background-size: contain; background-position: center; background-repeat: no-repeat;">
              </div>`
                : ""
            }

            <div class="artikel-body">
              <div class="artikel-header-box">
                <p class="artikel-kategori">${p.kategori}</p>
                <h3 class="artikel-title">${p.judul}</h3>
                <p class="artikel-meta">
                  <span>Peraturan Hukum</span>
                  <span style="margin:0 6px;">•</span>
                  <span>${p.tanggalFormatted}</span>
                </p>
              </div>

              <hr class="artikel-separator" />

              <p class="artikel-excerpt">${p.excerpt}</p>

              ${docHtml}

              <button class="btn-detail btn-detail-peraturan" type="button" data-index="${index}">
                <span class="btn-detail-text">📖 Baca Selengkapnya</span>
                <span class="arrow">➜</span>
              </button>

              <div class="peraturan-full" data-index="${index}" style="display:none; margin-top:14px;">
                ${bodyHtmlText}
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    container.innerHTML = `<div class="artikel-grid peraturan-grid">${cardsHtml}</div>`;
  }

  // ==========================
  // GET /peraturan
  // ==========================
  async function loadPeraturan() {
    if (container) {
      container.innerHTML = `
        <p class="loading-text"
           style="font-weight:600; font-family:'Poppins','Segoe UI',sans-serif; color:#777; text-align:center;">
          Memuat data peraturan...
        </p>
      `;
    }

    if (!categoriesLoaded) await loadCategories().catch(() => {});

    try {
      const res = await fetch(`${API_BASE}/peraturan`, { method: "GET" });
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
      else if (Array.isArray(data.peraturan)) list = data.peraturan;

      if (!res.ok) {
        if (container) {
          container.innerHTML = `
            <p class="loading-text"
               style="font-weight:600; font-family:'Poppins','Segoe UI',sans-serif; color:#c0392b; text-align:center;">
              Gagal memuat data peraturan.
            </p>
          `;
        }
        return;
      }

      let normalized = (Array.isArray(list) ? list : []).map(normalizePeraturan);

      normalized.sort((a, b) => {
        const da = a.tanggalRaw ? new Date(a.tanggalRaw).getTime() : 0;
        const db = b.tanggalRaw ? new Date(b.tanggalRaw).getTime() : 0;
        return db - da;
      });

      renderPeraturan(normalized);
    } catch (err) {
      console.error("❌ Error GET /peraturan:", err);
      if (container) {
        container.innerHTML = `
          <p class="loading-text"
             style="font-weight:600; font-family:'Poppins','Segoe UI',sans-serif; color:#c0392b; text-align:center;">
            Gagal terhubung ke server.
          </p>
        `;
      }
    }
  }

  // ==========================
  // Actions dokumen: Lihat / Unduh
  // ==========================
  async function handleDocAction(index, mode) {
    const idx = Number(index);
    const candidates = docCandidatesByIndex.get(idx) || [];
    if (!candidates.length) return;

    // 1) kalau sudah resolved
    if (resolvedDocUrlByIndex.has(idx)) {
      const url = resolvedDocUrlByIndex.get(idx);
      if (mode === "lihat") {
        openUrlInNewTab(url);
        return;
      } else {
        await forceDownload(url, guessFileNameFromUrl(url));
        return;
      }
    }

    // 2) resolve dulu
    const resolved = await resolveDocUrl(candidates);
    if (resolved) {
      resolvedDocUrlByIndex.set(idx, resolved);
      if (mode === "lihat") {
        openUrlInNewTab(resolved);
      } else {
        await forceDownload(resolved, guessFileNameFromUrl(resolved));
      }
      return;
    }

    alert(
      "Dokumen tidak ditemukan (404).\n\nPastikan file bisa dibuka manual:\n" +
        "http://localhost:8080/uploads/NAMA_FILE.pdf"
    );
  }

  // ==========================
  // Events
  // ==========================
  document.addEventListener("click", async (e) => {
    // toggle detail
    const btn = e.target.closest(".btn-detail-peraturan");
    if (btn) {
      const idx = btn.getAttribute("data-index");
      const full = document.querySelector(`.peraturan-full[data-index="${idx}"]`);
      if (!full) return;

      const textSpan = btn.querySelector(".btn-detail-text");
      const isShown = full.style.display === "block";
      full.style.display = isShown ? "none" : "block";

      if (textSpan) textSpan.textContent = isShown ? "📖 Baca Selengkapnya" : "⬆ Tutup Ringkasan";
      btn.classList.toggle("expanded", !isShown);
      return;
    }

    // dokumen actions
    const docBtn = e.target.closest(".dokumen-action");
    if (!docBtn) return;

    const idx = docBtn.getAttribute("data-index");
    if (idx == null) return;

    if (docBtn.classList.contains("dokumen-lihat")) await handleDocAction(idx, "lihat");
    else await handleDocAction(idx, "unduh");
  });

  loadPeraturan();
});
