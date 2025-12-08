// /user/artikel/fetch/artikel.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const artikelList = document.getElementById("artikelList");
  const filterBidang = document.getElementById("filterBidang");

  const modal = document.getElementById("artikelModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalImage = document.getElementById("modalImage");
  const modalContent = document.getElementById("modalContent");
  const modalFile = document.getElementById("modalFile");
  const modalClose = document.querySelector("#artikelModal .close");

  let allArticles = [];

  // ===============================
  // Helper ambil field fleksibel
  // ===============================
  function pickField(obj, keys, fallback = "") {
    if (!obj) return fallback;
    for (const k of keys) {
      const parts = k.split(".");
      let val = obj;
      for (const p of parts) {
        if (val && Object.prototype.hasOwnProperty.call(val, p)) {
          val = val[p];
        } else {
          val = undefined;
          break;
        }
      }
      if (val !== undefined && val !== null) return String(val);
    }
    return fallback;
  }

  function getBidang(art) {
    return (
      pickField(art, ["bidang", "kategori", "category", "category.name"], "") ||
      ""
    );
  }

  // Normalisasi URL (kalau hanya path)
  function normalizeUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return API_BASE + url;
    return url;
  }

  // ===============================
  // Render kartu artikel
  // ===============================
  function renderArticles() {
    if (!artikelList) return;

    const selectedBidang = (filterBidang?.value || "").trim();
    let filtered = allArticles;

    if (selectedBidang) {
      filtered = allArticles.filter((a) => {
        const bidang = getBidang(a);
        return bidang.toLowerCase() === selectedBidang.toLowerCase();
      });
    }

    if (!filtered.length) {
      artikelList.innerHTML = `
        <p style="text-align:center; color:#555; margin-top:20px;">
          Belum ada artikel untuk filter ini.
        </p>
      `;
      return;
    }

    artikelList.innerHTML = filtered
      .map((art) => {
        const id = art._id || art.id || art.article_id || "";
        const judul = pickField(art, ["judul", "title", "nama"], "Tanpa Judul");
        const isi = pickField(
          art,
          ["isi", "content", "deskripsi", "body"],
          ""
        );
        const ringkas =
          isi.length > 160 ? isi.slice(0, 157).trimEnd() + "..." : isi;

        const bidang = getBidang(art) || "Umum";
        const penulis = pickField(
          art,
          ["penulis", "author", "createdBy"],
          "EducLex"
        );
        const tanggalRaw = pickField(
          art,
          ["tanggal", "createdAt", "created_at"],
          ""
        );
        const tanggal = tanggalRaw
          ? new Date(tanggalRaw).toLocaleDateString("id-ID")
          : "-";

        const gambar = normalizeUrl(
          pickField(art, ["gambar", "imageUrl", "image", "thumbnail"], "")
        );
        const dokumen = normalizeUrl(
          pickField(art, ["dokumen", "file", "documentUrl", "attachment"], "")
        );

        const hasDokumen = !!dokumen;

        return `
          <article class="artikel-card" data-id="${id}">
            ${
              gambar
                ? `<div class="artikel-thumb">
                     <img src="${gambar}" alt="${judul}">
                   </div>`
                : ""
            }
            <div class="artikel-body">
              <h3>${judul}</h3>
              <p class="artikel-meta">
                <span>${penulis}</span> · 
                <span>${tanggal}</span> · 
                <span>${bidang}</span>
              </p>
              <p class="artikel-excerpt">${ringkas}</p>

              ${
                hasDokumen
                  ? `
              <div class="artikel-doc">
                <a href="${dokumen}" target="_blank" rel="noopener"
                   class="pdf-pill">
                  <img src="/assets/img/icons/pdf-brown.png"
                       alt="PDF" class="pdf-icon-img">
                  <span>Lihat / Unduh Dokumen</span>
                </a>
              </div>`
                  : ""
              }

              <button class="btn-detail" data-id="${id}">
                <span>📖 Baca Selengkapnya</span>
                <span class="arrow">➜</span>
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // ===============================
  // Modal detail artikel
  // ===============================
  function openModalById(id) {
    const art = allArticles.find(
      (a) => String(a._id || a.id || a.article_id || "") === String(id)
    );
    if (!art || !modal) return;

    const judul = pickField(art, ["judul", "title", "nama"], "Tanpa Judul");
    const isi = pickField(
      art,
      ["isi", "content", "deskripsi", "body"],
      "(Konten belum tersedia)"
    );
    const gambar = normalizeUrl(
      pickField(art, ["gambar", "imageUrl", "image", "thumbnail"], "")
    );
    const dok = normalizeUrl(
      pickField(art, ["dokumen", "file", "documentUrl", "attachment"], "")
    );

    modalTitle.textContent = judul;
    modalContent.textContent = isi;

    if (gambar) {
      modalImage.style.display = "block";
      modalImage.src = gambar;
      modalImage.alt = judul;
    } else {
      modalImage.style.display = "none";
    }

    if (dok) {
      modalFile.innerHTML = `
        <a href="${dok}" target="_blank" rel="noopener"
           class="pdf-pill pdf-pill-modal">
          <img src="/assets/img/pdf.png"
               alt="PDF" class="pdf-icon-img">
          <span>Lihat / Unduh Dokumen</span>
        </a>
      `;
    } else {
      modalFile.innerHTML = "";
    }

    modal.style.display = "block";
  }

  // ===============================
  // Load artikel dari backend
  // ===============================
  async function loadArticles() {
    if (artikelList) {
      artikelList.innerHTML = `
        <p style="text-align:center; color:#555; margin-top:20px;">
          ⏳ Memuat artikel...
        </p>
      `;
    }

    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/articles`, { headers });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!res.ok) {
        console.error("❌ Error GET /articles:", data);
        artikelList.innerHTML = `
          <p style="text-align:center; color:#d32f2f; margin-top:20px;">
            Gagal memuat artikel. Coba beberapa saat lagi.
          </p>
        `;
        return;
      }

      if (!Array.isArray(data)) {
        console.warn("Respon /articles bukan array:", data);
        allArticles = [];
      } else {
        allArticles = data;
      }

      renderArticles();
    } catch (err) {
      console.error("❌ FETCH ERROR /articles:", err);
      artikelList.innerHTML = `
        <p style="text-align:center; color:#d32f2f; margin-top:20px;">
          Tidak dapat terhubung ke server.
        </p>
      `;
    }
  }

  // ===============================
  // Events
  // ===============================
  if (filterBidang) {
    filterBidang.addEventListener("change", renderArticles);
  }

  if (artikelList) {
    artikelList.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-detail");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (id) openModalById(id);
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
  }

  // Load awal
  loadArticles();
});
