// ============================================================
// pfjaksa.js (FULL) - READ ONLY PROFILE (FIXED FOR YOUR DB)
// Endpoint:
// - GET  http://localhost:8080/jaksa   (list jaksa)
// - GET  http://localhost:8080/bidang (list bidang) [optional]
// ============================================================

const apiBase = "http://localhost:8080";

// ============================================================
// ALERT (SweetAlert fallback)
// ============================================================
function showAlert(message, type = "info") {
  const iconMap = { success: "success", error: "error", warning: "warning", info: "info" };
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
// PARSE RESPONSE (text -> json fallback)
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
// NORMALIZE PAYLOAD
// supports:
// - { data: ... }
// - { jaksa: [...] } / { bidang: [...] }
// - direct array/object
// ============================================================
function normalizePayload(payload) {
  if (payload && typeof payload === "object" && payload.data !== undefined) return payload.data;
  return payload;
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
  } catch (e) {
    return null;
  }
}

// ============================================================
// STORAGE HELPERS
// ============================================================
function getStoredJaksaId() {
  return (
    localStorage.getItem("jaksaId") ||
    localStorage.getItem("userId") ||
    localStorage.getItem("id") ||
    localStorage.getItem("_id") ||
    ""
  );
}

function getStoredEmail() {
  return (
    localStorage.getItem("jaksaEmail") ||
    localStorage.getItem("email") ||
    localStorage.getItem("userEmail") ||
    ""
  );
}

function getStoredName() {
  return (
    localStorage.getItem("jaksaName") ||
    localStorage.getItem("username") ||
    localStorage.getItem("name") ||
    ""
  );
}

// ============================================================
// ✅ clear stale hints if token changes
// ============================================================
function clearJaksaHintsIfTokenChanged(token) {
  const lastToken = localStorage.getItem("lastToken") || "";
  if (lastToken && lastToken !== token) {
    // token berubah = user login beda
    localStorage.removeItem("jaksaId");
    localStorage.removeItem("jaksaEmail");
    localStorage.removeItem("jaksaName");
    localStorage.removeItem("jaksaBidangNama");
  }
  localStorage.setItem("lastToken", token);
}

