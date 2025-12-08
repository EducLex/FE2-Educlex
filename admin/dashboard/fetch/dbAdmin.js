// /admin/dashboard/assets/js/dbadmin.js

// Fallback kecil kalau SweetAlert belum ada
if (typeof Swal === "undefined") {
  window.Swal = {
    fire: (title, text, icon) => {
      alert(`${title}\n${text || ""}`);
    },
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  // Elemen statistik
  const totalArtikelEl = document.getElementById("totalArtikel");
  const totalPeraturanEl = document.getElementById("totalPeraturan");
  const totalUserEl = document.getElementById("totalUser");
  const totalJaksaEl = document.getElementById("totalJaksa");

  // Tabel pengguna
  const userTableBody = document.getElementById("userTableBody");

  // ============================
  // Helper umum
  // ============================
  function pickField(obj, keys, fallback = "") {
    if (!obj) return fallback;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        return String(obj[k]);
      }
    }
    return fallback;
  }

  function pickCount(obj, keys, fallback = 0) {
    if (!obj) return fallback;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        const val = obj[k];
        if (Array.isArray(val)) return val.length;
        if (typeof val === "number") return val;
      }
    }
    return fallback;
  }

  function findUserList(data) {
    if (!data || typeof data !== "object") return null;
    const candidateKeys = [
      "users",
      "pengguna",
      "latest_users",
      "recent_users",
      "data",
      "items",
    ];
    for (const key of candidateKeys) {
      if (Array.isArray(data[key])) {
        return data[key];
      }
    }
    return null;
  }

  // ============================
  // Render statistik
  // ============================
  function renderStats(data) {
    const totalArtikel = pickCount(data, [
      "total_artikel",
      "totalArtikel",
      "artikelCount",
      "articlesCount",
      "articles",
    ]);
    const totalPeraturan = pickCount(data, [
      "total_peraturan",
      "totalPeraturan",
      "peraturanCount",
      "regulationsCount",
      "regulations",
    ]);
    const totalUser = pickCount(data, [
      "total_user",
      "totalUsers",
      "userCount",
      "usersCount",
      "users",
      "pengguna",
    ]);
    const totalJaksa = pickCount(data, [
      "total_jaksa",
      "totalJaksa",
      "jaksaCount",
      "prosecutors",
    ]);

    if (totalArtikelEl) totalArtikelEl.textContent = totalArtikel;
    if (totalPeraturanEl) totalPeraturanEl.textContent = totalPeraturan;
    if (totalUserEl) totalUserEl.textContent = totalUser;
    if (totalJaksaEl) totalJaksaEl.textContent = totalJaksa;
  }

  // ============================
  // Render tabel user
  // ============================
  function renderUsers(data) {
    if (!userTableBody) return;

    const users = findUserList(data);

    if (!users || users.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#6d4c41;">
            Belum ada data pengguna.
          </td>
        </tr>
      `;
      return;
    }

    userTableBody.innerHTML = users
      .map((u) => {
        const nama = pickField(u, ["nama", "name", "full_name", "username"], "-");
        const email = pickField(u, ["email", "mail"], "-");
        const role = pickField(u, ["role", "jabatan", "tipe"], "-");

        return `
          <tr>
            <td>${nama}</td>
            <td>${email}</td>
            <td>${role}</td>
            <td>
              <button class="action-btn btn-view" type="button" disabled>
                Detail
              </button>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  // ============================
  // Fetch dashboard
  // ============================
  async function loadDashboard() {
    const token = localStorage.getItem("token");

    if (!token) {
      Swal.fire(
        "Harus login",
        "Silakan login sebagai admin terlebih dahulu.",
        "warning"
      ).then(() => {
        window.location.href = "/auth/login.html";
      });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/dashboard`, {
        method: "GET",
        headers: {
          // ⚠️ SESUAI DENGAN CURL: TANPA "Bearer "
          Authorization: token,
        },
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = {};
      }

      if (!res.ok) {
        // Khusus 401 → token invalid / expired
        if (res.status === 401) {
          Swal.fire(
            "Gagal memuat dashboard",
            data.error || data.message || "Invalid or expired token",
            "error"
          ).then(() => {
            // hapus token lalu paksa login ulang
            localStorage.removeItem("token");
            window.location.href = "/auth/login.html";
          });
          return;
        }

        // Error lain (500, dsb)
        Swal.fire(
          "Gagal memuat dashboard",
          data.error || data.message || "Terjadi kesalahan pada server.",
          "error"
        );
        return;
      }

      // Kalau sukses, isi statistik & user
      renderStats(data);
      renderUsers(data);
    } catch (err) {
      // Jangan pakai console.error biar nggak merah-merah di console
      console.warn("Gagal fetch /dashboard:", err);
      Swal.fire(
        "Koneksi gagal",
        "Tidak dapat terhubung ke server. Coba beberapa saat lagi.",
        "error"
      );
    }
  }

  // ============================
  // Initial load
  // ============================
  loadDashboard();
});
