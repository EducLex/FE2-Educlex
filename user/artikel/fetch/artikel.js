// /user/artikel/fetch/artikel.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  // Kalau path ikon PDF beda, cukup ganti ini saja
  const PDF_ICON_URL = "/assets/img/pdf.png";

  const artikelList = document.getElementById("artikelList");
  const filterBidang = document.getElementById("filterBidang");

  const modal = document.getElementById("artikelModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalImage = document.getElementById("modalImage");
  const modalContent = document.getElementById("modalContent");
  const modalFile = document.getElementById("modalFile");
  const modalClose = document.querySelector("#artikelModal .close");

  let allArticles = [];
  let categoryMap = {}; // id kategori -> nama / bidang

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

  // Normalisasi URL (kalau hanya path)
  function normalizeUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return API_BASE + url;
    return API_BASE + "/" + url.replace(/^\/+/, "");
  }

  // Ambil nama bidang / kategori berdasarkan data artikel + categoryMap
  function getBidang(art) {
    const catId =
      pickField(art, ["categoryId", "category_id"], "") ||
      (art.category && (art.category._id || art.category.id));

    if (catId && categoryMap[String(catId)]) {
      return categoryMap[String(catId)];
    }

    // fallback kalau BE belum pakai categoryId
    return (
      pickField(art, ["bidang", "kategori", "category", "category.name"], "") ||
      "Umum"
    );
  }

  // Format tanggal dengan fallback ke hari ini & dd/mm/yy
  function formatTanggal(tanggalRaw) {
    let dateToUse = null;

    if (tanggalRaw) {
      const parsed = new Date(tanggalRaw);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
        dateToUse = parsed;
      }
    }

    // Kalau tanggal dari backend invalid / 0001-01-01, pakai hari ini
    if (!dateToUse) {
      dateToUse = new Date();
    }

    return dateToUse.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit", // → dd/mm/yy
    });
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
        const judul = pickField(
          art,
          ["judul", "title", "nama"],
          "Tanpa Judul"
        );
        const isi = pickField(
          art,
          ["isi", "content", "deskripsi", "body"],
          ""
        );
        const ringkas =
          isi.length > 220 ? isi.slice(0, 217).trimEnd() + "..." : isi;

        const bidang = getBidang(art) || "Umum";
        const penulis = pickField(
          art,
          ["penulis", "author", "createdBy"],
          "Admin EducLex"
        );
        const tanggalRaw = pickField(
          art,
          ["tanggal", "createdAt", "created_at"],
          ""
        );
        const tanggal = formatTanggal(tanggalRaw);

        const dokumen = normalizeUrl(
          pickField(art, ["dokumen", "file", "documentUrl", "attachment"], "")
        );
        const hasDokumen = !!dokumen;

        return `
          <article class="artikel-card" data-id="${id}">
            <!-- Ikon PDF di atas -->
            <div class="pdf-icon-box"
                 style="
                   width: 110px;
                   height: 140px;
                   margin: 0 auto 18px;
                   background-image: url('${PDF_ICON_URL}');
                   background-size: contain;
                   background-position: center;
                   background-repeat: no-repeat;
                 ">
            </div>

            <div class="artikel-body" style="max-width:95%;margin:0 auto;">
              
              <!-- HEADER BOX: kategori + judul + penulis/tanggal -->
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
                   ">
                  ${bidang}
                </p>

                <h3 class="artikel-title"
                    style="
                      font-size:19px;
                      font-weight:600;
                      color:#4e342e;
                      text-align:center;
                      margin:0 0 6px;
                    ">
                  ${judul}
                </h3>

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

              <!-- Garis pemisah halus antara header dan isi -->
              <div class="artikel-divider"
                   style="height:1px; background:#f0e2d9; margin:0 auto 14px; width:80%;"></div>

              <p class="artikel-excerpt"
                 style="
                   font-size:14px;
                   line-height:1.6;
                   color:#4a4a4a;
                   text-align:justify;
                   margin-bottom:16px;
                 ">
                ${ringkas}
              </p>

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
                <a href="${dokumen}" target="_blank" rel="noopener"
                   class="dokumen-link dokumen-lihat"
                   style="
                     display:inline-flex;
                     align-items:center;
                     gap:6px;
                     padding:8px 16px;
                     border-radius:999px;
                     border:1px solid #5d4037;
                     font-size:13px;
                     font-weight:600;
                     text-decoration:none;
                     color:#5d4037;
                     background-color:#fbe9e7;
                   ">
                  <span class="dokumen-eye" style="font-size:14px;">👁</span>
                  <span>Lihat</span>
                </a>

                <a href="${dokumen}" download
                   class="dokumen-link dokumen-unduh"
                   style="
                     display:inline-flex;
                     align-items:center;
                     gap:6px;
                     padding:8px 16px;
                     border-radius:999px;
                     border:1px solid #4e342e;
                     font-size:13px;
                     font-weight:600;
                     text-decoration:none;
                     color:#ffffff;
                     background-color:#5d4037;
                   ">
                  <span style="font-size:14px;">⬇</span>
                  <span>Unduh</span>
                </a>
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
                          transition: transform 0.15s ease,
                                      box-shadow 0.15s ease,
                                      background-color 0.15s ease;
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
    const dokumen = normalizeUrl(
      pickField(art, ["dokumen", "file", "documentUrl", "attachment"], "")
    );
    const hasDokumen = !!dokumen;

    modalTitle.textContent = judul;
    modalContent.textContent = isi;

    // Kita sudah tidak pakai gambar artikel, jadi sembunyikan saja
    if (modalImage) {
      modalImage.style.display = "none";
      modalImage.removeAttribute("src");
      modalImage.removeAttribute("alt");
    }

    if (hasDokumen) {
      modalFile.innerHTML = `
        <a href="${dokumen}" target="_blank" rel="noopener"
           class="dokumen-link dokumen-link-modal"
           style="
             display:inline-flex;
             align-items:center;
             gap:6px;
             padding:8px 14px;
             border-radius:999px;
             border:1px solid #5d4037;
             font-size:13px;
             font-weight:600;
             text-decoration:none;
             color:#5d4037;
             background-color:#fbe9e7;
           ">
          <span class="dokumen-eye" style="font-size:14px;">👁</span>
          <span>Lihat | Unduh</span>
        </a>
      `;
    } else {
      modalFile.innerHTML = "";
    }

    modal.style.display = "block";
  }

  // ===============================
  // Load kategori (optional)
  // ===============================
  async function loadCategories() {
    categoryMap = {};
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!res.ok || !Array.isArray(data)) {
        return;
      }

      data.forEach((c) => {
        const id = c._id || c.id || c.categoryId;
        const name =
          c.name || c.nama || c.bidang_nama || c.category_name || "";
        if (id && name) {
          categoryMap[String(id)] = String(name);
        }
      });
    } catch (err) {
      // Kalau gagal, yaudah: kategori pakai fallback "Umum"
      console.warn("Gagal memuat /categories:", err);
    }
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

    // kita coba load categories dulu (kalau gagal tidak apa-apa)
    await loadCategories();

    try {
      const res = await fetch(`${API_BASE}/articles`, {
        method: "GET",
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

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

      if (!Array.isArray(data)) {
        console.warn("Respon /articles bukan array:", data);
        allArticles = [];
      } else {
        allArticles = data;
      }

      renderArticles();
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
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  }

  // ===============================
  // Load awal
  // ===============================
  loadArticles();
});
