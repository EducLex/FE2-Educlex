// /admin/artikel/fetch/artikeladmin.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const formArtikel = document.getElementById("formArtikel");
  const inputJudul = document.getElementById("judul");
  const inputIsi = document.getElementById("isi");
  const inputPenulis = document.getElementById("penulis");
  const inputGambar = document.getElementById("gambar");
  const inputDokumen = document.getElementById("dokumen");
  const inputCategoryId = document.getElementById("categoryId");

  const tabelBody = document.getElementById("tabelArtikelBody");

  let allArticles = [];
  let currentEditId = null; // null = mode tambah, ada value = mode edit

  // Helper alert pakai SweetAlert
  function showAlertSwal(title, text, icon = "info") {
    Swal.fire({
      icon,
      title,
      text,
      confirmButtonColor: "#6D4C41",
    });
  }

  // Helper ambil field fleksibel
  function pickField(obj, keys, fallback = "") {
    if (!obj) return fallback;
    for (const k of keys) {
      const parts = k.split(".");
      let val = obj;
      for (const p of parts) {
        if (val && Object.prototype.hasOwnProperty.call(val, p)) {
          val = val[p];
        } else {
          val = undefined;
          break;
        }
      }
      if (val !== undefined && val !== null) return String(val);
    }
    return fallback;
  }

  // Render tabel daftar artikel
  function renderTable() {
    if (!tabelBody) return;

    if (!allArticles.length) {
      tabelBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;">
            Belum ada artikel.
          </td>
        </tr>
      `;
      return;
    }

    tabelBody.innerHTML = allArticles
      .map((art) => {
        const id = art._id || art.id || art.article_id || "";
        const judul = pickField(art, ["judul", "title", "nama"], "Tanpa Judul");
        const penulis = pickField(
          art,
          ["penulis", "author", "createdBy"],
          "EducLex"
        );
        const tanggalRaw = pickField(
          art,
          ["tanggal", "createdAt", "created_at"],
          ""
        );
        const tanggal = tanggalRaw
          ? new Date(tanggalRaw).toLocaleDateString("id-ID")
          : "-";

        // simpan data penting di data-attribute biar gampang pas Edit
        const safeIsi = pickField(
          art,
          ["isi", "content", "deskripsi", "body"],
          ""
        ).replace(/"/g, "&quot;");
        const categoryId = pickField(
          art,
          ["categoryId", "category_id", "category._id"],
          ""
        );

        return `
          <tr
            data-id="${id}"
            data-judul="${judul.replace(/"/g, "&quot;")}"
            data-isi="${safeIsi}"
            data-penulis="${penulis.replace(/"/g, "&quot;")}"
            data-category="${categoryId.replace(/"/g, "&quot;")}"
          >
            <td>${judul}</td>
            <td>${tanggal}</td>
            <td>${penulis}</td>
            <td>
              <button class="action-btn btn-edit">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="action-btn btn-delete">
                <i class="fas fa-trash"></i> Hapus
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Pasang event Edit & Hapus
    tabelBody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tr = btn.closest("tr");
        if (!tr) return;
        const id = tr.getAttribute("data-id");
        const judul = tr.getAttribute("data-judul") || "";
        const isi = tr.getAttribute("data-isi") || "";
        const penulis = tr.getAttribute("data-penulis") || "";
        const category = tr.getAttribute("data-category") || "";

        currentEditId = id;

        if (inputJudul) inputJudul.value = judul;
        if (inputIsi) inputIsi.value = isi;
        if (inputPenulis) inputPenulis.value = penulis;
        if (inputCategoryId) inputCategoryId.value = category;

        // kosongkan input file; file lama tetap dipakai kalau tidak diganti
        if (inputGambar) inputGambar.value = "";
        if (inputDokumen) inputDokumen.value = "";

        window.scrollTo({ top: 0, behavior: "smooth" });
        showAlertSwal(
          "Mode Edit",
          "Silakan ubah data artikel, lalu klik Simpan Artikel.",
          "info"
        );
      });
    });

    tabelBody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tr = btn.closest("tr");
        if (!tr) return;
        const id = tr.getAttribute("data-id");
        const judul = tr.getAttribute("data-judul") || "artikel ini";

        Swal.fire({
          title: `Hapus ${judul}?`,
          text: "Tindakan ini tidak dapat dibatalkan.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#6D4C41",
          confirmButtonText: "Ya, hapus",
          cancelButtonText: "Batal",
        }).then((result) => {
          if (result.isConfirmed && id) {
            deleteArticle(id);
          }
        });
      });
    });
  }

  // Ambil daftar artikel dari backend
  async function loadArticles() {
    if (!tabelBody) return;

    tabelBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">
          Memuat data...
        </td>
      </tr>
    `;

    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/articles`, { headers });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!res.ok) {
        console.error("❌ Error GET /articles:", data);
        tabelBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center;color:#d32f2f;">
              Gagal memuat artikel.
            </td>
          </tr>
        `;
        if (res.status === 401) {
          showAlertSwal("Sesi berakhir", "Silakan login kembali.", "error");
        } else {
          showAlertSwal("Error", data.error || data.message || "Gagal memuat artikel.", "error");
        }
        return;
      }

      if (!Array.isArray(data)) {
        console.warn("Respon /articles bukan array:", data);
        allArticles = [];
      } else {
        allArticles = data;
      }

      renderTable();
    } catch (err) {
      console.error("❌ FETCH ERROR /articles:", err);
      tabelBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:#d32f2f;">
            Tidak dapat terhubung ke server.
          </td>
        </tr>
      `;
      showAlertSwal("Error", "Tidak dapat terhubung ke server.", "error");
    }
  }

  // Tambah / update artikel
  async function submitArtikel(e) {
    e.preventDefault();
    if (!formArtikel) return;

    const judul = inputJudul?.value.trim();
    const isi = inputIsi?.value.trim();
    const penulis = inputPenulis?.value.trim();
    const categoryId = inputCategoryId?.value.trim();

    if (!judul || !isi || !penulis || !categoryId) {
      showAlertSwal("Peringatan", "Semua field wajib diisi (kecuali dokumen).", "warning");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      showAlertSwal("Tidak ada akses", "Silakan login sebagai admin.", "error");
      return;
    }

    const fd = new FormData();
    fd.append("judul", judul);
    fd.append("isi", isi);
    fd.append("penulis", penulis);
    fd.append("categoryId", categoryId);

    // 👉 tambahkan tanggal hanya saat tambah artikel baru
    if (!currentEditId) {
    fd.append("tanggal", new Date().toISOString());
    }


    // Untuk file: hanya kirim kalau user pilih file baru
    if (inputGambar && inputGambar.files && inputGambar.files[0]) {
      fd.append("gambar", inputGambar.files[0]);
    }
    if (inputDokumen && inputDokumen.files && inputDokumen.files[0]) {
      fd.append("dokumen", inputDokumen.files[0]);
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      // Jangan set Content-Type → biarkan browser set multipart/form-data
    };

    const isEdit = !!currentEditId;
    const url = isEdit
      ? `${API_BASE}/articles/${currentEditId}`
      : `${API_BASE}/articles`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers,
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
        console.error(`❌ Error ${method} /articles`, data);
        showAlertSwal(
          "Gagal menyimpan",
          data.error || data.message || "Terjadi kesalahan saat menyimpan artikel.",
          "error"
        );
        return;
      }

      Swal.fire({
        icon: "success",
        title: isEdit ? "Artikel diperbarui" : "Artikel ditambahkan",
        text: isEdit
          ? "Perubahan artikel berhasil disimpan."
          : "Artikel baru berhasil disimpan.",
        confirmButtonColor: "#6D4C41",
      });

      // reset form & mode edit
      formArtikel.reset();
      currentEditId = null;

      loadArticles();
    } catch (err) {
      console.error(`❌ FETCH ERROR ${method} /articles`, err);
      showAlertSwal("Error", "Tidak dapat terhubung ke server.", "error");
    }
  }

  // Hapus artikel
  async function deleteArticle(id) {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/articles/${id}`, {
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
        console.error("❌ Error DELETE /articles/:id", data);
        showAlertSwal(
          "Gagal menghapus",
          data.error || data.message || "Artikel tidak dapat dihapus.",
          "error"
        );
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Artikel terhapus",
        text: "Artikel berhasil dihapus.",
        confirmButtonColor: "#6D4C41",
      });

      // Jika sedang mengedit artikel yg dihapus, reset form
      if (currentEditId === id) {
        currentEditId = null;
        if (formArtikel) formArtikel.reset();
      }

      loadArticles();
    } catch (err) {
      console.error("❌ FETCH ERROR DELETE /articles/:id", err);
      showAlertSwal("Error", "Tidak dapat terhubung ke server.", "error");
    }
  }

  // Event submit form
  if (formArtikel) {
    formArtikel.addEventListener("submit", submitArtikel);
  }

  // Load awal
  loadArticles();
});
