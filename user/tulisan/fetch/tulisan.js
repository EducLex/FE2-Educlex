// /user/tulisan/fetch/tulisan.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const filterBidang = document.getElementById("filterBidang");
  const grid = document.getElementById("tulisanBaru");

  let allTulisan = [];

  // ==========================
  // Normalisasi satu item tulisan
  // ==========================
  function normalizeTulisan(t) {
    const judul = t.judul || "-";
    const isi = t.isi || t.content || t.deskripsi || "";
    const penulis = t.penulis || t.author || "Jaksa";
    const tanggal = t.tanggal || t.created_at || t.createdAt || null;

    // coba baca bidang/kategori dari field backend
    let bidang =
      t.bidang ||
      t.kategori ||
      t.bagian ||
      "";

    // fallback: tebak bidang dari nama penulis (kalau formatnya "Asisten Bidang Intelijen", dll)
    if (!bidang && penulis.toLowerCase().includes("intelijen")) bidang = "Intelijen";
    if (!bidang && penulis.toLowerCase().includes("pembinaan")) bidang = "Pembinaan";

    return { judul, isi, penulis, tanggal, bidang };
  }

  // ==========================
  // Render grid tulisan
  // ==========================
  function renderTulisan() {
    if (!grid) return;

    const selectedBidang = filterBidang?.value || "";

    const filtered = allTulisan.filter((t) => {
      if (!selectedBidang) return true;
      if (!t.bidang) return false;
      return t.bidang.toLowerCase() === selectedBidang.toLowerCase();
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <p style="grid-column:1 / -1; text-align:center; color:#c0392b;">
          Gagal memuat tulisan.
        </p>
      `;
      return;
    }

    grid.innerHTML = filtered
      .map((t) => {
        const tanggal = t.tanggal
          ? new Date(t.tanggal).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";

        const preview =
          t.isi.length > 200 ? t.isi.slice(0, 200) + "..." : t.isi;

        return `
          <article class="tulisan-card">
            <h3>${t.judul}</h3>
            <p class="meta">
              <span>✍️ ${t.penulis}</span>
              ${tanggal ? `<span>📅 ${tanggal}</span>` : ""}
              ${t.bidang ? `<span>🏛️ ${t.bidang}</span>` : ""}
            </p>
            <p class="preview">${preview}</p>
          </article>
        `;
      })
      .join("");
  }

  // ==========================
  // GET tulisan publik
  // 1) coba /tulisan-public
  // 2) kalau 404 → fallback /tulisan
  // ==========================
  async function fetchTulisanPublic() {
    // coba endpoint publik dulu
    try {
      const res = await fetch(`${API_BASE}/tulisan-public`);

      if (res.ok) {
        const data = await res.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      }

      // kalau 404 → fallback ke /tulisan
      if (res.status === 404) {
        return await fetchTulisanFallback();
      }

      return [];
    } catch {
      // jaringan error → coba fallback juga
      return await fetchTulisanFallback();
    }
  }

  // fallback ke /tulisan (tanpa Authorization)
  async function fetchTulisanFallback() {
    try {
      const res = await fetch(`${API_BASE}/tulisan`);

      if (!res.ok) {
        return [];
      }

      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  // ==========================
  // Load data awal
  // ==========================
  async function loadTulisanPublic() {
    if (grid) {
      grid.innerHTML = `
        <p style="grid-column:1 / -1; text-align:center; color:#777;">
          ⏳ Memuat data tulisan...
        </p>
      `;
    }

    const rawList = await fetchTulisanPublic();

    if (!rawList || rawList.length === 0) {
      if (grid) {
        grid.innerHTML = `
          <p style="grid-column:1 / -1; text-align:center; color:#c0392b;">
            Gagal memuat tulisan.
          </p>
        `;
      }
      return;
    }

    allTulisan = rawList.map(normalizeTulisan);
    renderTulisan();
  }

  // ==========================
  // Event filter
  // ==========================
  if (filterBidang) {
    filterBidang.addEventListener("change", renderTulisan);
  }

  // initial load
  loadTulisanPublic();
});
