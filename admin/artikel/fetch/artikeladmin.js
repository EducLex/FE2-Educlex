// /admin/artikel/fetch/artikeladmin.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const formArtikel = document.getElementById("formArtikel");
  const inputJudul = document.getElementById("judul");
  const inputIsi = document.getElementById("isi");
  const inputPenulis = document.getElementById("penulis");
  const inputDokumen = document.getElementById("dokumen");

  const selectJenis = document.getElementById("jenisArtikel");
  const selectKategori = document.getElementById("kategoriArtikel");

  const tabelBody = document.getElementById("tabelArtikelBody");

  let allArticles = [];
  let currentEditId = null; // null = tambah, ada nilai = edit

  // kategori disimpan supaya bisa dipakai ulang (select + mapping id -> nama)
  let categoriesByType = { internal: [], eksternal: [] };
  let categoriesById = {};

  // ==========================
  // Helpers umum
  // ==========================
  function showAlertSwal(title, text, icon = "info") {
    if (typeof Swal === "undefined") {
      alert(`${title}\n${text || ""}`);
      return;
    }
    Swal.fire({
      icon,
      title,
      text,
      confirmButtonColor: "#6D4C41",
    });
  }

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

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  // tanggal di DB kadang 0001-01-01 → anggap tidak valid, pakai tanggal hari ini saja
  function formatArticleDate(art) {
    const raw = pickField(art, ["tanggal", "createdAt", "created_at"], "");
    let d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getFullYear() < 2000) {
      d = new Date();
    }
    return d.toLocaleDateString("id-ID");
  }

  // ==========================
  // KATEGORI
  // ==========================
  function buildFallbackCategories() {
    // fallback kalau /categories error / kosong
    const fallbackInternal = [
      { _id: "internal-pembinaan", name: "Pembinaan", type: "internal" },
      { _id: "internal-pengawasan", name: "Pengawasan", type: "internal" },
      { _id: "internal-intelijen", name: "Intelijen", type: "internal" },
      { _id: "internal-pidum", name: "Pidana Umum", type: "internal" },
      { _id: "internal-pidsus", name: "Pidana Khusus", type: "internal" },
      {
        _id: "internal-datun",
        name: "Perdata dan Tata Usaha Negara",
        type: "internal",
      },
      { _id: "internal-pidmil", name: "Pidana Militer", type: "internal" },
      {
        _id: "internal-pemulihan-aset",
        name: "Pemulihan Aset",
        type: "internal",
      },
    ];

    const fallbackEksternal = [
      { _id: "eksternal-pidana", name: "Pidana", type: "eksternal" },
      { _id: "eksternal-perdata", name: "Perdata", type: "eksternal" },
      { _id: "eksternal-lainnya", name: "Peraturan Lain", type: "eksternal" },
    ];

    categoriesByType = {
      internal: fallbackInternal,
      eksternal: fallbackEksternal,
    };

    categoriesById = {};
    [...fallbackInternal, ...fallbackEksternal].forEach((cat) => {
      categoriesById[String(cat._id)] = cat;
    });
  }

  function populateKategoriOptions(type) {
    if (!selectKategori) return;
    const kategoriType = type === "eksternal" ? "eksternal" : "internal";
    const list = categoriesByType[kategoriType] || [];

    selectKategori.innerHTML =
      '<option value="" disabled selected>Pilih kategori / bidang artikel</option>';

    list.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = String(cat._id);
      opt.textContent = cat.name || "Tanpa Nama";
      opt.dataset.type = cat.type || kategoriType;
      selectKategori.appendChild(opt);
    });
  }

  async function initCategories() {
    if (!selectKategori || !selectJenis) {
      console.warn(
        "Select kategori / jenis tidak ditemukan di DOM, skip init kategori."
      );
      return;
    }

    // 1) Set fallback dulu (supaya kalau /categories error tetap ada pilihan)
    buildFallbackCategories();

    // Awal: cuma placeholder dulu (mirip peraturanadmin),
    // kategori baru diisi setelah jenis artikel dipilih.
    selectKategori.innerHTML =
      '<option value="" disabled selected>Pilih kategori / bidang artikel</option>';

    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!res.ok) {
        console.warn("GET /categories tidak OK, pakai fallback saja.", data);
        return;
      }

      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.categories)) list = data.categories;

      if (!list.length) {
        console.warn("Respon /categories kosong, pakai fallback saja.");
        return;
      }

      // 2) Bangun internal/eksternal dari data API
      const internalFromApi = [];
      const eksternalFromApi = [];
      const byId = {};
      const seenInternal = new Set();
      const seenEksternal = new Set();

      list.forEach((cat) => {
        const id =
          cat._id || cat.id || cat.value || cat.slug || cat.categoryId || cat.name;
        if (!id) return;

        const nameRaw = (cat.name || "").trim();
        const sub = (cat.subkategori || "").trim();
        const nameLower = nameRaw.toLowerCase();

        let type = "internal";
        let label = "";

        if (nameLower === "internal" || nameLower === "eksternal") {
          // Pola seperti:
          // { name: "internal", subkategori: "Pidana Umum" }
          type = nameLower === "eksternal" ? "eksternal" : "internal";
          label = sub || nameRaw || "Tanpa Nama";
        } else {
          // Pola seperti:
          // { name: "Pidana Umum", subkategori: "" }
          // Anggap sebagai kategori internal (artikel dalam Kejaksaan)
          type = "internal";
          label = nameRaw || sub || "Tanpa Nama";
        }

        const key = label.toLowerCase();
        if (type === "internal") {
          if (seenInternal.has(key)) return;
          seenInternal.add(key);
          const obj = { _id: String(id), name: label, type: "internal" };
          internalFromApi.push(obj);
          byId[obj._id] = obj;
        } else {
          if (seenEksternal.has(key)) return;
          seenEksternal.add(key);
          const obj = { _id: String(id), name: label, type: "eksternal" };
          eksternalFromApi.push(obj);
          byId[obj._id] = obj;
        }
      });

      // 3) Kalau API punya data, override fallback.
      if (internalFromApi.length || eksternalFromApi.length) {
        categoriesByType = {
          internal:
            internalFromApi.length ? internalFromApi : categoriesByType.internal,
          eksternal:
            eksternalFromApi.length ? eksternalFromApi : categoriesByType.eksternal,
        };

        if (Object.keys(byId).length) {
          categoriesById = byId;
        }
      }

      // 4) Kalau field jenis sudah punya nilai (misalnya setelah klik Edit),
      // isi kategori sesuai jenis tersebut. Kalau masih kosong, biarkan placeholder.
      const jenisNow = selectJenis.value;
      if (jenisNow) {
        populateKategoriOptions(jenisNow);
      }
    } catch (err) {
      console.warn("Gagal fetch /categories, pakai fallback saja.", err);
      // fallback sudah di-setup di atas, jadi diam saja.
    }
  }

  function getCategoryNameFromArticle(art) {
    const explicit = pickField(
      art,
      ["kategori", "bidang", "category.name", "category"],
      ""
    );
    if (explicit) return explicit;

    const catId = pickField(
      art,
      ["categoryId", "category_id", "category._id"],
      ""
    );
    if (catId && categoriesById[String(catId)]) {
      return categoriesById[String(catId)].name;
    }
    return "";
  }

  // ==========================
  // RENDER TABEL
  // ==========================
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
          "Tanpa Penulis"
        );
        const tanggal = formatArticleDate(art);

        return `
          <tr data-id="${id}">
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
        if (!id) return;

        const art = allArticles.find(
          (a) => String(a._id || a.id || a.article_id || "") === String(id)
        );
        if (!art) return;

        currentEditId = id;

        if (inputJudul)
          inputJudul.value = pickField(
            art,
            ["judul", "title", "nama"],
            ""
          );
        if (inputIsi)
          inputIsi.value = pickField(
            art,
            ["isi", "content", "deskripsi", "body"],
            ""
          );
        if (inputPenulis)
          inputPenulis.value = pickField(
            art,
            ["penulis", "author", "createdBy"],
            ""
          );

        const jenis = pickField(
          art,
          ["jenis_artikel", "jenis", "type"],
          ""
        ).toLowerCase();
        if (selectJenis) {
          selectJenis.value =
            jenis === "eksternal" || jenis === "external"
              ? "eksternal"
              : "internal";
        }

        const kategoriName = getCategoryNameFromArticle(art);
        const catId = pickField(
          art,
          ["categoryId", "category_id", "category._id"],
          ""
        );

        if (selectJenis) {
          // isi opsi kategori sesuai jenis artikel yang dipilih
          populateKategoriOptions(selectJenis.value || "internal");
        }

        if (selectKategori) {
          if (catId && selectKategori.querySelector(`option[value="${catId}"]`)) {
            selectKategori.value = String(catId);
          }
          // kalau id tidak ketemu, coba cocokkan berdasarkan nama
          if (!selectKategori.value && kategoriName) {
            Array.from(selectKategori.options).forEach((opt) => {
              if (opt.textContent === kategoriName) {
                selectKategori.value = opt.value;
              }
            });
          }
        }

        // dokumen tidak bisa diisi ulang otomatis demi keamanan browser
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
        if (!id) return;

        const judul =
          tr.querySelector("td")?.textContent?.trim() || "artikel ini";

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
          if (result.isConfirmed) {
            deleteArticle(id);
          }
        });
      });
    });
  }

  // ==========================
  // LOAD ARTIKEL
  // ==========================
  async function loadArticles() {
    if (!tabelBody) return;

    tabelBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">
          Memuat data...
        </td>
      </tr>
    `;

    const token = getToken();
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
          showAlertSwal(
            "Error",
            data.error || data.message || "Gagal memuat artikel.",
            "error"
          );
        }
        return;
      }

      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.articles)) list = data.articles;

      allArticles = list;
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

  // ==========================
  // SUBMIT (TAMBAH / EDIT)
  // ==========================
  async function submitArtikel(e) {
    e.preventDefault();
    if (!formArtikel) return;

    const judul = inputJudul?.value.trim();
    const isi = inputIsi?.value.trim();
    const penulis = inputPenulis?.value.trim();
    const jenisArtikel = selectJenis ? selectJenis.value : "";
    const kategoriOption =
      selectKategori && selectKategori.selectedIndex >= 0
        ? selectKategori.options[selectKategori.selectedIndex]
        : null;
    const kategoriId = kategoriOption ? kategoriOption.value : "";
    const kategoriName = kategoriOption ? kategoriOption.textContent : "";

    if (!judul || !isi || !penulis) {
      showAlertSwal(
        "Peringatan",
        "Judul, isi, dan penulis wajib diisi.",
        "warning"
      );
      return;
    }

    if (!jenisArtikel) {
      showAlertSwal(
        "Peringatan",
        "Pilih jenis artikel (internal / eksternal).",
        "warning"
      );
      return;
    }

    if (!kategoriId) {
      showAlertSwal(
        "Peringatan",
        "Pilih kategori / bidang artikel.",
        "warning"
      );
      return;
    }

    const token = getToken();
    if (!token) {
      showAlertSwal("Tidak ada akses", "Silakan login sebagai admin.", "error");
      return;
    }

    const isEdit = !!currentEditId;
    const url = isEdit
      ? `${API_BASE}/articles/${currentEditId}`
      : `${API_BASE}/articles`;
    const method = isEdit ? "PUT" : "POST";

    try {
      let res;
      if (isEdit) {
        // Update artikel (tanpa ubah dokumen untuk menghindari error di backend)
        const payload = {
          judul,
          isi,
          penulis,
          jenis: jenisArtikel,
          jenis_artikel: jenisArtikel,
          kategori: kategoriName,
          categoryId: kategoriId,
        };

        res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Tambah artikel baru + upload dokumen
        const fd = new FormData();
        fd.append("judul", judul);
        fd.append("isi", isi);
        fd.append("penulis", penulis);
        fd.append("jenis", jenisArtikel);
        fd.append("jenis_artikel", jenisArtikel);
        fd.append("kategori", kategoriName);
        fd.append("categoryId", kategoriId);

        if (inputDokumen && inputDokumen.files && inputDokumen.files[0]) {
          fd.append("dokumen", inputDokumen.files[0]);
        }

        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        });
      }

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

      showAlertSwal(
        "Berhasil",
        isEdit
          ? "Perubahan artikel berhasil disimpan."
          : "Artikel baru berhasil disimpan.",
        "success"
      );

      formArtikel.reset();
      currentEditId = null;
      // reset dropdown ke default (mirip peraturanadmin)
      if (selectJenis) selectJenis.value = "";
      if (selectKategori) {
        selectKategori.innerHTML =
          '<option value="" disabled selected>Pilih kategori / bidang artikel</option>';
      }

      loadArticles();
    } catch (err) {
      console.error(`❌ FETCH ERROR ${method} /articles`, err);
      showAlertSwal("Error", "Tidak dapat terhubung ke server.", "error");
    }
  }

  // ==========================
  // DELETE ARTIKEL
  // ==========================
  async function deleteArticle(id) {
    const token = getToken();
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

      showAlertSwal("Berhasil", "Artikel berhasil dihapus.", "success");

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

  // ==========================
  // EVENT LISTENER
  // ==========================
  if (formArtikel) {
    formArtikel.addEventListener("submit", submitArtikel);
  }

  if (selectJenis) {
    selectJenis.addEventListener("change", (e) => {
      const val = e.target.value || "";
      if (!val) {
        if (selectKategori) {
          selectKategori.innerHTML =
            '<option value="" disabled selected>Pilih kategori / bidang artikel</option>';
        }
        return;
      }
      populateKategoriOptions(val);
    });
  }

  // Load awal
  initCategories();
  loadArticles();
});
