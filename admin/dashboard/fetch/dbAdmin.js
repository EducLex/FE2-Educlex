// /admin/dashboard/assets/js/dbadmin.js

// Fallback kalau SweetAlert belum ada
if (typeof Swal === "undefined") {
  window.Swal = {
    fire: (title, text, icon) => {
      alert(`${title}\n${text || ""}`);
      return Promise.resolve();
    },
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const DASHBOARD_URL = `${API_BASE}/dashboard`;
  const UPDATE_ROLE_URL = `${API_BASE}/auth/update-role`;

  // ✅ Endpoint user yang TERBUKTI ada dari screenshot kamu
  const USERS_URL = `${API_BASE}/users`;

  // ✅ Tambahan: endpoint jaksa (buat total jaksa yang bener)
  const JAKSA_URL = `${API_BASE}/jaksa`;

  /**
   * Flag probing endpoint lain.
   * - false = NO ERROR CONSOLE (tidak coba endpoint 404)
   * - true  = coba list kandidat endpoint kalau suatu hari /users berubah
   */
  const ENABLE_ENDPOINT_PROBING = false;

  // Elemen statistik
  const totalArtikelEl = document.getElementById("totalArtikel");
  const totalPeraturanEl = document.getElementById("totalPeraturan");
  const totalUserEl = document.getElementById("totalUser");
  const totalJaksaEl = document.getElementById("totalJaksa");

  // Tabel pengguna
  const userTableBody = document.getElementById("userTableBody");

  // =========================================================
  // ✅ Anti double-init (kadang file ke-include 2x)
  // =========================================================
  if (window.__DBADMIN_BOOTED__) {
    console.warn("⚠️ dbadmin.js sudah jalan (skip double-boot).");
    return;
  }
  window.__DBADMIN_BOOTED__ = true;

  // =========================================================
  // ✅ Simple fetch cache biar gak race-condition
  // =========================================================
  const __fetchCache = new Map(); // url -> Promise<{ok,status,data}>
  async function cachedSafeFetch(url, options) {
    const key = `${url}::${options?.method || "GET"}`;
    if (__fetchCache.has(key)) return __fetchCache.get(key);

    const p = (async () => {
      try {
        const res = await fetch(url, options);
        const data = await readJsonSafe(res);
        return { ok: res.ok, status: res.status, data, res };
      } catch {
        return { ok: false, status: 0, data: { error: "Failed to fetch" }, res: null };
      }
    })();

    __fetchCache.set(key, p);
    return p;
  }

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

  // Kalau respons dibungkus { data: {...} } kita ambil data-nya
  function extractPayload(raw) {
    if (!raw || typeof raw !== "object") return {};
    if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
      return raw.data;
    }
    return raw;
  }

  function normalizeToken(raw = "") {
    let t = String(raw || "").trim();
    t = t.replace(/^["']|["']$/g, "");
    t = t.replace(/^Bearer\s+/i, "").trim();
    return t;
  }

  function getTokenOrRedirect() {
    const token = normalizeToken(localStorage.getItem("token") || "");
    if (!token) {
      Swal.fire("Harus login", "Silakan login sebagai admin terlebih dahulu.", "warning").then(
        () => {
          window.location.href = "/auth/login.html";
        }
      );
      return null;
    }
    return token;
  }

  async function readJsonSafe(res) {
    const raw = await res.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return { message: raw };
    }
  }

  // Wrapper fetch biar ga spam console kalau error jaringan
  async function safeFetch(url, options) {
    try {
      const res = await fetch(url, options);
      const data = await readJsonSafe(res);
      return { ok: res.ok, status: res.status, data, res };
    } catch {
      return { ok: false, status: 0, data: { error: "Failed to fetch" }, res: null };
    }
  }

  // =========================================================
  // ✅ Helper normalize list (users/jaksa)
  // =========================================================
  function normalizeList(data, possibleKeys = []) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      if (Array.isArray(data.data)) return data.data;
      for (const k of possibleKeys) {
        if (Array.isArray(data[k])) return data[k];
      }
    }
    return [];
  }

  // =========================================================
  // ✅ Hitung jaksa dari list /users (fallback)
  // =========================================================
  function countJaksaFromUsers(list) {
    if (!Array.isArray(list)) return 0;

    return list.filter((u) => {
      const role = pickField(u, ["role", "jabatan", "tipe"], "").toLowerCase().trim();
      // beberapa backend bisa pakai "prosecutor"
      return role === "jaksa" || role === "prosecutor";
    }).length;
  }

  // =========================================================
  // ✅ Hitung jaksa dari endpoint /jaksa (source of truth)
  // =========================================================
  async function fetchJaksaCount() {
    const token = getTokenOrRedirect();
    if (!token) return 0;

    const resp = await cachedSafeFetch(JAKSA_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: token,
      },
    });

    if (!resp.ok) {
      console.warn("⚠️ GET /jaksa gagal untuk hitung totalJaksa:", resp.status, resp.data);
      return 0;
    }

    // response bisa: array, {data:[...]}, {jaksa:[...]}
    const list = normalizeList(resp.data, ["jaksa", "prosecutors", "items", "results"]);
    return list.length;
  }

  // =========================================================
  // Render statistik
  // =========================================================
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
      "peraturan",
    ]);
    const totalUser = pickCount(data, [
      "total_user",
      "totalUsers",
      "userCount",
      "usersCount",
      "users",
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

    // ✅ jangan langsung percaya totalJaksa dari dashboard kalau 0
    // biar nanti bisa ditimpa hasil dari /jaksa (lebih bener)
    if (totalJaksaEl) totalJaksaEl.textContent = totalJaksa;
  }

  // ============================
  // UPDATE ROLE USER
  // ============================
  async function updateUserRole(userId, newRole) {
    const token = getTokenOrRedirect();
    if (!token) return;

    const resp = await safeFetch(UPDATE_ROLE_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        // sesuai backend: token langsung
        Authorization: token,
      },
      body: JSON.stringify({
        user_id: userId,
        role: newRole,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 401) {
        await Swal.fire(
          "Gagal mengubah role",
          resp.data?.error || resp.data?.message || "Invalid or expired token",
          "error"
        );
        localStorage.removeItem("token");
        window.location.href = "/auth/login.html";
        return;
      }

      await Swal.fire(
        "Gagal mengubah role",
        resp.data?.error || resp.data?.message || "Terjadi kesalahan pada server.",
        "error"
      );
      return;
    }

    await Swal.fire("Berhasil", resp.data?.message || "Role pengguna berhasil diperbarui.", "success");
    loadUsers(); // refresh tabel + total jaksa
    // ✅ refresh totalJaksa dari /jaksa biar update role langsung kebaca (kalau backend juga sync)
    refreshJaksaCountBestEffort();
  }

  // ============================
  // Render tabel user
  // ============================
  function renderUsers(list) {
    if (!userTableBody) return;

    if (!Array.isArray(list) || list.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#6d4c41;">
            Belum ada data pengguna.
          </td>
        </tr>
      `;

      // ✅ ini hanya fallback; nanti bisa ditimpa dari /jaksa
      if (totalJaksaEl) totalJaksaEl.textContent = "0";
      return;
    }

    const allowedRoles = ["user", "jaksa", "admin"];

    // hitung role jaksa dari /users (fallback)
    const jaksaCount = countJaksaFromUsers(list);

    // ✅ set dulu fallback, nanti kita timpa dengan /jaksa (source of truth)
    if (totalJaksaEl) totalJaksaEl.textContent = String(jaksaCount);

    userTableBody.innerHTML = list
      .map((u) => {
        const id = u._id || u.id || u.user_id || u.uid || "";
        const nama = pickField(u, ["nama", "name", "full_name", "username"], "-");
        const email = pickField(u, ["email", "mail"], "-");
        const role = pickField(u, ["role", "jabatan", "tipe"], "user");

        const optionsHtml = allowedRoles
          .map((r) => `<option value="${r}" ${r === role ? "selected" : ""}>${r}</option>`)
          .join("");

        return `
          <tr data-id="${id}">
            <td>${nama}</td>
            <td>${email}</td>
            <td><span class="role-label">${role}</span></td>
            <td>
              <div class="user-actions">
                <select class="role-select" data-id="${id}">
                  ${optionsHtml}
                </select>
                <button class="action-btn btn-update-role" type="button" data-id="${id}">
                  Ubah Role
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    userTableBody.querySelectorAll(".btn-update-role").forEach((btn) => {
      btn.addEventListener("click", () => {
        const userId = btn.getAttribute("data-id");
        const row = btn.closest("tr");
        if (!row || !userId) return;

        const select = row.querySelector(".role-select");
        if (!select) return;

        const newRole = select.value;

        Swal.fire({
          title: "Ubah role pengguna?",
          text: `Role akan diubah menjadi "${newRole}".`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#4CAF50",
          cancelButtonColor: "#6d4c41",
          confirmButtonText: "Ya, ubah",
          cancelButtonText: "Batal",
        }).then((result) => {
          if (result.isConfirmed) {
            updateUserRole(userId, newRole);
          }
        });
      });
    });
  }

  // =========================================================
  // ✅ Refresh totalJaksa pakai sumber terbaik
  // - dashboard kadang 0 → timpa pakai /jaksa
  // =========================================================
  async function refreshJaksaCountBestEffort() {
    try {
      const countFromJaksa = await fetchJaksaCount();
      if (countFromJaksa > 0) {
        if (totalJaksaEl) totalJaksaEl.textContent = String(countFromJaksa);
        return;
      }

      // kalau /jaksa gagal (0), minimal jangan blank: biarin fallback dari /users yang sudah di-set renderUsers()
      // tapi kalau totalJaksa masih 0 juga, ya tetap 0 (berarti beneran kosong / akses ditolak).
    } catch (e) {
      console.warn("⚠️ refreshJaksaCountBestEffort error:", e);
    }
  }

  // ============================
  // Fetch dashboard (statistik)
  // ============================
  async function loadDashboard() {
    const token = getTokenOrRedirect();
    if (!token) return;

    const resp = await cachedSafeFetch(DASHBOARD_URL, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: token,
      },
    });

    if (!resp.ok) {
      if (resp.status === 401) {
        Swal.fire(
          "Gagal memuat dashboard",
          resp.data?.error || resp.data?.message || "Invalid or expired token",
          "error"
        ).then(() => {
          localStorage.removeItem("token");
          window.location.href = "/auth/login.html";
        });
        return;
      }

      Swal.fire(
        "Gagal memuat dashboard",
        resp.data?.error || resp.data?.message || "Terjadi kesalahan pada server.",
        "error"
      );
      return;
    }

    const payload = extractPayload(resp.data);
    renderStats(payload);

    // ✅ setelah render stats, pastikan total jaksa bener
    refreshJaksaCountBestEffort();
  }

  // ============================
  // Fetch list user (NO 404 = NO console errors)
  // ============================
  async function loadUsers() {
    const token = getTokenOrRedirect();
    if (!token) return;

    if (userTableBody) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#6d4c41;">
            Memuat data pengguna...
          </td>
        </tr>
      `;
    }

    // ==== MODE AMAN: pakai endpoint yang sudah pasti ada ====
    if (!ENABLE_ENDPOINT_PROBING) {
      const resp = await cachedSafeFetch(USERS_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: token,
        },
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          Swal.fire(
            "Gagal memuat user",
            resp.data?.error || resp.data?.message || "Invalid or expired token",
            "error"
          ).then(() => {
            localStorage.removeItem("token");
            window.location.href = "/auth/login.html";
          });
          return;
        }

        Swal.fire("Gagal memuat user", resp.data?.error || resp.data?.message || "Server error.", "error");
        renderUsers([]);
        // ✅ tetap coba hitung jaksa dari /jaksa walau /users gagal
        refreshJaksaCountBestEffort();
        return;
      }

      let list = [];
      const data = resp.data;

      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.users)) list = data.users;

      renderUsers(list);

      // ✅ override totalJaksa pakai /jaksa
      refreshJaksaCountBestEffort();
      return;
    }

    // ==== MODE PROBING (DISIMPAN, tapi defaultnya OFF biar gak 404) ====
    const candidates = [
      "/users", // keep first
      "/auth/users",
      "/auth/all-users",
      "/auth/list-users",
      "/auth/get-users",
    ];

    for (const path of candidates) {
      const resp = await safeFetch(`${API_BASE}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: token,
        },
      });

      if (!resp.ok) continue;

      let list = [];
      const data = resp.data;
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.users)) list = data.users;

      if (list.length > 0) {
        renderUsers(list);
        refreshJaksaCountBestEffort();
        return;
      }
    }

    renderUsers([]);
    refreshJaksaCountBestEffort();
  }

  // ============================
  // Initial load
  // ============================
  loadDashboard();
  loadUsers();
});
