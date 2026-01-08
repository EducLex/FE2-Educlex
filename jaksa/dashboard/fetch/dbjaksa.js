// ============================================================
// KONFIG DASAR
// ============================================================
const apiBase = "http://localhost:8080";

// ============================================================
// Fallback showAlert (pakai SweetAlert kalau ada)
// ============================================================
function showAlert(message, type = "info") {
  const iconMap = {
    success: "success",
    error: "error",
    warning: "warning",
    info: "info",
  };

  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: iconMap[type] || "info",
      title: message,
      timer: 2500,
      showConfirmButton: false,
    });
  } else {
    alert(message);
  }
}

// ============================================================
// HELPER PARSE RESPONSE (TEXT -> JSON fallback)
// ============================================================
async function parseResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { data, raw: text };
}

// ============================================================
// ✅ JWT decode helper (read payload only, no verify)
// ============================================================
function decodeJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ============================================================
// ✅ clear stale hints if token changes (biar gak nyangkut akun lama)
// ============================================================
function clearJaksaHintsIfTokenChanged(token) {
  const lastToken = localStorage.getItem("lastToken") || "";
  if (lastToken && lastToken !== token) {
    localStorage.removeItem("jaksaId");
    localStorage.removeItem("jaksaEmail");
    localStorage.removeItem("jaksaName");
    localStorage.removeItem("jaksaBidangNama");
    localStorage.removeItem("jaksaBidangId");
  }
  localStorage.setItem("lastToken", token);
}

// ============================================================
// ✅ normalize payload
// supports: {data:[...]} / direct array / {jaksa:[...]} / {tulisan:[...]}
// ============================================================
function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.jaksa)) return payload.jaksa;
    if (Array.isArray(payload.tulisan)) return payload.tulisan;
  }
  return [];
}

// ============================================================
// ✅ helpers field picking
// ============================================================
function pickField(obj, keys, fallback = "") {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
      return String(obj[k]);
    }
  }
  return fallback;
}

// ============================================================
// ✅ normalisasi teks bidang biar konsisten (intelijen vs intelejen)
// ============================================================
function normalizeBidangName(s) {
  const x = String(s || "").trim().toLowerCase();
  if (!x) return "";
  if (x === "intelejen") return "intelijen";
  return x;
}

