// /jaksa/tulisanJaksa/fetch/tulisanjaksa.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const formTulisan = document.getElementById("formTulisan");
  const inputPenulis = document.getElementById("penulis");
  const inputJudul = document.getElementById("judul");
  const inputIsi = document.getElementById("isi");
  const inputTanggal = document.getElementById("tanggal");
  const tbody = document.getElementById("tabelTulisanBody");

  // dropdown bidang (wajib ada di HTML). Kalau belum ada, script ini auto-inject.
  const findBidangSelect = () =>
    document.querySelector(
      "#bidangId, #bidang_id, #bidang, select[name='bidang_id'], select[name='bidangId'], select[data-role='bidang']"
    );

  let selectBidang = findBidangSelect();
  let editingId = null;

  // simpan mapping bidang
  let bidangList = []; // [{_id,name}]
  let bidangMap = new Map(); // id -> name

  // 8 bidang yang harus muncul di dropdown (fixed)
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

  // ==========================
  // Helpers
  // ==========================
  const getToken = () => localStorage.getItem("token") || "";
  const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v || ""));

  const pickField = (obj, keys, fallback = "") => {
    if (!obj) return fallback;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
        return String(obj[k]);
      }
    }
    return fallback;
  };

  const safe = (s) => String(s || "").replace(/"/g, "&quot;");

  const toDateInput = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  // ==========================
  // Ensure dropdown bidang ada
  // ==========================
  function ensureBidangSelect() {
    selectBidang = findBidangSelect();
    if (selectBidang) return;

    // Inject dropdown jika HTML belum ada
    const wrapper = document.createElement("div");
    wrapper.style.margin = "10px 0";

    const label = document.createElement("label");
    label.textContent = "Bidang (Instansi)";
    label.setAttribute("for", "bidangId");
    label.style.display = "block";
    label.style.marginBottom = "6px";
    label.style.fontWeight = "700";
    label.style.color = "#4e342e";

    const select = document.createElement("select");
    select.id = "bidangId";
    select.name = "bidang_id";
    select.dataset.role = "bidang";
    select.style.width = "100%";
    select.style.padding = "10px 12px";
    select.style.borderRadius = "10px";
    select.style.border = "1px solid #d7ccc8";
    select.style.fontFamily = "Poppins, sans-serif";

    wrapper.appendChild(label);
    wrapper.appendChild(select);

    // taruh sebelum tanggal (kalau ada)
    if (inputTanggal && inputTanggal.parentElement) {
      inputTanggal.parentElement.insertBefore(wrapper, inputTanggal);
    } else if (formTulisan) {
      formTulisan.insertBefore(wrapper, formTulisan.firstChild);
    } else {
      document.body.appendChild(wrapper);
    }

    selectBidang = select;
  }

  // ==========================
  // Load bidang dari endpoint /bidang
  // - hanya tampil 8 bidang (FIXED_8_BIDANG)
  // - value option = _id (ObjectId)
  // ==========================
  async function loadBidang() {
    ensureBidangSelect();
    if (!selectBidang) return;

    selectBidang.innerHTML = `<option value="">-- Pilih Bidang --</option>`;

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
        console.error("❌ GET /bidang gagal:", res.status, raw);
        Swal.fire({
          icon: "error",
          title: "Gagal memuat Bidang",
          text: "Endpoint /bidang gagal. Cek server/authorization.",
          confirmButtonColor: "#6D4C41",
        });
        return;
      }

      if (!Array.isArray(data)) data = [];

      // normalisasi minimal: {_id, name}
      let normalized = data
        .map((b) => {
          const _id = b._id || b.id || "";
          const name = pickField(b, ["name", "nama", "bidang"], "");
          return { _id, name };
        })
        .filter((b) => isObjectId(b._id) && b.name);

      // filter: hanya 8 bidang yang kamu mau
      const fixedLower = new Set(FIXED_8_BIDANG.map((x) => x.toLowerCase()));
      normalized = normalized.filter((b) => fixedLower.has(b.name.toLowerCase()));

      // sort sesuai urutan FIXED_8_BIDANG
      normalized.sort(
        (a, b) =>
          FIXED_8_BIDANG.findIndex((x) => x.toLowerCase() === a.name.toLowerCase()) -
          FIXED_8_BIDANG.findIndex((x) => x.toLowerCase() === b.name.toLowerCase())
      );

      bidangList = normalized;
      bidangMap = new Map(bidangList.map((b) => [b._id, b.name]));

      if (bidangList.length === 0) {
        selectBidang.innerHTML = `<option value="">Tidak ada data bidang (cek backend)</option>`;
        Swal.fire({
          icon: "warning",
          title: "Bidang belum tersedia",
          text: "Server tidak mengembalikan data bidang yang valid / sesuai 8 bidang.",
          confirmButtonColor: "#6D4C41",
        });
        return;
      }

      // render options
      bidangList.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b._id; // ✅ ini yang dibutuhin backend
        opt.textContent = b.name;
        selectBidang.appendChild(opt);
      });

      // optional: auto select pertama biar ga lupa
      if (!selectBidang.value && bidangList.length > 0) {
        selectBidang.value = bidangList[0]._id;
      }
    } catch (err) {
      console.error("❌ FETCH /bidang error:", err);
      Swal.fire({
        icon: "error",
        title: "Gagal memuat Bidang",
        text: "Tidak dapat terhubung ke server /bidang.",
        confirmButtonColor: "#6D4C41",
      });
    }
  }

  // ==========================
  // Resolve bidang_id (harus ObjectId)
  // ==========================
  function resolveBidangId() {
    ensureBidangSelect();
    if (!selectBidang) return "";

    const val = (selectBidang.value || "").trim();
    if (isObjectId(val)) return val;

    // fallback by text
    const label = (selectBidang.selectedOptions?.[0]?.textContent || "").trim().toLowerCase();
    const found = bidangList.find((b) => b.name.trim().toLowerCase() === label);
    if (found && isObjectId(found._id)) return found._id;

    return "";
  }

  // ==========================
  // Render tabel tulisan (admin/jaksa)
  // ==========================
  function renderTulisanTable(list) {
    if (!tbody) return;

    if (!Array.isArray(list) || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#6D4C41;">Belum ada tulisan.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list
      .map((t) => {
        const id = t._id || t.id || t.tulisan_id || "";

        const judul = pickField(t, ["judul", "title"], "-");
        const penulis = pickField(t, ["penulis", "author", "nama_penulis"], "-");
        const isi = pickField(t, ["isi", "content", "body"], "");
        const tanggalRaw = pickField(t, ["tanggal", "createdAt", "created_at"], "");
        const tanggal = tanggalRaw ? new Date(tanggalRaw).toLocaleDateString("id-ID") : "-";

        // bidang id bisa di t.bidang_id atau t.bidangId atau nested object
        const bidangId =
          pickField(t, ["bidang_id", "bidangId", "bidangID"], "") ||
          pickField(t?.bidang_id, ["_id"], "");

        const bidangName =
          pickField(t, ["bidang", "bidang_name"], "") ||
          (bidangId && bidangMap.get(bidangId)) ||
          pickField(t?.bidang_id, ["name"], "") ||
          "";

        return `
          <tr>
            <td>
              <div style="font-weight:800; color:#4e342e;">${judul}</div>
              ${
                bidangName
                  ? `<div style="font-size:12px; color:#6d4c41; margin-top:4px;">Bidang: ${bidangName}</div>`
                  : ""
              }
            </td>
            <td>${penulis}</td>
            <td>${tanggal}</td>
            <td>
              <button class="btn-edit action-btn"
                data-id="${safe(id)}"
                data-judul="${safe(judul)}"
                data-penulis="${safe(penulis)}"
                data-isi="${safe(isi)}"
                data-tanggal="${safe(tanggalRaw)}"
                data-bidang-id="${safe(bidangId)}"
              ><i class="fas fa-edit"></i></button>

              <button class="btn-delete action-btn"
                data-id="${safe(id)}"
              ><i class="fas fa-trash"></i></button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Edit handler
    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingId = btn.getAttribute("data-id") || null;

        const judul = btn.getAttribute("data-judul") || "";
        const penulis = btn.getAttribute("data-penulis") || "";
        const isi = btn.getAttribute("data-isi") || "";
        const tanggal = btn.getAttribute("data-tanggal") || "";
        const bidangId = btn.getAttribute("data-bidang-id") || "";

        if (inputJudul) inputJudul.value = judul;
        if (inputPenulis) inputPenulis.value = penulis;
        if (inputIsi) inputIsi.value = isi;
        if (inputTanggal) {
          inputTanggal.value = toDateInput(tanggal) || new Date().toISOString().split("T")[0];
        }

        ensureBidangSelect();
        if (selectBidang && bidangId && selectBidang.querySelector(`option[value="${bidangId}"]`)) {
          selectBidang.value = bidangId;
        }

        Swal.fire({
          icon: "info",
          title: "Mode Edit",
          text: "Ubah tulisan, lalu klik Simpan.",
          confirmButtonColor: "#6D4C41",
        });
      });
    });

    // Delete handler
    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;

        Swal.fire({
          title: "Hapus tulisan ini?",
          text: "Aksi ini tidak bisa dibatalkan.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#6D4C41",
          confirmButtonText: "Ya, hapus",
          cancelButtonText: "Batal",
        }).then((r) => {
          if (r.isConfirmed) deleteTulisan(id);
        });
      });
    });
  }

  // ==========================
  // GET /tulisan
  // ==========================
  async function loadTulisan() {
    if (!tbody) return;

    tbody.innerHTML = `
      <tr><td colspan="4" style="text-align:center; color:#6D4C41;">Memuat data...</td></tr>
    `;

    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/tulisan`, { headers });
      const raw = await res.text();

      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!res.ok) {
        console.error("❌ GET /tulisan error:", res.status, raw);
        tbody.innerHTML = `
          <tr><td colspan="4" style="text-align:center; color:#f44336;">Gagal memuat data tulisan.</td></tr>
        `;
        return;
      }

      if (!Array.isArray(data)) data = [];
      renderTulisanTable(data);
    } catch (err) {
      console.error("❌ FETCH /tulisan error:", err);
      tbody.innerHTML = `
        <tr><td colspan="4" style="text-align:center; color:#f44336;">Gagal terhubung ke server.</td></tr>
      `;
    }
  }

  // ==========================
  // POST /tulisan (tambah) & PUT /tulisan/:id (edit)
  // pakai FormData (aman untuk backend yang pakai multer/form-data)
  // ==========================
  async function submitTulisan(e) {
    e.preventDefault();

    const token = getToken();
    if (!token) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Anda belum login.",
        confirmButtonColor: "#6D4C41",
      });
      return;
    }

    const penulis = inputPenulis?.value.trim() || "";
    const judul = inputJudul?.value.trim() || "";
    const isi = inputIsi?.value.trim() || "";
    const tanggal = inputTanggal?.value || "";

    if (!penulis || !judul || !isi || !tanggal) {
      Swal.fire({
        icon: "warning",
        title: "Peringatan",
        text: "Semua kolom wajib diisi.",
        confirmButtonColor: "#6D4C41",
      });
      return;
    }

    const bidang_id = resolveBidangId();
    const bidangText = (selectBidang?.selectedOptions?.[0]?.textContent || "").trim();

    if (!bidang_id) {
      Swal.fire({
        icon: "error",
        title: "Bidang belum dipilih",
        text: "Pilih bidang dulu ya, biar bidang_id kebaca backend.",
        confirmButtonColor: "#6D4C41",
      });
      return;
    }

    const fd = new FormData();

    // field utama (kemungkinan besar dipakai backend)
    fd.append("judul", judul);
    fd.append("penulis", penulis);
    fd.append("isi", isi);
    fd.append("tanggal", tanggal);
    fd.append("bidang_id", bidang_id);

    // fallback keys (jaga-jaga backend beda nama field)
    fd.append("title", judul);
    fd.append("author", penulis);
    fd.append("content", isi);
    fd.append("body", isi);
    fd.append("bidangId", bidang_id);
    fd.append("bidangID", bidang_id);
    fd.append("bidang", bidangText);

    const isEdit = !!editingId;
    const url = isEdit ? `${API_BASE}/tulisan/${editingId}` : `${API_BASE}/tulisan`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          // jangan set Content-Type untuk FormData
        },
        body: fd,
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }

      if (!res.ok) {
        console.error(`❌ ${method} /tulisan error:`, res.status, data);
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: data.error || data.message || "Gagal menyimpan tulisan.",
          confirmButtonColor: "#6D4C41",
        });
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: isEdit ? "Tulisan berhasil diperbarui." : "Tulisan berhasil disimpan.",
        confirmButtonColor: "#6D4C41",
      });

      // reset
      editingId = null;
      if (formTulisan) formTulisan.reset();
      if (inputTanggal) inputTanggal.value = new Date().toISOString().split("T")[0];
      if (selectBidang) selectBidang.value = bidangList[0]?._id || "";

      loadTulisan();
    } catch (err) {
      console.error("❌ submitTulisan fetch error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Gagal terhubung ke server.",
        confirmButtonColor: "#6D4C41",
      });
    }
  }

  // ==========================
  // DELETE /tulisan/:id
  // ==========================
  async function deleteTulisan(id) {
    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/tulisan/${id}`, {
        method: "DELETE",
        headers,
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }

      if (!res.ok) {
        Swal.fire({
          icon: "error",
          title: "Gagal",
          text: data.error || data.message || "Tidak bisa menghapus tulisan.",
          confirmButtonColor: "#6D4C41",
        });
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Dihapus!",
        text: "Tulisan berhasil dihapus.",
        confirmButtonColor: "#6D4C41",
      });
      loadTulisan();
    } catch (err) {
      console.error("❌ deleteTulisan fetch error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Gagal menghubungi server.",
        confirmButtonColor: "#6D4C41",
      });
    }
  }

  // ==========================
  // Init
  // ==========================
  if (inputTanggal) inputTanggal.value = new Date().toISOString().split("T")[0];
  if (formTulisan) formTulisan.addEventListener("submit", submitTulisan);

  loadBidang();  // ✅ dropdown bidang dari /bidang (8 bidang saja)
  loadTulisan(); // ✅ tampilkan tulisan
});
