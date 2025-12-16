// /user/peraturan/fetch/peraturan.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";
  const container = document.getElementById("peraturanContainer");

  const PDF_ICON_URL = "/assets/img/pdf.png";

  let categoryMapById = {}; // id -> {name, subkategori}
  let categoriesLoaded = false;

  if (container) {
    container.classList.add("peraturan-root");
  }

  // ==========================
  // Helper URL dokumen
  // ==========================
  function normalizeUrl(raw) {
    if (!raw) return "";

    let url = String(raw).trim();

    // samakan slash & buang leading "./"
    url = url.replace(/\\/g, "/").replace(/^\.\//, "");

    // kalau sudah full URL, encode & balikin
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const encoded = encodeURI(url);
      console.log("🔗 Dokumen path (full):", url, "=>", encoded);
      return encoded;
    }

    // kalau belum ada "/" di depan, tambahkan
    if (!url.startsWith("/")) {
      url = "/" + url;
    }

    const full = API_BASE + url;
    const encodedFull = encodeURI(full);

    console.log("🔗 Dokumen path normalisasi:", raw, "=>", encodedFull);
    return encodedFull;
  }

  // Format tanggal → dd/mm/yy (fallback ke hari ini)
  function formatTanggal(tanggalRaw) {
    let d = null;

    if (tanggalRaw) {
      const parsed = new Date(tanggalRaw);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
        d = parsed;
      }
    }

    if (!d) d = new Date();

    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
  }

  function labelJenis(jenisRaw) {
    if (!jenisRaw) return "";
    const lower = String(jenisRaw).toLowerCase();
    if (lower === "internal") return "Internal";
    if (lower === "eksternal") return "Eksternal";
    return jenisRaw;
  }

  // ==========================
  // Load categories untuk mapping FE
  // ==========================
  async function loadCategories() {
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!Array.isArray(data)) {
        categoriesLoaded = true;
        return;
      }

      categoryMapById = {};
      data.forEach((c) => {
        const id = c._id || c.id || c.categoryId;
        if (!id) return;
        categoryMapById[String(id)] = {
          name: c.name || "",
          subkategori: c.subkategori || ""
        };
      });

      categoriesLoaded = true;
    } catch (err) {
      console.warn("Gagal memuat /categories untuk FE:", err);
      categoriesLoaded = true;
    }
  }

  // ==========================
  // Normalisasi 1 peraturan
  // ==========================
  function normalizePeraturan(p) {
    const judul = p.judul || "-";
    const isi = p.isi || p.content || "";

    let jenisRaw = p.kategori || p.kategoriUtama || "";
    let bidang = p.bidang || p.kategoriDetail || p.subkategori || "";

    const categoryId =
      p.categoryId ||
      p.category_id ||
      (p.category && (p.category._id || p.category.id));

    if (categoryId && categoryMapById[String(categoryId)]) {
      const cat = categoryMapById[String(categoryId)];
      if (!jenisRaw && cat.name) jenisRaw = cat.name;
      if (!bidang && cat.subkategori) bidang = cat.subkategori;
    }

    if (p.category && (p.category.name || p.category.subkategori)) {
      if (!jenisRaw && p.category.name) jenisRaw = p.category.name;
      if (!bidang && p.category.subkategori)
        bidang = p.category.subkategori;
    }

    const jenis = labelJenis(jenisRaw);

    const tanggalRaw = p.tanggal || p.created_at || p.createdAt || null;

    const dokumenRaw =
      p.dokumen_url ||
      p.dokumen ||
      p.file ||
      p.documentUrl ||
      p.attachment ||
      "";

    const isiParts = isi
      .split(/\n{2,}|\r\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);

    let kategoriLabel;
    if (jenis && bidang) {
      kategoriLabel = `${jenis} • ${bidang}`;
    } else if (bidang) {
      kategoriLabel = bidang;
    } else if (jenis) {
      kategoriLabel = jenis;
    } else {
      kategoriLabel = "Umum";
    }

    const firstParagraph = isiParts[0] || "";
    const excerpt =
      firstParagraph.length > 220
        ? firstParagraph.slice(0, 217).trimEnd() + "..."
        : firstParagraph;

    return {
      judul,
      kategori: kategoriLabel,
      jenis,
      bidang,
      tanggalRaw,
      tanggalFormatted: formatTanggal(tanggalRaw),
      isiParts,
      excerpt,
      dokumenUrl: dokumenRaw ? normalizeUrl(dokumenRaw) : ""
    };
  }

  // ==========================
  // Render card peraturan
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

    const cardsHtml = list
      .map((p, index) => {
        const bodyHtmlText = p.isiParts
          .map((par) => `<p>${par}</p>`)
          .join("");

        const hasDoc = !!p.dokumenUrl;

        const docHtml = hasDoc
          ? `
            <div class="artikel-doc-actions peraturan-doc-actions">
              <a
                href="${p.dokumenUrl}"
                target="_blank"
                rel="noopener"
                class="btn-doc btn-lihat"
              >
                <span>👁 Lihat</span>
              </a>
              <a
                href="${p.dokumenUrl}"
                target="_blank"
                download
                class="btn-doc btn-unduh"
              >
                <span>⬇ Unduh</span>
              </a>
            </div>
          `
          : "";

        return `
          <article class="artikel-card peraturan-card" data-index="${index}">
            ${
              hasDoc
                ? `
            <div
              class="pdf-icon-box"
              style="
                width: 120px;
                height: 150px;
                margin: 0 auto 16px;
                background-image: url('${PDF_ICON_URL}');
                background-size: contain;
                background-position: center;
                background-repeat: no-repeat;
              "
            ></div>`
                : ""
            }

            <div class="artikel-body">
              <div class="artikel-header-box">
                <p class="artikel-kategori">${p.kategori}</p>
                <h3 class="artikel-title">${p.judul}</h3>
                <p class="artikel-meta">
                  <span>Peraturan Hukum</span>
                  <span>•</span>
                  <span>${p.tanggalFormatted}</span>
                </p>
              </div>

              <hr class="artikel-separator" />

              <p class="artikel-excerpt">${p.excerpt}</p>

              ${docHtml}

              <button
                class="btn-detail btn-detail-peraturan"
                type="button"
                data-index="${index}"
              >
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

    container.innerHTML = `
      <div class="artikel-grid peraturan-grid">
        ${cardsHtml}
      </div>
    `;
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

    if (!categoriesLoaded) {
      await loadCategories().catch(() => {});
    }

    try {
      const res = await fetch(`${API_BASE}/peraturan`, {
        method: "GET"
      });

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

      const data = await res.json().catch(() => []);
      let normalized = (Array.isArray(data) ? data : []).map(normalizePeraturan);

      // urutkan dari terbaru
      normalized = normalized.sort((a, b) => {
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

  loadPeraturan();

  // ==========================
  // Toggle "Baca Selengkapnya"
  // ==========================
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-detail-peraturan");
    if (!btn) return;

    const idx = btn.getAttribute("data-index");
    if (idx == null) return;

    const full = document.querySelector(
      `.peraturan-full[data-index="${idx}"]`
    );
    if (!full) return;

    const textSpan = btn.querySelector(".btn-detail-text");
    const isShown = full.style.display === "block";

    full.style.display = isShown ? "none" : "block";

    if (textSpan) {
      textSpan.textContent = isShown
        ? "📖 Baca Selengkapnya"
        : "⬆ Tutup Ringkasan";
    }

    btn.classList.toggle("expanded", !isShown);
  });
});
