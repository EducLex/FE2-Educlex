// /user/tulisan/fetch/tulisan.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const filterBidang = document.getElementById("filterBidang");
  const grid = document.getElementById("tulisanBaru");

  let allTulisan = [];

  // 8 bidang yang harus tampil di dropdown publik
  const FIXED_8_BIDANG = [
    "Pembinaan",
    "Intelijen",
    "Pidana Umum",
    "Pidana Khusus",
    "Perdata dan Tata Usaha Negara",
    "Pidana Militer",
    "Pengawasan",
    "Pemulihan Aset",
  ];

  // bidang map: id -> name
  let bidangMap = new Map(); // ObjectId -> Nama Bidang

  // ==========================
  // Helpers
  // ==========================
  const getToken = () => localStorage.getItem("token") || "";
  const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v || ""));

  const pickField = (obj, keys, fallback = "") => {
    if (!obj) return fallback;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
        return obj[k];
      }
    }
    return fallback;
  };

  function setGridMessage(html) {
    if (!grid) return;
    grid.innerHTML = `
      <div style="grid-column: 1 / -1;">
        ${html}
      </div>
    `;
  }

  // ==========================
  // Fetch bidang (public)
  // ==========================
  async function fetchBidang() {
    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/bidang`, { headers });
      const raw = await res.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!res.ok) {
        console.warn("⚠️ GET /bidang gagal:", res.status, raw);
        return [];
      }

      if (!Array.isArray(data)) return [];

      const normalized = data
        .map((b) => {
          const _id = b._id || b.id || "";
          const name = String(pickField(b, ["name", "nama", "bidang"], "") || "").trim();
          return { _id, name };
        })
        .filter((b) => isObjectId(b._id) && b.name);

      return normalized;
    } catch (err) {
      console.warn("⚠️ FETCH /bidang error:", err);
      return [];
    }
  }

  // isi dropdown filter bidang (8 bidang)
  async function loadBidangDropdown() {
    if (!filterBidang) return;

    filterBidang.innerHTML = `<option value="" selected>Semua Bidang</option>`;

    const bidangServer = await fetchBidang();
    bidangMap = new Map(bidangServer.map((b) => [b._id, b.name]));

    const fixedLower = new Set(FIXED_8_BIDANG.map((x) => x.toLowerCase()));
    const bidang8 = bidangServer
      .filter((b) => fixedLower.has(b.name.toLowerCase()))
      .sort(
        (a, b) =>
          FIXED_8_BIDANG.findIndex((x) => x.toLowerCase() === a.name.toLowerCase()) -
          FIXED_8_BIDANG.findIndex((x) => x.toLowerCase() === b.name.toLowerCase())
      );

    const finalNames =
      bidang8.length > 0
        ? bidang8.map((b) => b.name)
        : FIXED_8_BIDANG.slice();

    finalNames.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      filterBidang.appendChild(opt);
    });
  }

  // ==========================
  // Normalisasi tulisan
  // ==========================
  function normalizeTulisan(t) {
    const judul = String(pickField(t, ["judul", "title"], "-") || "-");
    const isi = String(pickField(t, ["isi", "content", "deskripsi", "body"], "") || "");
    const penulis = String(pickField(t, ["penulis", "author", "nama_penulis"], "Jaksa") || "Jaksa");
    const tanggal = pickField(t, ["tanggal", "created_at", "createdAt"], null);

    const bidangIdRaw = pickField(t, ["bidang_id", "bidangId", "bidangID"], "");
    const bidangObj = t?.bidang_id && typeof t.bidang_id === "object" ? t.bidang_id : null;

    let bidangName = "";

    const bidangStr = String(pickField(t, ["bidang", "kategori", "bagian"], "") || "").trim();
    if (bidangStr) bidangName = bidangStr;

    if (!bidangName && bidangObj) {
      const objName = String(pickField(bidangObj, ["name", "nama", "bidang"], "") || "").trim();
      if (objName) bidangName = objName;

      const objId = bidangObj._id || bidangObj.id || "";
      if (!bidangName && isObjectId(objId) && bidangMap.has(objId)) {
        bidangName = bidangMap.get(objId);
      }
    }

    if (!bidangName && isObjectId(bidangIdRaw) && bidangMap.has(bidangIdRaw)) {
      bidangName = bidangMap.get(bidangIdRaw);
    }

    return { judul, isi, penulis, tanggal, bidang: bidangName };
  }

  // ==========================
  // Render grid tulisan
  // ==========================
  function renderTulisan() {
    if (!grid) return;

    const selectedBidang = (filterBidang?.value || "").trim();

    const filtered = allTulisan.filter((t) => {
      if (!selectedBidang) return true;
      return (t.bidang || "").toLowerCase() === selectedBidang.toLowerCase();
    });

    if (filtered.length === 0) {
      setGridMessage(`
        <div class="loading-card" style="color:#6d4c41;">
          Tidak ada tulisan untuk bidang ini.
        </div>
      `);
      return;
    }

    grid.innerHTML = filtered
      .map((t) => {
        const tanggalFormatted = t.tanggal
          ? new Date(t.tanggal).toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : "";

        const preview = t.isi.length > 240 ? t.isi.slice(0, 240) + "..." : t.isi;

        // ✅ meta kiri/kanan biar tanggal bisa nempel ujung kanan lewat CSS
        return `
          <article class="tulisan-card">
            <h3 class="judul-tulisan">${t.judul}</h3>

            <div class="tulisan-meta">
              <div class="meta-left">
                <span class="penulis">✍️ ${t.penulis}</span>
              </div>

              <div class="meta-right">
                ${tanggalFormatted ? `<span class="tanggal">📅 ${tanggalFormatted}</span>` : ""}
              </div>
            </div>

            <p class="tulisan-snippet">${preview}</p>
          </article>
        `;
      })
      .join("");
  }

  // ==========================
  // Fetch tulisan publik
  // ==========================
  async function fetchTulisanPublic() {
    try {
      const res = await fetch(`${API_BASE}/tulisan-public`);
      if (res.ok) {
        const data = await res.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      }
      if (res.status === 404) return await fetchTulisanFallback();
      return [];
    } catch {
      return await fetchTulisanFallback();
    }
  }

  async function fetchTulisanFallback() {
    try {
      const token = getToken();
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/tulisan`, { headers });
      if (!res.ok) return [];
      const data = await res.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  // ==========================
  // Load awal
  // ==========================
  async function loadTulisanPublic() {
    setGridMessage(`<div class="loading-card">⏳ Memuat data tulisan...</div>`);

    // bidangMap harus siap dulu sebelum normalize
    await loadBidangDropdown();

    const rawList = await fetchTulisanPublic();

    if (!rawList || rawList.length === 0) {
      setGridMessage(`
        <div class="loading-card" style="color:#c0392b;">
          Gagal memuat tulisan.
        </div>
      `);
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

  loadTulisanPublic();
});
