// /user/peraturan/fetch/peraturan.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";
  const container = document.getElementById("peraturanContainer");

  // ==========================
  // Normalisasi 1 peraturan
  // ==========================
  function normalizePeraturan(p) {
    const judul = p.judul || "-";
    const isi = p.isi || p.content || "";
    const kategori = p.kategori || p.bidang || "";
    const tanggal =
      p.tanggal ||
      p.created_at ||
      p.createdAt ||
      null;

    const isiParts = isi
      .split(/\n{2,}|\r\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);

    return { judul, kategori, tanggal, isiParts };
  }

  // ==========================
  // Render accordion
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

    container.innerHTML = list
      .map((p, index) => {
        const tanggalStr = p.tanggal
          ? new Date(p.tanggal).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";

        const kategoriBadge = p.kategori
          ? `<span class="badge-kategori">${p.kategori}</span>`
          : "";

        const tanggalHtml = tanggalStr
          ? `<span class="peraturan-tanggal">
               📅 ${tanggalStr}
             </span>`
          : "";

        const bodyHtml = p.isiParts.map((par) => `<p>${par}</p>`).join("");

        return `
          <div class="peraturan-item">
            <div class="peraturan-header" data-index="${index}">
              <div class="header-top">
                <span class="judul-peraturan">${p.judul}</span>
              </div>
              <div class="header-bottom">
                <div class="meta-left">
                  ${kategoriBadge}
                  ${tanggalHtml}
                </div>
                <span class="toggle-icon">▼</span>
              </div>
            </div>
            <div class="peraturan-body">
              ${bodyHtml}
            </div>
          </div>
        `;
      })
      .join("");
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

    try {
      const res = await fetch(`${API_BASE}/peraturan`);

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
      const normalized = (Array.isArray(data) ? data : []).map(normalizePeraturan);
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
  // Accordion: klik di mana saja di header
  // ==========================
  document.addEventListener("click", (e) => {
    const header = e.target.closest(".peraturan-header");
    if (!header) return;

    const body = header.nextElementSibling;
    if (body && body.classList.contains("peraturan-body")) {
      body.classList.toggle("active");
    }
  });
});