// ============================================================
// DOM READY
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("role") || "").toLowerCase();

  // Guard login
  if (!token || (role && role !== "jaksa" && role !== "prosecutor")) {
    showAlert("Silakan login sebagai jaksa terlebih dahulu.", "warning");
    setTimeout(() => (window.location.href = "/auth/login.html"), 900);
    return;
  }

  // token-change guard (biar gak nyangkut user lama)
  clearJaksaHintsIfTokenChanged(token);

  // Header & profile elements
  const jaksaNameEl = document.getElementById("jaksaName");

  const pfNama = document.getElementById("pfNama");
  const pfBidang = document.getElementById("pfBidang");

  const pfNamaDetail = document.getElementById("pfNamaDetail");
  const pfNip = document.getElementById("pfNip");
  const pfEmail = document.getElementById("pfEmail");
  const pfBidangDetail = document.getElementById("pfBidangDetail");

  const metaHint = document.getElementById("metaHint");
  const backBtn = document.getElementById("backBtn");

  // ✅ HIDE meta hint bawah (ID: ... | Bidang: ...)
  if (metaHint) {
    metaHint.textContent = "";
    metaHint.style.display = "none";
  }

  // Set header name from storage first
  const storedName = getStoredName();
  if (jaksaNameEl && storedName) jaksaNameEl.textContent = storedName;

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/jaksa/dashboard/dbjaksa.html";
    });
  }

  // Utility setText
  function setText(el, value, fallback = "-") {
    if (!el) return;
    const v = (value ?? "").toString().trim();
    el.textContent = v ? v : fallback;
  }

  // Map bidang: id -> nama (optional)
  const bidangMap = new Map();

  // ============================================================
  // LOAD BIDANG (optional, karena DB kamu sudah ada bidang_nama)
  // ============================================================
  async function loadBidang() {
    try {
      const res = await fetch(`${apiBase}/bidang`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("🏷️ [GET] /bidang RAW:", raw);

      if (!res.ok) {
        console.warn("⚠️ GET /bidang gagal:", res.status, data);
        return;
      }

      const normalized = normalizePayload(data);

      const list = Array.isArray(normalized)
        ? normalized
        : Array.isArray(normalized?.bidang)
        ? normalized.bidang
        : Array.isArray(normalized?.data)
        ? normalized.data
        : [];

      list.forEach((b) => {
        const id = b?._id || b?.id || b?.bidang_id;
        const nama = b?.nama || b?.name || b?.nama_bidang || b?.bidang;
        if (id && nama) bidangMap.set(String(id), String(nama));
      });

      console.log("✅ bidangMap size:", bidangMap.size);
    } catch (err) {
      console.warn("⚠️ Error loadBidang:", err);
    }
  }

  function resolveBidangName(j) {
    // PRIORITAS 1: bidang_nama dari DB kamu
    const bidangNamaDirect = j?.bidang_nama || j?.bidangNama || j?.bidang_name || "";
    if (bidangNamaDirect) return String(bidangNamaDirect);

    // PRIORITAS 2: map dari /bidang berdasarkan bidang_id
    const bidangId = j?.bidang_id || j?.bidangId || j?.bidangID || "";
    if (bidangId && bidangMap.size) {
      const mapped = bidangMap.get(String(bidangId));
      if (mapped) return mapped;
    }

    // PRIORITAS 3: embed object bidang
    const bidangObj = j?.bidang;
    if (bidangObj && typeof bidangObj === "object") {
      const nm = bidangObj.nama || bidangObj.name || bidangObj.nama_bidang;
      if (nm) return String(nm);
      const id = bidangObj._id || bidangObj.id;
      if (id && bidangMap.size) {
        const mapped = bidangMap.get(String(id));
        if (mapped) return mapped;
      }
    }

    return "";
  }

  // ============================================================
  // LOAD JAKSA LIST
  // ============================================================
  async function loadJaksaList() {
    const res = await fetch(`${apiBase}/jaksa`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const { data, raw } = await parseResponse(res);
    console.log("👨‍⚖️ [GET] /jaksa RAW:", raw);

    if (!res.ok) {
      console.warn("⚠️ GET /jaksa gagal:", res.status, data);
      throw new Error("GET /jaksa gagal");
    }

    const normalized = normalizePayload(data);

    const list = Array.isArray(normalized)
      ? normalized
      : Array.isArray(normalized?.jaksa)
      ? normalized.jaksa
      : Array.isArray(normalized?.data)
      ? normalized.data
      : [];

    console.log("✅ jaksa list length:", list.length);
    return list;
  }

  // ============================================================
  // identity from token (lebih valid dari localStorage)
  // ============================================================
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

  // ============================================================
  // PICK CURRENT JAKSA FROM LIST
  // PRIORITAS: token -> localStorage
  // ============================================================
  function pickCurrentJaksa(list) {
    const tokenIdent = getIdentityFromToken();

    const idLS = String(getStoredJaksaId() || "").trim();
    const emailLS = String(getStoredEmail() || "").toLowerCase().trim();
    const nameLS = String(getStoredName() || "").toLowerCase().trim();

    console.log("🔎 token identity:", tokenIdent);
    console.log("🔎 localStorage identity:", { idLS, emailLS, nameLS });

    // 0) match by TOKEN id
    if (tokenIdent.id) {
      const byTokenId = list.find((j) => String(j?._id || j?.id || "") === tokenIdent.id);
      if (byTokenId) return byTokenId;
    }

    // 1) match by TOKEN email
    if (tokenIdent.email) {
      const byTokenEmail = list.find(
        (j) => String(j?.email || "").toLowerCase().trim() === tokenIdent.email
      );
      if (byTokenEmail) return byTokenEmail;
    }

    // 2) match by TOKEN username/nama
    const tokenName = tokenIdent.username || tokenIdent.nama;
    if (tokenName) {
      const byTokenUsername = list.find(
        (j) => String(j?.username || "").toLowerCase().trim() === tokenName
      );
      if (byTokenUsername) return byTokenUsername;

      const byTokenNama = list.find(
        (j) => String(j?.nama || "").toLowerCase().trim() === tokenName
      );
      if (byTokenNama) return byTokenNama;
    }

    // 3) fallback localStorage id
    if (idLS) {
      const byId = list.find((j) => String(j?._id || j?.id || "") === idLS);
      if (byId) return byId;
    }

    // 4) fallback localStorage email
    if (emailLS) {
      const byEmail = list.find((j) => String(j?.email || "").toLowerCase().trim() === emailLS);
      if (byEmail) return byEmail;
    }

    // 5) fallback localStorage username/nama
    if (nameLS) {
      const byUsername = list.find((j) => String(j?.username || "").toLowerCase().trim() === nameLS);
      if (byUsername) return byUsername;

      const byNama = list.find((j) => String(j?.nama || "").toLowerCase().trim() === nameLS);
      if (byNama) return byNama;
    }

    // 6) kalau cuma 1 yaudah
    if (list.length === 1) return list[0];

    // 7) loose match terakhir
    if (nameLS) {
      const byLoose = list.find((j) => {
        const nm = String(j?.nama || j?.username || "").toLowerCase().trim();
        return nm && (nm.includes(nameLS) || nameLS.includes(nm));
      });
      if (byLoose) return byLoose;
    }

    return null;
  }

  // ============================================================
  // RENDER
  // ============================================================
  function renderJaksa(j) {
    const id = j?._id || j?.id || "";
    const nama = j?.nama || j?.name || j?.username || "";
    const nip = j?.nip || "";
    const email = j?.email || "";

    const bidangNama = resolveBidangName(j);

    // save biar halaman lain kebantu
    if (id) localStorage.setItem("jaksaId", id);
    if (nama) localStorage.setItem("jaksaName", nama);
    if (email) localStorage.setItem("jaksaEmail", email);
    if (bidangNama) localStorage.setItem("jaksaBidangNama", bidangNama);

    // header
    if (jaksaNameEl && nama) jaksaNameEl.textContent = nama;

    // top
    setText(pfNama, nama, "Jaksa");
    setText(pfBidang, bidangNama ? `Bidang: ${bidangNama}` : "Bidang: -");

    // details
    setText(pfNamaDetail, nama);
    setText(pfNip, nip);
    setText(pfEmail, email);
    setText(pfBidangDetail, bidangNama || "-");

    // ✅ metaHint sengaja tidak diisi (dan sudah disembunyikan)
    if (metaHint) {
      metaHint.textContent = "";
      metaHint.style.display = "none";
    }
  }

  // ============================================================
  // INIT
  // ============================================================
  (async () => {
    try {
      // metaHint disembunyikan, jadi gak usah set text "Memuat..." juga
      await loadBidang(); // optional

      const list = await loadJaksaList();
      const current = pickCurrentJaksa(list);

      if (!current) {
        console.warn("❌ Tidak menemukan jaksa login. Debug:", {
          tokenPayload: decodeJwtPayload(token),
          localStorage: {
            jaksaId: getStoredJaksaId(),
            email: getStoredEmail(),
            name: getStoredName(),
          },
        });

        showAlert(
          "Profil tidak ketemu. Kemungkinan token kamu bukan JWT / tidak berisi id/email. Solusi paling aman: saat login simpan jaksaId/email ke localStorage.",
          "warning"
        );
        return;
      }

      renderJaksa(current);
    } catch (err) {
      console.error("❌ init profile error:", err);
      showAlert("Gagal memuat profil. Cek console & network ya.", "error");
    }
  })();
});