// ============================================================
// READY
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("role") || "").toLowerCase();

  // Cek login + role jaksa
  if (!token || (role && role !== "jaksa" && role !== "prosecutor")) {
    showAlert("Silakan login sebagai jaksa terlebih dahulu.", "warning");
    setTimeout(() => {
      window.location.href = "/auth/login.html";
    }, 1000);
    return;
  }

  // ✅ bersihin cache kalau token berubah (login akun lain)
  clearJaksaHintsIfTokenChanged(token);

  // ========================================================
  // ✅ Anti BUG: guard supaya gak double-run
  // ========================================================
  if (window.__DBJAKSA_BOOTED__) {
    console.warn("⚠️ dbjaksa.js sudah jalan (skip double-boot).");
    return;
  }
  window.__DBJAKSA_BOOTED__ = true;

  // ========================================================
  // ✅ Fetch cache biar endpoint gak ditembak berkali-kali
  // ========================================================
  const __fetchCache = new Map(); // key -> Promise<json>
  async function cachedFetchJson(url) {
    const key = String(url);
    if (__fetchCache.has(key)) return __fetchCache.get(key);

    const p = (async () => {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const { data, raw } = await parseResponse(res);
      return { ok: res.ok, status: res.status, data, raw };
    })();

    __fetchCache.set(key, p);
    return p;
  }

  // ========================================================
  // ✅ UI Render lock: supaya angka STRICT gak ketimpa lagi
  // ========================================================
  let __STRICT_RENDER_DONE__ = false;

  // Set nama jaksa (kalau disimpan di localStorage)
  const jaksaNameEl = document.getElementById("jaksaName");
  const storedName =
    localStorage.getItem("jaksaName") ||
    localStorage.getItem("username") ||
    localStorage.getItem("name");

  if (jaksaNameEl && storedName) {
    jaksaNameEl.textContent = storedName;
  }

  // ========================================================
  // ✅ TAMBAHAN: KLIK ICON/NAMA JAKSA -> BUKA PROFIL
  // ========================================================
  const openProfileEl = document.getElementById("openProfileJaksa");
  const logoutBtn = document.getElementById("logoutBtn");

  if (openProfileEl) {
    openProfileEl.style.cursor = "pointer";

    openProfileEl.addEventListener("click", (e) => {
      if (logoutBtn && (e.target === logoutBtn || logoutBtn.contains(e.target))) return;
      window.location.href = "/jaksa/profilejaksa/pfjaksa.html";
    });
  }
  // ========================================================

  // Elemen kartu statistik
  const totalBelumDijawabEl = document.getElementById("totalBelumDijawab");
  const totalTerjawabEl = document.getElementById("totalTerjawab");
  const totalTulisanJaksaEl = document.getElementById("totalTulisanJaksa");

  // Tabel tulisan jaksa
  const tulisanTableBody = document.getElementById("tulisanTableBody");

  // Elemen lama (tetap dipertahankan supaya tidak error kalau dipakai nanti)
  const formJawabanContainer = document.getElementById("formJawabanJaksa");
  const jawabanForm = document.getElementById("jawabanForm");
  const jawabanText = document.getElementById("jawabanText");
  const batalJawabBtn = document.getElementById("batalJawab");

  let pertanyaanTerpilih = null; // simpan pertanyaan yang sedang dijawab
  let tulisanCache = []; // cache tulisan, buat fallback hitung jumlah

  // ========================================================
  // ✅ Identitas jaksa login + bidang
  // ========================================================
  let currentJaksa = null; // { _id, nama, email, nip, bidang_id, bidang_nama }

  function getIdentityFromToken() {
    const payload = decodeJwtPayload(token);
    if (!payload) return { id: "", email: "", username: "", nama: "" };

    return {
      id: String(payload._id || payload.id || payload.userId || payload.jaksaId || "").trim(),
      email: String(payload.email || "").toLowerCase().trim(),
      username: String(payload.username || payload.name || "").toLowerCase().trim(),
      nama: String(payload.nama || "").toLowerCase().trim(),
    };
  }

  function getIdentityFromStorage() {
    return {
      id: String(
        localStorage.getItem("jaksaId") ||
          localStorage.getItem("userId") ||
          localStorage.getItem("id") ||
          localStorage.getItem("_id") ||
          ""
      ).trim(),
      email: String(
        localStorage.getItem("jaksaEmail") ||
          localStorage.getItem("email") ||
          localStorage.getItem("userEmail") ||
          ""
      )
        .toLowerCase()
        .trim(),
      name: String(
        localStorage.getItem("jaksaName") ||
          localStorage.getItem("username") ||
          localStorage.getItem("name") ||
          ""
      )
        .toLowerCase()
        .trim(),
    };
  }

  async function hydrateCurrentJaksa() {
    try {
      const tokenIdent = getIdentityFromToken();
      const storeIdent = getIdentityFromStorage();

      const res = await fetch(`${apiBase}/jaksa`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("👨‍⚖️ RAW /jaksa:", raw);

      if (!res.ok) {
        console.warn("⚠️ GET /jaksa gagal:", res.status, data);
        return null;
      }

      const list = normalizeList(data);

      const pick = () => {
        if (tokenIdent.id) {
          const byId = list.find((j) => String(j?._id || j?.id || "") === tokenIdent.id);
          if (byId) return byId;
        }

        if (tokenIdent.email) {
          const byEmail = list.find(
            (j) => String(j?.email || "").toLowerCase().trim() === tokenIdent.email
          );
          if (byEmail) return byEmail;
        }

        const tn = tokenIdent.username || tokenIdent.nama;
        if (tn) {
          const byUsername = list.find(
            (j) => String(j?.username || "").toLowerCase().trim() === tn
          );
          if (byUsername) return byUsername;

          const byNama = list.find((j) => String(j?.nama || "").toLowerCase().trim() === tn);
          if (byNama) return byNama;
        }

        if (storeIdent.id) {
          const byId = list.find((j) => String(j?._id || j?.id || "") === storeIdent.id);
          if (byId) return byId;
        }

        if (storeIdent.email) {
          const byEmail = list.find(
            (j) => String(j?.email || "").toLowerCase().trim() === storeIdent.email
          );
          if (byEmail) return byEmail;
        }

        if (storeIdent.name) {
          const byUsername = list.find(
            (j) => String(j?.username || "").toLowerCase().trim() === storeIdent.name
          );
          if (byUsername) return byUsername;

          const byNama = list.find(
            (j) => String(j?.nama || "").toLowerCase().trim() === storeIdent.name
          );
          if (byNama) return byNama;
        }

        if (list.length === 1) return list[0];
        return null;
      };

      const j = pick();
      if (!j) return null;

      const normalizedJaksa = {
        _id: j._id || j.id || "",
        nama: j.nama || j.name || j.username || "",
        email: j.email || "",
        nip: j.nip || "",
        bidang_id: j.bidang_id || j.bidangId || j.bidangID || "",
        bidang_nama: j.bidang_nama || j.bidangNama || j.bidang_name || "",
        username: j.username || "",
      };

      if (normalizedJaksa._id) localStorage.setItem("jaksaId", normalizedJaksa._id);
      if (normalizedJaksa.nama) localStorage.setItem("jaksaName", normalizedJaksa.nama);
      if (normalizedJaksa.email) localStorage.setItem("jaksaEmail", normalizedJaksa.email);
      if (normalizedJaksa.bidang_id) localStorage.setItem("jaksaBidangId", normalizedJaksa.bidang_id);
      if (normalizedJaksa.bidang_nama)
        localStorage.setItem("jaksaBidangNama", normalizedJaksa.bidang_nama);

      if (jaksaNameEl && normalizedJaksa.nama) {
        jaksaNameEl.textContent = normalizedJaksa.nama;
      }

      console.log("✅ currentJaksa:", normalizedJaksa);
      return normalizedJaksa;
    } catch (err) {
      console.warn("⚠️ hydrateCurrentJaksa error:", err);
      return null;
    }
  }

  function getCurrentBidangKeys() {
    const bidangNamaRaw =
      currentJaksa?.bidang_nama || localStorage.getItem("jaksaBidangNama") || "";
    const bidangId =
      (currentJaksa?.bidang_id || localStorage.getItem("jaksaBidangId") || "").trim();

    const bidangNama = normalizeBidangName(bidangNamaRaw);
    return { bidangNama, bidangId };
  }

  // ========================================================
  // UTIL: FORMAT TANGGAL
  // ========================================================
  function formatTanggalId(raw) {
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // ========================================================
  // LOAD STATISTIK DASHBOARD (kode lama tetap ada)
  // tapi: jangan overwrite kalau STRICT sudah render
  // ========================================================
  async function loadStats() {
    try {
      const res = await fetch(`${apiBase}/jaksa/dashboard/stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("📊 RAW DASHBOARD STATS:", raw);
      console.log("📊 PARSED DASHBOARD STATS:", data);

      if (!res.ok) {
        console.warn("Dashboard stats tidak OK, akan pakai fallback jika ada.");
        return;
      }

      const stats =
        data &&
        typeof data === "object" &&
        data.data &&
        typeof data.data === "object"
          ? data.data
          : data || {};

      const totalQuestions =
        stats.totalPertanyaan ??
        stats.questions ??
        stats.total_questions ??
        stats.jumlah_pertanyaan ??
        0;

      const belum =
        stats.totalBelumDijawab ??
        stats.belum_dijawab ??
        stats.unanswered_questions ??
        stats.unanswered ??
        0;

      const terjawab =
        stats.totalTerjawab ??
        stats.terjawab ??
        stats.answered ??
        (totalQuestions >= belum ? totalQuestions - belum : 0);

      const tulisan =
        stats.totalTulisanJaksa ??
        stats.tulisanJaksa ??
        stats.totalTulisan ??
        stats.tulisan ??
        0;

      // ✅ Anti bug: kalau STRICT sudah render, jangan timpa lagi
      if (__STRICT_RENDER_DONE__) return;

      if (totalBelumDijawabEl) totalBelumDijawabEl.textContent = String(belum);
      if (totalTerjawabEl) totalTerjawabEl.textContent = String(terjawab);
      if (totalTulisanJaksaEl) totalTulisanJaksaEl.textContent = String(tulisan);
    } catch (err) {
      console.error("❌ ERROR LOAD STATS:", err);
      showAlert("Gagal terhubung ke server (stats).", "error");
    }
  }

  // ========================================================
  // ✅ STRICT BIDANG: HITUNG STATISTIK DARI /questions
  // ========================================================
  async function loadStatsByBidangStrict() {
    try {
      const { bidangNama, bidangId } = getCurrentBidangKeys();

      if (!bidangNama && !bidangId) {
        console.warn("⚠️ Bidang login belum kebaca, stats bidang skip.");
        return;
      }

      const { ok, status, data, raw } = await cachedFetchJson(`${apiBase}/questions`);
      console.log("💬 RAW QUESTIONS (/questions):", raw);

      if (!ok) {
        console.warn("GET /questions tidak OK, skip stats bidang.", status, data);
        return;
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const filtered = list.filter((q) => {
        const qBidangNama = normalizeBidangName(
          pickField(q, ["bidang_nama", "bidangNama", "bidang_name", "kategori", "bidang"], "")
        );
        const qBidangId = String(pickField(q, ["bidang_id", "bidangId", "bidangID"], "")).trim();

        if (!qBidangNama && !qBidangId) return false;

        const matchByName = bidangNama && qBidangNama && qBidangNama === bidangNama;
        const matchById = bidangId && qBidangId && qBidangId === bidangId;

        return matchByName || matchById;
      });

      let answered = 0;
      let unanswered = 0;

      filtered.forEach((q) => {
        const statusStr = (q.status || q.statusPertanyaan || "")
          .toString()
          .toLowerCase();

        const sudahDijawab =
          q.terjawab === true ||
          statusStr === "dijawab" ||
          statusStr === "answered" ||
          !!q.jawaban ||
          !!(Array.isArray(q.jawaban) && q.jawaban.length) ||
          (Array.isArray(q.diskusi) && q.diskusi.length > 0);

        if (sudahDijawab) answered += 1;
        else unanswered += 1;
      });

      if (totalBelumDijawabEl) totalBelumDijawabEl.textContent = String(unanswered);
      if (totalTerjawabEl) totalTerjawabEl.textContent = String(answered);

      console.log("✅ Stats STRICT bidang:", { bidangNama, bidangId, answered, unanswered });

      __STRICT_RENDER_DONE__ = true;
    } catch (err) {
      console.warn("❌ ERROR loadStatsByBidangStrict:", err);
    }
  }

  // ========================================================
  // FALLBACK: HITUNG STATISTIK DARI /questions (kode lama)
  // (tapi jangan timpa STRICT)
  // ========================================================
  async function loadQuestionStatsFallback() {
    try {
      const res = await fetch(`${apiBase}/questions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("💬 RAW QUESTIONS (/questions):", raw);
      console.log("💬 PARSED QUESTIONS (/questions):", data);

      if (!res.ok) {
        console.warn("GET /questions tidak OK, skip fallback stats.");
        return;
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];

      let answered = 0;
      let unanswered = 0;

      list.forEach((q) => {
        const statusStr = (q.status || q.statusPertanyaan || "")
          .toString()
          .toLowerCase();

        const sudahDijawab =
          q.terjawab === true ||
          statusStr === "dijawab" ||
          statusStr === "answered" ||
          !!(Array.isArray(q.jawaban) && q.jawaban.length);

        if (sudahDijawab) answered += 1;
        else unanswered += 1;
      });

      // ✅ Anti bug: jangan timpa kalau STRICT sudah render
      if (__STRICT_RENDER_DONE__) return;

      if (
        totalBelumDijawabEl &&
        (!totalBelumDijawabEl.textContent ||
          totalBelumDijawabEl.textContent === "0")
      ) {
        totalBelumDijawabEl.textContent = String(unanswered);
      }

      if (
        totalTerjawabEl &&
        (!totalTerjawabEl.textContent ||
          totalTerjawabEl.textContent === "0")
      ) {
        totalTerjawabEl.textContent = String(answered);
      }
    } catch (err) {
      console.warn("❌ ERROR LOAD QUESTIONS FALLBACK:", err);
    }
  }

  // ========================================================
  // LOAD TULISAN JAKSA STRICT bidang
  // ========================================================
  async function loadTulisanStrictBidang() {
    if (!tulisanTableBody) return;

    tulisanTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; padding:12px;">
          Memuat data tulisan jaksa...
        </td>
      </tr>
    `;

    try {
      const { ok, status, data, raw } = await cachedFetchJson(`${apiBase}/tulisan`);
      console.log("📝 RAW TULISAN (/tulisan):", raw);

      if (!ok) {
        tulisanTableBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; padding:12px; color:#d32f2f;">
              Gagal memuat tulisan jaksa.
            </td>
          </tr>
        `;
        showAlert("Gagal memuat tulisan jaksa.", "error");
        return;
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.tulisan)
        ? data.tulisan
        : [];

      tulisanCache = list;

      const { bidangNama, bidangId } = getCurrentBidangKeys();

      const filtered = list.filter((t) => {
        const tBidangNama = normalizeBidangName(
          pickField(t, ["bidang_nama", "bidangNama", "bidang_name", "bidang"], "")
        );
        const tBidangId = String(pickField(t, ["bidang_id", "bidangId", "bidangID"], "")).trim();

        if (!tBidangNama && !tBidangId) return false;

        const matchByName = bidangNama && tBidangNama && tBidangNama === bidangNama;
        const matchById = bidangId && tBidangId && tBidangId === bidangId;

        return matchByName || matchById;
      });

      if (totalTulisanJaksaEl) totalTulisanJaksaEl.textContent = String(filtered.length);

      if (!filtered.length) {
        tulisanTableBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; padding:12px;">
              Belum ada tulisan jaksa untuk bidang kamu.
            </td>
          </tr>
        `;
        return;
      }

      tulisanTableBody.innerHTML = filtered
        .map((t) => {
          const judul = t.judul || t.title || t.nama || "Tanpa Judul";
          const penulis =
            t.penulis ||
            t.author ||
            t.nama_penulis ||
            t.createdBy ||
            "Jaksa";
          const createdRaw =
            t.tanggal || t.createdAt || t.created_at || t.date;
          const tanggal = formatTanggalId(createdRaw);

          return `
            <tr>
              <td>${judul}</td>
              <td>${penulis}</td>
              <td>${tanggal}</td>
            </tr>
          `;
        })
        .join("");
    } catch (err) {
      console.error("❌ ERROR LOAD TULISAN:", err);
      tulisanTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; padding:12px; color:#d32f2f;">
            Tidak dapat terhubung ke server.
          </td>
        </tr>
      `;
      showAlert("Gagal terhubung ke server (tulisan).", "error");
    }
  }

  // ========================================================
  // LOAD TULISAN JAKSA (kode lama tetap disimpan)
  // (tapi jangan timpa tabel kalau STRICT sudah tampil)
  // ========================================================
  async function loadTulisan() {
    if (!tulisanTableBody) return;

    tulisanTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; padding:12px;">
          Memuat data tulisan jaksa...
        </td>
      </tr>
    `;

    try {
      const res = await fetch(`${apiBase}/tulisan`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("📝 RAW TULISAN (/tulisan):", raw);
      console.log("📝 PARSED TULISAN (/tulisan):", data);

      if (!res.ok) {
        tulisanTableBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; padding:12px; color:#d32f2f;">
              Gagal memuat tulisan jaksa.
            </td>
          </tr>
        `;
        showAlert("Gagal memuat tulisan jaksa.", "error");
        return;
      }

      // ✅ Anti bug: kalau STRICT sudah jalan, jangan overwrite tabel
      if (__STRICT_RENDER_DONE__) return;

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.tulisan)
        ? data.tulisan
        : [];

      tulisanCache = list;

      if (!list.length) {
        tulisanTableBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; padding:12px;">
              Belum ada tulisan jaksa.
            </td>
          </tr>
        `;
      } else {
        tulisanTableBody.innerHTML = list
          .map((t) => {
            const judul = t.judul || t.title || t.nama || "Tanpa Judul";
            const penulis =
              t.penulis ||
              t.author ||
              t.nama_penulis ||
              t.createdBy ||
              "Jaksa";
            const createdRaw =
              t.tanggal || t.createdAt || t.created_at || t.date;
            const tanggal = formatTanggalId(createdRaw);

            return `
              <tr>
                <td>${judul}</td>
                <td>${penulis}</td>
                <td>${tanggal}</td>
              </tr>
            `;
          })
          .join("");
      }

      if (
        totalTulisanJaksaEl &&
        (!totalTulisanJaksaEl.textContent ||
          totalTulisanJaksaEl.textContent === "0")
      ) {
        totalTulisanJaksaEl.textContent = String(list.length);
      }
    } catch (err) {
      console.error("❌ ERROR LOAD TULISAN:", err);
      tulisanTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; padding:12px; color:#d32f2f;">
            Tidak dapat terhubung ke server.
          </td>
        </tr>
      `;
      showAlert("Gagal terhubung ke server (tulisan).", "error");
    }
  }

  // ========================================================
  // FORM JAWABAN JAKSA (kode lama tetap disimpan)
  // ========================================================
  if (jawabanForm) {
    jawabanForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!pertanyaanTerpilih) {
        showAlert("Tidak ada pertanyaan yang dipilih.", "warning");
        return;
      }

      const jawaban = jawabanText ? jawabanText.value.trim() : "";
      if (!jawaban) {
        showAlert("Jawaban tidak boleh kosong.", "warning");
        return;
      }

      console.log("💬 (SIMULASI) KIRIM JAWABAN:", {
        pertanyaan: pertanyaanTerpilih,
        jawaban,
      });

      showAlert(
        "Fitur kirim jawaban belum dikonfigurasi endpoint-nya.",
        "info"
      );
    });
  }

  if (batalJawabBtn) {
    batalJawabBtn.addEventListener("click", () => {
      pertanyaanTerpilih = null;
      if (formJawabanContainer)
        formJawabanContainer.classList.add("hidden");
    });
  }

  // ========================================================
  // ✅ BOOT SEQUENCE (single source of truth)
  // - hydrateCurrentJaksa dulu
  // - lalu STRICT load (stats + tulisan)
  // - loader lama masih dipanggil, tapi gak bisa overwrite STRICT
  // ========================================================
  (async () => {
    try {
      currentJaksa = await hydrateCurrentJaksa();

      // loader lama tetap jalan (untuk kompatibilitas)
      loadStats();
      loadQuestionStatsFallback();
      loadTulisan();

      // ✅ FINAL: STRICT (yang bener) — anti overwrite
      await loadStatsByBidangStrict();
      await loadTulisanStrictBidang();
    } catch (e) {
      console.warn("⚠️ boot error:", e);

      // fallback tetap ada
      loadStats();
      loadTulisan();
      loadQuestionStatsFallback();
    }
  })();

  // ========================================================
  // JALANKAN LOAD DATA AWAL (kode lama tetap disimpan)
  // ========================================================
  // (Bagian ini dibiarkan, tapi output-nya gak akan bisa nimpah STRICT karena ada __STRICT_RENDER_DONE__)
  loadStats();
  loadTulisan();
  loadQuestionStatsFallback();
});
