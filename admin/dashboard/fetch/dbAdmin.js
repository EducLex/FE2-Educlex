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
      if (totalJaksaEl) totalJaksaEl.textContent = "0";
      return;
    }

    const allowedRoles = ["user", "jaksa", "admin"];

    // hitung role jaksa
    const jaksaCount = list.filter((u) => {
      const role = pickField(u, ["role", "jabatan", "tipe"], "").toLowerCase().trim();
      return role === "jaksa";
    }).length;
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

  // ============================
  // Fetch dashboard (statistik)
  // ============================
  async function loadDashboard() {
    const token = getTokenOrRedirect();
    if (!token) return;

    const resp = await safeFetch(DASHBOARD_URL, {
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
    // (opsional) kalau kamu gak mau log sama sekali, comment baris ini:
    // console.log("✅ Dashboard payload:", payload);

    renderStats(payload);
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
      const resp = await safeFetch(USERS_URL, {
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
        return;
      }

      let list = [];
      const data = resp.data;

      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.users)) list = data.users;

      renderUsers(list);
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
        // console.log("✅ User list loaded from:", path, list);
        renderUsers(list);
        return;
      }
    }

    renderUsers([]);
  }

  // ============================
  // Initial load
  // ============================
  loadDashboard();
  loadUsers();
});
