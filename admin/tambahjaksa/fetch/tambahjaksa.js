// /admin/tambahjaksa/fetch/tambahjaksa.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  // === ENDPOINTS ===
  const REGISTER_JAKSA_ENDPOINT = "/auth/register-jaksa";
  const BIDANG_ENDPOINT = "/bidang";
  const VERIFY_EMAIL_ENDPOINT = "/auth/verify-email";
  const JAKSA_LIST_ENDPOINT = "/jaksa";

  // Reset password (yang kamu kasih)
  const FORGOT_PASSWORD_ENDPOINT = "/jaksa/auth/forgot-password";
  const RESET_PASSWORD_ENDPOINT = "/jaksa/auth/reset-password-jaksa";

  // === ELEMENTS ===
  const formJaksa = document.getElementById("formJaksa");
  const tabelBody = document.getElementById("tabelJaksaBody");
  const selectBidang = document.getElementById("bidang_nama");

  const namaInput = document.getElementById("nama");
  const nipInput = document.getElementById("nip");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm_password");

  const jabatanInput = document.getElementById("jabatan"); // boleh null
  const fotoInput = document.getElementById("foto"); // boleh null

  const submitBtn = formJaksa?.querySelector(".btn-simpan");

  // === STATE ===
  let isEditMode = false;
  let editingJaksaId = null;

  // cache jaksa: id -> object jaksa
  const jaksaCache = new Map();

  // mapping bidang: nama(normalized) -> id
  const bidangNameToId = new Map();

  // =========================
  // Helpers
  // =========================
  function normalizeToken(raw = "") {
    let t = String(raw || "").trim();
    t = t.replace(/^["']|["']$/g, "");
    t = t.replace(/^Bearer\s+/i, "").trim();
    return t;
  }

  function getToken() {
    const candidates = [
      localStorage.getItem("token"),
      localStorage.getItem("access_token"),
      localStorage.getItem("admin_token"),
      localStorage.getItem("adminToken"),
      localStorage.getItem("auth_token"),
      localStorage.getItem("authToken"),
    ]
      .map((v) => normalizeToken(v || ""))
      .filter(Boolean);
    return candidates[0] || "";
  }

  function authHeaders(extra = {}, mode = "raw") {
    // mode: "raw" | "bearer" | "none"
    const headers = { ...extra };
    const token = getToken();
    if (mode !== "none" && token) {
      headers.Authorization = mode === "bearer" ? `Bearer ${token}` : token;
    }
    // PENTING: jangan pakai x-auth-token (bikin CORS)
    return headers;
  }

  function showError(message) {
    Swal.fire("Gagal", message, "error");
  }

  function showSuccess(message) {
    Swal.fire("Berhasil", message, "success");
  }

  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function readJsonSafe(res) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  function formatBackendError(data) {
    if (!data) return "";
    if (typeof data === "string") return data;

    const parts = [];
    if (data.error) parts.push(String(data.error));
    if (data.message) parts.push(String(data.message));
    if (Array.isArray(data.errors)) {
      parts.push(
        data.errors
          .map((e) => (typeof e === "string" ? e : JSON.stringify(e)))
          .join("\n")
      );
    }
    if (data.details) {
      parts.push(
        typeof data.details === "string"
          ? data.details
          : JSON.stringify(data.details, null, 2)
      );
    }
    return parts.filter(Boolean).join("\n");
  }

  function normName(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function appendIf(fd, key, value) {
    if (value === undefined || value === null) return;
    const v = String(value).trim();
    if (!v) return;
    fd.append(key, v);
  }

  function buildFormData(obj) {
    const fd = new FormData();
    Object.entries(obj || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      const t = typeof v;
      if (t === "object") return;
      const s = String(v).trim();
      if (!s) return;
      fd.append(k, s);
    });
    return fd;
  }

  function getJaksaId(j) {
    return (
      j?.id ||
      j?._id ||
      j?.jaksa_id ||
      j?.user_id ||
      j?.user?.id ||
      j?.user?._id ||
      j?.account_id ||
      ""
    );
  }

  function getBidangInfo(j) {
    const bidangId =
      j?.bidang_id ||
      j?.bidangId ||
      j?.bidang?.id ||
      j?.bidang?._id ||
      j?.bidang?.bidang_id ||
      "";

    const bidangNama =
      j?.bidang_nama ||
      j?.bidangNama ||
      j?.bidang?.nama ||
      j?.bidang?.name ||
      (typeof j?.bidang === "string" ? j.bidang : "") ||
      "";

    return {
      bidangId: String(bidangId || "").trim(),
      bidangNama: String(bidangNama || "").trim(),
    };
  }

  function getJabatan(j) {
    return (
      j?.jabatan ||
      j?.jabatan_nama ||
      j?.role_jabatan ||
      j?.posisi ||
      j?.position ||
      ""
    );
  }

  function pickPrimitiveFields(obj) {
    const out = {};
    if (!obj || typeof obj !== "object") return out;

    Object.entries(obj).forEach(([k, v]) => {
      if (v === undefined || v === null) return;

      const lk = String(k).toLowerCase();
      if (
        lk === "id" ||
        lk === "_id" ||
        lk.includes("created") ||
        lk.includes("updated") ||
        lk.includes("deleted") ||
        lk.includes("password")
      ) {
        return;
      }

      const t = typeof v;
      if (t === "string" || t === "number" || t === "boolean") {
        out[k] = v;
      }
    });

    const { bidangId, bidangNama } = getBidangInfo(obj);
    if (bidangId) out.bidang_id = bidangId;
    if (bidangNama) out.bidang_nama = bidangNama;

    const jab = getJabatan(obj);
    if (jab && !out.jabatan) out.jabatan = jab;

    return out;
  }

  async function safeFetch(url, options) {
    try {
      const res = await fetch(url, options);
      const data = await readJsonSafe(res);
      return { ok: res.ok, status: res.status, data, res };
    } catch {
      return { ok: false, status: 0, data: { error: "Failed to fetch" }, res: null };
    }
  }

  async function fetchWithAuthFallback(url, options, modes = ["raw", "bearer"]) {
    let last = null;
    for (const mode of modes) {
      const headers = authHeaders(options.headers || {}, mode);
      const attempt = await safeFetch(url, { ...options, headers });
      last = attempt;
      if (attempt.ok) return attempt;

      // kalau auth error, coba mode lain
      const txt = JSON.stringify(attempt.data || {});
      if (
        attempt.status === 401 ||
        attempt.status === 403 ||
        /terautentikasi|unauthorized|forbidden/i.test(txt)
      ) {
        continue;
      }

      // bukan auth error -> stop biar ga spam
      return attempt;
    }
    return last || { ok: false, status: 0, data: { error: "Unknown error" } };
  }

  function setCreateMode() {
    isEditMode = false;
    editingJaksaId = null;

    if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-save"></i> Simpan Data Jaksa`;
    if (formJaksa) formJaksa.reset();

    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.setAttribute("required", "required");
    }
    if (confirmInput) {
      confirmInput.value = "";
      confirmInput.setAttribute("required", "required");
    }
    if (selectBidang) selectBidang.selectedIndex = 0;
  }

  function setEditMode(id) {
    isEditMode = true;
    editingJaksaId = id;

    if (submitBtn) submitBtn.innerHTML = `<i class="fas fa-save"></i> Perbarui Data Jaksa`;

    if (passwordInput) {
      passwordInput.value = "";
      passwordInput.removeAttribute("required");
    }
    if (confirmInput) {
      confirmInput.value = "";
      confirmInput.removeAttribute("required");
    }
  }

  // =========================
  // Bidang
  // =========================
  async function loadBidang() {
    if (!selectBidang) return;
    if (!getToken()) return;

    const url = `${API_BASE}${BIDANG_ENDPOINT}`;
    const resp = await fetchWithAuthFallback(
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      ["raw", "bearer"]
    );

    if (!resp.ok) return;

    const data = resp.data;
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : null;
    if (!list || list.length === 0) return;

    bidangNameToId.clear();
    list.forEach((item) => {
      const id = item.id || item._id || item.bidang_id || item.value || "";
      const nama = item.nama || item.name || item.bidang_nama || "";
      if (!id || !nama) return;
      bidangNameToId.set(normName(nama), String(id).trim());
    });

    Array.from(selectBidang.options).forEach((opt) => {
      const nm = normName(opt.value || opt.textContent || "");
      const id = bidangNameToId.get(nm);
      if (id) opt.dataset.id = id;
    });
  }

  // =========================
  // Render tabel
  // =========================
  function renderJaksaTable(list) {
    if (!tabelBody) return;

    if (!Array.isArray(list) || list.length === 0) {
      tabelBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada data jaksa</td></tr>`;
      return;
    }

    jaksaCache.clear();
    list.forEach((j) => {
      const id = getJaksaId(j);
      if (id) jaksaCache.set(String(id), j);
    });

    tabelBody.innerHTML = list
      .map((j) => {
        const id = getJaksaId(j);
        const nama = j.nama || j.name || "-";
        const nip = j.nip || "-";
        const email = j.email || "-";
        const jabatan = getJabatan(j);
        const { bidangId, bidangNama } = getBidangInfo(j);

        return `
          <tr
            data-id="${escapeHtml(id)}"
            data-nama="${escapeHtml(nama)}"
            data-nip="${escapeHtml(nip)}"
            data-email="${escapeHtml(email)}"
            data-jabatan="${escapeHtml(jabatan)}"
            data-bidang-id="${escapeHtml(String(bidangId || ""))}"
            data-bidang-nama="${escapeHtml(String(bidangNama || ""))}"
          >
            <td>${escapeHtml(nama)}</td>
            <td>${escapeHtml(nip)}</td>
            <td>${escapeHtml(email)}</td>
            <td>
              <button class="btn-aksi btn-edit" data-id="${escapeHtml(id)}">
                <i class="fas fa-pen"></i> Edit
              </button>
              <button class="btn-aksi btn-delete" data-id="${escapeHtml(id)}">
                <i class="fas fa-trash"></i> Hapus
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    tabelBody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const tr = btn.closest("tr");
        if (!id || !tr) return;

        const nama = tr.getAttribute("data-nama") || "";
        const nip = tr.getAttribute("data-nip") || "";
        const email = tr.getAttribute("data-email") || "";
        const jabatan = tr.getAttribute("data-jabatan") || "";
        const bidangNama = (tr.getAttribute("data-bidang-nama") || "").trim();
        const bidangId = (tr.getAttribute("data-bidang-id") || "").trim();

        if (namaInput) namaInput.value = nama;
        if (nipInput) nipInput.value = nip;
        if (emailInput) emailInput.value = email;
        if (jabatanInput) jabatanInput.value = jabatan;

        if (selectBidang && bidangNama) {
          const optByName = Array.from(selectBidang.options).find(
            (o) => normName(o.value || o.textContent || "") === normName(bidangNama)
          );
          if (optByName) {
            selectBidang.value = optByName.value;
            if (bidangId && !optByName.dataset.id) optByName.dataset.id = bidangId;
          }
        }

        setEditMode(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    tabelBody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        hapusJaksa(id);
      });
    });
  }

  // =========================
  // Load daftar jaksa
  // =========================
  async function loadDaftarJaksa() {
    if (!tabelBody) return;

    if (!getToken()) {
      tabelBody.innerHTML = `
        <tr><td colspan="4" style="text-align:center; color:#f44336;">
          Sesi admin habis. Silakan login ulang.
        </td></tr>
      `;
      return;
    }

    tabelBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data jaksa...</td></tr>`;

    const url = `${API_BASE}${JAKSA_LIST_ENDPOINT}`;
    const resp = await fetchWithAuthFallback(
      url,
      { method: "GET", headers: { Accept: "application/json" } },
      ["raw", "bearer"]
    );

    if (!resp.ok) {
      tabelBody.innerHTML = `
        <tr><td colspan="4" style="text-align:center; color:#f44336;">
          Gagal memuat data jaksa.
        </td></tr>
      `;
      return;
    }

    const data = resp.data;
    const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    renderJaksaTable(list);
  }

  // =========================
  // Hapus Jaksa
  // =========================
  async function hapusJaksa(id) {
    if (!getToken()) {
      showError("Sesi admin habis. Silakan login ulang.");
      return;
    }

    const konfirmasi = await Swal.fire({
      title: "Hapus Jaksa ini?",
      text: "Tindakan ini tidak dapat dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d32f2f",
      cancelButtonColor: "#6d4c41",
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
    });

    if (!konfirmasi.isConfirmed) return;

    const safeId = encodeURIComponent(String(id));
    const url = `${API_BASE}${JAKSA_LIST_ENDPOINT}/${safeId}`;

    const resp = await fetchWithAuthFallback(
      url,
      { method: "DELETE", headers: { Accept: "application/json" } },
      ["raw", "bearer"]
    );

    if (!resp.ok) {
      showError(formatBackendError(resp.data) || `Gagal menghapus (status ${resp.status}).`);
      return;
    }

    if (isEditMode && editingJaksaId && String(editingJaksaId) === String(id)) {
      setCreateMode();
    }

    showSuccess(resp.data?.message || "Data jaksa berhasil dihapus.");
    await loadDaftarJaksa();
  }

  // =========================
  // UPDATE Jaksa (PUT only)
  // =========================
  async function updateJaksaPut(url, payload, fotoFile) {
    const jsonAttempt = await fetchWithAuthFallback(
      url,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      },
      ["raw", "bearer"]
    );
    if (jsonAttempt.ok) return jsonAttempt;

    const fd = buildFormData(payload);
    if (fotoFile) fd.append("foto", fotoFile);

    const fdAttempt = await fetchWithAuthFallback(
      url,
      { method: "PUT", headers: { Accept: "application/json" }, body: fd },
      ["raw", "bearer"]
    );
    return fdAttempt;
  }

  // =========================
  // OTP: VERIFIKASI EMAIL (ANTI-SPAM)
  // =========================
  function cleanOtpKeepLeadingZeros(otpRaw) {
    // ambil digit saja, tapi tetap mempertahankan nol di depan
    return String(otpRaw || "").replace(/\D/g, "");
  }

  async function verifyEmailOnce(email, otpDigits) {
    const url = `${API_BASE}${VERIFY_EMAIL_ENDPOINT}`;
    // email distandarkan biar ga beda case
    const body = { email: String(email || "").trim().toLowerCase(), otp: String(otpDigits || "") };

    return safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function runEmailVerificationFlow(email, options = {}) {
    const { allowRollback = false, rollbackFind = null } = options;

    const ask = await Swal.fire({
      title: "Verifikasi Email",
      html: `Masukkan OTP yang dikirim ke <b>${escapeHtml(email)}</b>.`,
      input: "text",
      inputPlaceholder: "Masukkan OTP",
      showCancelButton: true,
      confirmButtonText: "Verifikasi",
      cancelButtonText: "Nanti",
    });

    if (!ask.isConfirmed) return { ok: false, cancelled: true };

    const otpDigits = cleanOtpKeepLeadingZeros(ask.value);
    if (!otpDigits) {
      Swal.fire("Gagal", "OTP kosong / tidak valid. Pastikan kamu paste angka OTP.", "error");
      return { ok: false };
    }

    // 1x request saja (ini kuncinya biar OTP gak “kebakar”)
    let resp = await verifyEmailOnce(email, otpDigits);

    if (resp.ok) {
      Swal.fire("Berhasil", resp.data?.message || "Email berhasil diverifikasi.", "success");
      return { ok: true };
    }

    // kalau gagal, kasih opsi retry cerdas (bukan spam request)
    const errText = formatBackendError(resp.data) || `Gagal verifikasi (status ${resp.status}).`;

    // kemungkinan backend nyimpen OTP sebagai angka tanpa nol depan
    const otpNoLeadingZeros = otpDigits.replace(/^0+/, "");
    const canTryNoZero = otpNoLeadingZeros && otpNoLeadingZeros !== otpDigits;

    const retry = await Swal.fire({
      title: "Gagal Verifikasi",
      html:
        `${escapeHtml(errText)}<br/><br/>` +
        (canTryNoZero
          ? `OTP kamu diawali <b>0</b>? Kadang backend nyocokin sebagai angka. Mau coba kirim OTP tanpa nol depan (<b>${escapeHtml(
              otpNoLeadingZeros
            )}</b>)?`
          : `Mau coba input OTP ulang?`),
      showCancelButton: true,
      confirmButtonText: canTryNoZero ? "Coba tanpa nol depan" : "Input ulang",
      cancelButtonText: "Batal",
    });

    if (!retry.isConfirmed) {
      // kalau user maunya “data gak boleh masuk kalau OTP gagal”, rollback kalau diminta
      if (allowRollback && typeof rollbackFind === "function") {
        await rollbackFind();
      }
      return { ok: false };
    }

    if (canTryNoZero) {
      resp = await verifyEmailOnce(email, otpNoLeadingZeros);
      if (resp.ok) {
        Swal.fire("Berhasil", resp.data?.message || "Email berhasil diverifikasi.", "success");
        return { ok: true };
      }
      Swal.fire(
        "Masih gagal",
        formatBackendError(resp.data) || "OTP masih ditolak. Coba input OTP ulang dari email terbaru.",
        "error"
      );
      if (allowRollback && typeof rollbackFind === "function") {
        await rollbackFind();
      }
      return { ok: false };
    }

    // input ulang manual
    const again = await Swal.fire({
      title: "Input OTP ulang",
      input: "text",
      inputPlaceholder: "Masukkan OTP terbaru",
      showCancelButton: true,
      confirmButtonText: "Verifikasi",
      cancelButtonText: "Batal",
    });

    if (!again.isConfirmed) {
      if (allowRollback && typeof rollbackFind === "function") {
        await rollbackFind();
      }
      return { ok: false };
    }

    const otp2 = cleanOtpKeepLeadingZeros(again.value);
    if (!otp2) {
      Swal.fire("Gagal", "OTP kosong / tidak valid.", "error");
      if (allowRollback && typeof rollbackFind === "function") {
        await rollbackFind();
      }
      return { ok: false };
    }

    resp = await verifyEmailOnce(email, otp2);
    if (resp.ok) {
      Swal.fire("Berhasil", resp.data?.message || "Email berhasil diverifikasi.", "success");
      return { ok: true };
    }

    Swal.fire("Gagal Verifikasi", formatBackendError(resp.data) || "OTP tidak valid.", "error");

    if (allowRollback && typeof rollbackFind === "function") {
      await rollbackFind();
    }
    return { ok: false };
  }

  // rollback: kalau OTP gagal, hapus data yang barusan keburu masuk
  async function rollbackJaksaByEmail(email) {
    try {
      // refresh list dulu
      await loadDaftarJaksa();
      const targetEmail = String(email || "").trim().toLowerCase();

      let idToDelete = null;
      for (const [id, j] of jaksaCache.entries()) {
        const em = String(j?.email || "").trim().toLowerCase();
        if (em === targetEmail) {
          idToDelete = id;
          break;
        }
      }
      if (!idToDelete) return;

      const url = `${API_BASE}${JAKSA_LIST_ENDPOINT}/${encodeURIComponent(String(idToDelete))}`;
      await fetchWithAuthFallback(
        url,
        { method: "DELETE", headers: { Accept: "application/json" } },
        ["raw", "bearer"]
      );
      await loadDaftarJaksa();
    } catch {
      // no-op
    }
  }

  // =========================
  // Reset password OTP (edit)
  // =========================
  async function requestForgotPasswordOtp(email) {
    const url = `${API_BASE}${FORGOT_PASSWORD_ENDPOINT}`;
    return safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: String(email || "").trim().toLowerCase() }),
    });
  }

  async function resetPasswordWithOtp(email, otpRaw, newPassword, confirmPassword) {
    const url = `${API_BASE}${RESET_PASSWORD_ENDPOINT}`;
    const otp = cleanOtpKeepLeadingZeros(otpRaw);

    // 1 request per method (jangan spam)
    const body = {
      email: String(email || "").trim().toLowerCase(),
      otp: otp,
      password: newPassword,
      confirm_password: confirmPassword,
    };

    // coba POST dulu
    let resp = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (resp.ok) return resp;

    // kalau server kamu ternyata maunya PUT
    resp = await safeFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return resp;
  }

  // =========================
  // Submit
  // =========================
  async function handleSubmit(e) {
    e.preventDefault();

    const nama = (namaInput?.value || "").trim();
    const nip = (nipInput?.value || "").trim();
    const email = (emailInput?.value || "").trim();
    const password = passwordInput?.value || "";
    const confirmPassword = confirmInput?.value || "";

    const bidangNama = String(selectBidang?.value || "").trim();
    const opt = selectBidang?.options?.[selectBidang.selectedIndex];
    const bidangIdFromDataset = opt?.dataset?.id ? String(opt.dataset.id).trim() : "";
    const bidangIdFromMap = bidangNameToId.get(normName(bidangNama)) || "";
    const bidangIdSelect = bidangIdFromDataset || bidangIdFromMap;

    const jabatanFromInput = (jabatanInput?.value || "").trim();

    if (!nama || !nip || !email || !bidangNama) {
      showError("Nama, NIP, bidang, dan email wajib diisi.");
      return;
    }
    if (!/^\d+$/.test(nip)) {
      showError("NIP wajib berisi angka saja.");
      return;
    }

    const fotoFile =
      fotoInput && fotoInput.files && fotoInput.files.length > 0 ? fotoInput.files[0] : null;

    const isTypingPassword = Boolean(password || confirmPassword);

    if (!isEditMode) {
      if (!password || !confirmPassword) return showError("Password dan konfirmasi password wajib diisi.");
      if (password !== confirmPassword) return showError("Password dan konfirmasi password tidak sama.");
      if (password.length < 8) return showError("Password minimal 8 karakter.");
    } else {
      if (isTypingPassword) {
        if (password !== confirmPassword) return showError("Password dan konfirmasi password tidak sama.");
        if (password.length < 8) return showError("Password minimal 8 karakter.");
      }
    }

    if (!getToken()) {
      showError("Sesi admin habis. Silakan login ulang.");
      return;
    }

    // =========================
    // MODE EDIT
    // =========================
    if (isEditMode && editingJaksaId) {
      const safeId = encodeURIComponent(String(editingJaksaId));
      const url = `${API_BASE}${JAKSA_LIST_ENDPOINT}/${safeId}`;

      const cached = jaksaCache.get(String(editingJaksaId)) || {};
      const cachedPrims = pickPrimitiveFields(cached);
      const cachedBidang = getBidangInfo(cached);
      const oldEmail = String(cached?.email || "").trim();

      const bidang_id = (bidangIdSelect || cachedBidang.bidangId || "").trim();
      const bidang_nama = (bidangNama || cachedBidang.bidangNama || "").trim();

      if (!bidang_id || !bidang_nama) {
        showError("Bidang ID dan Nama harus diisi. Pastikan dropdown bidang dipilih dengan benar.");
        return;
      }

      const jabatan = jabatanFromInput || cachedPrims.jabatan || getJabatan(cached);

      const payload = {
        ...cachedPrims,
        nama,
        nip,
        email,
        bidang_id,
        bidang_nama,
        ...(jabatan ? { jabatan } : {}),
        bidangId: bidang_id,
        id_bidang: bidang_id,
        bidangNama: bidang_nama,
        bidang: bidang_nama,
      };

      const updateResp = await updateJaksaPut(url, payload, fotoFile);

      if (!updateResp.ok) {
        showError(formatBackendError(updateResp.data) || `Gagal memperbarui (status ${updateResp.status}).`);
        return;
      }

      // kalau email berubah, kasih opsi verifikasi (kalau backend memang ngirim OTP)
      if (email && oldEmail && email.trim().toLowerCase() !== oldEmail.trim().toLowerCase()) {
        await runEmailVerificationFlow(email);
      }

      // kalau ganti password saat edit -> OTP reset password
      if (isTypingPassword) {
        const fp = await requestForgotPasswordOtp(email);
        if (!fp.ok) {
          showError(formatBackendError(fp.data) || `Gagal minta OTP reset password (status ${fp.status}).`);
        } else {
          const otpAsk = await Swal.fire({
            title: "OTP Reset Password",
            html: `OTP reset password dikirim ke <b>${escapeHtml(email)}</b>.`,
            input: "text",
            inputPlaceholder: "Masukkan OTP",
            showCancelButton: true,
            confirmButtonText: "Reset Password",
            cancelButtonText: "Nanti",
          });

          if (otpAsk.isConfirmed && otpAsk.value) {
            const rs = await resetPasswordWithOtp(email, otpAsk.value, password, confirmPassword);
            if (!rs.ok) {
              showError(formatBackendError(rs.data) || `Gagal reset password (status ${rs.status}).`);
            } else {
              showSuccess(rs.data?.message || "Password berhasil direset.");
            }
          }
        }
      }

      showSuccess(updateResp.data?.message || "Data jaksa berhasil diperbarui.");
      setCreateMode();
      await loadDaftarJaksa();
      return;
    }

    // =========================
    // MODE TAMBAH BARU
    // =========================
    const username = nama;

    const formData = new FormData();
    appendIf(formData, "nama", nama);
    appendIf(formData, "username", username);
    appendIf(formData, "nip", nip);
    appendIf(formData, "email", email);
    appendIf(formData, "bidang_nama", bidangNama);
    if (bidangIdSelect) appendIf(formData, "bidang_id", bidangIdSelect);
    if (jabatanFromInput) appendIf(formData, "jabatan", jabatanFromInput);
    appendIf(formData, "password", password);
    appendIf(formData, "confirm_password", confirmPassword);
    if (fotoFile) formData.append("foto", fotoFile);

    const registerResp = await fetchWithAuthFallback(
      `${API_BASE}${REGISTER_JAKSA_ENDPOINT}`,
      { method: "POST", headers: { Accept: "application/json" }, body: formData },
      ["raw", "bearer"]
    );

    if (!registerResp.ok) {
      showError(formatBackendError(registerResp.data) || `Gagal menyimpan (status ${registerResp.status}).`);
      return;
    }

    // data masuk dulu (memang begitu BE kamu), tapi kita paksa: OTP harus sukses,
    // kalau OTP gagal -> rollback hapus data yang barusan masuk (biar sesuai maumu)
    showSuccess(
      registerResp.data?.message ||
        "Data jaksa berhasil disimpan. OTP verifikasi telah dikirim ke email jaksa."
    );

    // refresh tabel dulu biar cache kebaca untuk rollback
    await loadDaftarJaksa();

    const verifyResult = await runEmailVerificationFlow(email, {
      allowRollback: true,
      rollbackFind: async () => {
        await rollbackJaksaByEmail(email);
        Swal.fire(
          "Dibatalkan",
          "Verifikasi OTP gagal, jadi data jaksa yang barusan dibuat aku hapus lagi (biar gak ada data 'setengah jadi'). Silakan tambah ulang dan pakai OTP terbaru.",
          "info"
        );
      },
    });

    if (verifyResult.ok) {
      // kalau sukses, baru reset form
      setCreateMode();
      await loadDaftarJaksa();
    }
  }

  // =========================
  // init
  // =========================
  if (formJaksa) formJaksa.addEventListener("submit", handleSubmit);

  setCreateMode();
  loadBidang();
  loadDaftarJaksa();
});
