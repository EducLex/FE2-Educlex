// /admin/artikel/fetch/artikeladmin.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const formArtikel = document.getElementById("formArtikel");
  const inputJudul = document.getElementById("judul");
  const inputIsi = document.getElementById("isi");
  const inputPenulis = document.getElementById("penulis");
  const inputDokumen = document.getElementById("dokumen");
  const inputGambar = document.getElementById("gambar"); // optional

  const selectJenis = document.getElementById("jenisArtikel");
  const selectKategori = document.getElementById("kategoriArtikel");
  const tabelBody = document.getElementById("tabelArtikelBody");

  let allArticles = [];
  let currentEditId = null;

  let currentEditExistingDoc = "";
  let currentEditExistingImage = "";

  let categoriesByType = { internal: [], eksternal: [] };
  let categoriesById = {};

  // ==========================
  // Helpers
  // ==========================
  function showAlertSwal(title, text, icon = "info") {
    if (typeof Swal === "undefined") {
      alert(`${title}\n${text || ""}`);
      return;
    }
    Swal.fire({ icon, title, text, confirmButtonColor: "#6D4C41" });
  }

  function pickField(obj, keys, fallback = "") {
    if (!obj) return fallback;
    for (const k of keys) {
      const parts = k.split(".");
      let val = obj;
      for (const p of parts) {
        if (val && Object.prototype.hasOwnProperty.call(val, p)) val = val[p];
        else {
          val = undefined;
          break;
        }
      }
      if (val !== undefined && val !== null && String(val).trim() !== "") return String(val);
    }
    return fallback;
  }

  function safeParseResponse(text) {
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  function extractErrorMessage(data) {
    return (
      data?.error ||
      data?.message ||
      data?.msg ||
      (Array.isArray(data?.errors) ? data.errors.map((e) => e.message || e.msg).join(", ") : "") ||
      "Terjadi kesalahan."
    );
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function normalizeUrl(url) {
    if (!url) return "";
    const s = String(url).trim();
    if (!s) return "";
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("/")) return API_BASE + s;
    return API_BASE + "/" + s.replace(/^\/+/, "");
  }

  function formatArticleDate(art) {
    const raw = pickField(art, ["tanggal", "createdAt", "created_at"], "");
    let d = raw ? new Date(raw) : null;
    if (!d || Number.isNaN(d.getTime()) || d.getFullYear() < 2000) d = new Date();
    return d.toLocaleDateString("id-ID");
  }

  function getExistingDocFromArticle(art) {
    return pickField(
      art,
      ["dokumen", "file", "documentUrl", "document_url", "attachment", "dokumenUrl", "dokumen_url"],
      ""
    );
  }

  function getExistingImageFromArticle(art) {
    return pickField(
      art,
      [
        "gambar",
        "image",
        "thumbnail",
        "cover",
        "foto",
        "coverImage",
        "gambarUrl",
        "gambar_url",
        "imageUrl",
        "image_url",
      ],
      ""
    );
  }

  // ✅ penulis display: fallback lebih aman
  function getPenulisDisplay(art) {
    const name = pickField(
      art,
      [
        "penulis",
        "author",
        "authorName",
        "createdBy",
        "created_by",
        "createdByName",
        "user.name",
        "user.username",
        "admin.name",
        "admin.username",
        "nama_penulis",
        "penulis_nama",
      ],
      ""
    );
    return (name || "").trim() ? name.trim() : "Admin EducLex";
  }

  // 1x1 PNG transparan buat backend yg wajib gambar
  function base64ToBlob(base64, mime) {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    return new Blob([new Uint8Array(byteNumbers)], { type: mime });
  }
  function getPlaceholderImageFile() {
    const b64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO4B9WkAAAAASUVORK5CYII=";
    const blob = base64ToBlob(b64, "image/png");
    return new File([blob], "placeholder.png", { type: "image/png" });
  }

  // ✅ ambil id hasil insert (bisa bentuk apa saja)
  function extractInsertedId(data) {
    const direct =
      data?.id ||
      data?._id ||
      data?.insertedId ||
      data?.insertedID ||
      data?.data?.id ||
      data?.data?._id;

    if (!direct) return "";

    // kalau object { "$oid": "..." }
    if (typeof direct === "object") {
      const oid = direct.$oid || direct.oid || direct._id;
      if (typeof oid === "string") return oid;
      return "";
    }

    return String(direct);
  }

  // ==========================
  // KATEGORI
  // ==========================
  function buildFallbackCategories() {
    const fallbackInternal = [
      { _id: "internal-pembinaan", name: "Pembinaan", type: "internal" },
      { _id: "internal-pengawasan", name: "Pengawasan", type: "internal" },
      { _id: "internal-intelijen", name: "Intelijen", type: "internal" },
      { _id: "internal-pidum", name: "Pidana Umum", type: "internal" },
      { _id: "internal-pidsus", name: "Pidana Khusus", type: "internal" },
      { _id: "internal-datun", name: "Perdata dan Tata Usaha Negara", type: "internal" },
      { _id: "internal-pidmil", name: "Pidana Militer", type: "internal" },
      { _id: "internal-pemulihan-aset", name: "Pemulihan Aset", type: "internal" },
    ];

    const fallbackEksternal = [
      { _id: "eksternal-pidana", name: "Pidana", type: "eksternal" },
      { _id: "eksternal-perdata", name: "Perdata", type: "eksternal" },
      { _id: "eksternal-lainnya", name: "Peraturan Lain", type: "eksternal" },
    ];

    categoriesByType = { internal: fallbackInternal, eksternal: fallbackEksternal };
    categoriesById = {};
    [...fallbackInternal, ...fallbackEksternal].forEach((cat) => (categoriesById[String(cat._id)] = cat));
  }

  function populateKategoriOptions(type) {
    if (!selectKategori) return;
    const kategoriType = type === "eksternal" ? "eksternal" : "internal";
    const list = categoriesByType[kategoriType] || [];

    selectKategori.innerHTML = '<option value="" disabled selected>Pilih kategori / bidang artikel</option>';
    list.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = String(cat._id);
      opt.textContent = cat.name || "Tanpa Nama";
      opt.dataset.type = cat.type || kategoriType;
      selectKategori.appendChild(opt);
    });
  }

  async function initCategories() {
    if (!selectKategori || !selectJenis) return;

    buildFallbackCategories();
    populateKategoriOptions(selectJenis.value || "internal");

    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const raw = await res.text();
      const data = safeParseResponse(raw);
      if (!res.ok) return;

      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.categories)) list = data.categories;
      if (!list.length) return;

      const internalFromApi = [];
      const eksternalFromApi = [];
      const byId = {};
      const seenInternal = new Set();
      const seenEksternal = new Set();

      list.forEach((cat) => {
        const id = cat._id || cat.id || cat.value || cat.slug || cat.categoryId || cat.name;
        if (!id) return;

        const nameRaw = (cat.name || "").trim();
        const sub = (cat.subkategori || "").trim();
        const nameLower = nameRaw.toLowerCase();

        let type = "internal";
        let label = "";

        if (nameLower === "internal" || nameLower === "eksternal") {
          type = nameLower === "eksternal" ? "eksternal" : "internal";
          label = sub || nameRaw || "Tanpa Nama";
        } else {
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

      if (internalFromApi.length || eksternalFromApi.length) {
        categoriesByType = {
          internal: internalFromApi.length ? internalFromApi : categoriesByType.internal,
          eksternal: eksternalFromApi.length ? eksternalFromApi : categoriesByType.eksternal,
        };
        if (Object.keys(byId).length) categoriesById = byId;
      }

      populateKategoriOptions(selectJenis.value || "internal");
    } catch (err) {
      console.warn("Gagal fetch /categories, pakai fallback saja.", err);
    }
  }

  function getCategoryNameFromArticle(art) {
    const explicit = pickField(art, ["kategori", "bidang", "category.name", "category"], "");
    if (explicit) return explicit;

    const catId = pickField(art, ["categoryId", "category_id", "category._id"], "");
    if (catId && categoriesById[String(catId)]) return categoriesById[String(catId)].name;
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
          <td colspan="4" style="text-align:center;">Belum ada artikel.</td>
        </tr>
      `;
      return;
    }

    tabelBody.innerHTML = allArticles
      .map((art) => {
        const id = art._id || art.id || art.article_id || "";
        const judul = pickField(art, ["judul", "title", "nama"], "Tanpa Judul");
        const penulis = getPenulisDisplay(art);
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

    // Edit
    tabelBody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tr = btn.closest("tr");
        if (!tr) return;

        const id = tr.getAttribute("data-id");
        if (!id) return;

        const art = allArticles.find((a) => String(a._id || a.id || a.article_id || "") === String(id));
        if (!art) return;

        currentEditId = id;

        if (inputJudul) inputJudul.value = pickField(art, ["judul", "title", "nama"], "");
        if (inputIsi) inputIsi.value = pickField(art, ["isi", "content", "deskripsi", "body"], "");
        if (inputPenulis) inputPenulis.value = getPenulisDisplay(art);

        const jenis = pickField(art, ["jenis_artikel", "jenis", "type"], "").toLowerCase();
        if (selectJenis) {
          selectJenis.value = jenis === "eksternal" || jenis === "external" ? "eksternal" : "internal";
        }

        const kategoriName = getCategoryNameFromArticle(art);
        const catId = pickField(art, ["categoryId", "category_id", "category._id"], "");

        if (selectJenis) populateKategoriOptions(selectJenis.value || "internal");

        if (selectKategori) {
          if (catId && selectKategori.querySelector(`option[value="${catId}"]`)) {
            selectKategori.value = String(catId);
          }
          if (!selectKategori.value && kategoriName) {
            Array.from(selectKategori.options).forEach((opt) => {
              if ((opt.textContent || "").trim() === kategoriName) selectKategori.value = opt.value;
            });
          }
        }

        currentEditExistingDoc = getExistingDocFromArticle(art);
        currentEditExistingImage = getExistingImageFromArticle(art);
        if (currentEditExistingImage) currentEditExistingImage = normalizeUrl(currentEditExistingImage);

        if (inputDokumen) inputDokumen.value = "";
        if (inputGambar) inputGambar.value = "";

        window.scrollTo({ top: 0, behavior: "smooth" });
        showAlertSwal("Mode Edit", "Ubah data lalu klik Simpan Artikel.", "info");
      });
    });

    // Delete
    tabelBody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tr = btn.closest("tr");
        if (!tr) return;

        const id = tr.getAttribute("data-id");
        if (!id) return;

        const judul = tr.querySelector("td")?.textContent?.trim() || "artikel ini";

        if (typeof Swal === "undefined") {
          const ok = confirm(`Hapus ${judul}?`);
          if (ok) deleteArticle(id);
          return;
        }

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
          if (result.isConfirmed) deleteArticle(id);
        });
      });
    });
  }

  // ==========================
  // LOAD ARTIKEL
  // ==========================
  async function loadArticles() {
    if (!tabelBody) return;

    tabelBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>`;

    const token = getToken();
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/articles`, { headers });
      const raw = await res.text();
      const data = safeParseResponse(raw);

      if (!res.ok) {
        console.error("❌ Error GET /articles:", data);
        tabelBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center;color:#d32f2f;">
              Gagal memuat artikel.
            </td>
          </tr>
        `;
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
  // SUBMIT (POST / PUT)
  // ==========================
  function buildArticleFormData({ judul, isi, penulis, jenisArtikel, kategoriId, kategoriName }) {
    const fd = new FormData();

    fd.append("judul", judul);
    fd.append("title", judul);

    fd.append("isi", isi);
    fd.append("content", isi);

    // ✅ PENULIS: kirim banyak alias
    fd.append("penulis", penulis);
    fd.append("author", penulis);
    fd.append("authorName", penulis);
    fd.append("createdBy", penulis);
    fd.append("created_by", penulis);
    fd.append("nama_penulis", penulis);

    fd.append("jenis", jenisArtikel);
    fd.append("jenis_artikel", jenisArtikel);
    fd.append("type", jenisArtikel);

    fd.append("kategori", kategoriName);
    fd.append("category", kategoriName);

    fd.append("categoryId", kategoriId);
    fd.append("category_id", kategoriId);

    if (currentEditExistingDoc) {
      fd.append("dokumenLama", currentEditExistingDoc);
      fd.append("existingDokumen", currentEditExistingDoc);
      fd.append("documentUrl", currentEditExistingDoc);
    }
    if (currentEditExistingImage) {
      fd.append("gambarLama", currentEditExistingImage);
      fd.append("existingGambar", currentEditExistingImage);
      fd.append("imageUrl", currentEditExistingImage);
    }

    const docFile = inputDokumen?.files?.[0];
    if (docFile) {
      fd.append("dokumen", docFile);
      fd.append("file", docFile);
      fd.append("document", docFile);
      fd.append("attachment", docFile);
    }

    const imgFile = inputGambar?.files?.[0];
    if (imgFile) {
      fd.append("gambar", imgFile);
      fd.append("image", imgFile);
      fd.append("thumbnail", imgFile);
    }

    if (!imgFile) {
      const needsPlaceholder = !currentEditId || !currentEditExistingImage;
      if (needsPlaceholder) {
        const ph = getPlaceholderImageFile();
        fd.append("gambar", ph);
        fd.append("image", ph);
        fd.append("thumbnail", ph);
      }
    }

    return fd;
  }

  // ✅ Setelah POST sukses, auto PUT supaya penulis tersimpan (tanpa ubah BE)
  async function postThenFixPenulis({ token, newId, judul, isi, penulis, jenisArtikel, kategoriId, kategoriName }) {
    if (!newId) return;

    try {
      const fdFix = buildArticleFormData({ judul, isi, penulis, jenisArtikel, kategoriId, kategoriName });

      // kalau file sudah diupload saat POST, PUT tidak wajib upload ulang dokumen.
      // tapi aman kalau ikut (FormData builder tetap bisa bawa dokumen kalau input masih ada).
      const resFix = await fetch(`${API_BASE}/articles/${newId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fdFix,
      });

      if (!resFix.ok) {
        const rawFix = await resFix.text();
        const dataFix = safeParseResponse(rawFix);
        console.warn("⚠️ Auto-fix penulis gagal, tapi POST sudah berhasil:", dataFix);
      }
    } catch (e) {
      console.warn("⚠️ Auto-fix penulis error:", e);
    }
  }

  async function submitArtikel(e) {
    e.preventDefault();
    if (!formArtikel) return;

    const judul = inputJudul?.value.trim();
    const isi = inputIsi?.value.trim();
    const penulis = inputPenulis?.value.trim();
    const jenisArtikel = selectJenis ? selectJenis.value : "";

    const kategoriOption =
      selectKategori && selectKategori.selectedIndex >= 0 ? selectKategori.options[selectKategori.selectedIndex] : null;

    const kategoriId = kategoriOption ? String(kategoriOption.value || "") : "";
    const kategoriName = kategoriOption ? String(kategoriOption.textContent || "") : "";

    if (!judul || !isi || !penulis) {
      showAlertSwal("Peringatan", "Judul, isi, dan penulis wajib diisi.", "warning");
      return;
    }
    if (!jenisArtikel) {
      showAlertSwal("Peringatan", "Pilih jenis artikel (internal / eksternal).", "warning");
      return;
    }
    if (!kategoriId) {
      showAlertSwal("Peringatan", "Pilih kategori / bidang artikel.", "warning");
      return;
    }

    const token = getToken();
    if (!token) {
      showAlertSwal("Tidak ada akses", "Silakan login sebagai admin.", "error");
      return;
    }

    const isEdit = !!currentEditId;
    const url = isEdit ? `${API_BASE}/articles/${currentEditId}` : `${API_BASE}/articles`;

    try {
      const fd = buildArticleFormData({ judul, isi, penulis, jenisArtikel, kategoriId, kategoriName });

      let res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      let raw = await res.text();
      let data = safeParseResponse(raw);

      if (isEdit && !res.ok && (res.status === 405 || res.status === 415)) {
        const fd2 = buildArticleFormData({ judul, isi, penulis, jenisArtikel, kategoriId, kategoriName });
        fd2.append("_method", "PUT");

        res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd2,
        });

        raw = await res.text();
        data = safeParseResponse(raw);
      }

      if (!res.ok) {
        console.error(`❌ Error ${isEdit ? "PUT" : "POST"} /articles:`, data);
        showAlertSwal("Gagal menyimpan", extractErrorMessage(data), "error");
        return;
      }

      // ✅ kalau ini POST (create), auto-fix penulis via PUT
      if (!isEdit) {
        const newId = extractInsertedId(data);
        await postThenFixPenulis({ token, newId, judul, isi, penulis, jenisArtikel, kategoriId, kategoriName });
      }

      showAlertSwal(
        "Berhasil",
        isEdit ? "Perubahan artikel berhasil disimpan." : "Artikel baru berhasil disimpan.",
        "success"
      );

      formArtikel.reset();
      currentEditId = null;
      currentEditExistingDoc = "";
      currentEditExistingImage = "";

      if (selectJenis) selectJenis.value = "";
      if (selectKategori) {
        selectKategori.innerHTML = '<option value="" disabled selected>Pilih kategori / bidang artikel</option>';
      }

      loadArticles();
    } catch (err) {
      console.error("❌ FETCH ERROR submitArtikel:", err);
      showAlertSwal("Error", "Tidak dapat terhubung ke server.", "error");
    }
  }

  // ==========================
  // DELETE
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
      const data = safeParseResponse(raw);

      if (!res.ok) {
        console.error("❌ Error DELETE /articles/:id", data);
        showAlertSwal("Gagal menghapus", extractErrorMessage(data), "error");
        return;
      }

      showAlertSwal("Berhasil", "Artikel berhasil dihapus.", "success");

      if (currentEditId === id) {
        currentEditId = null;
        currentEditExistingDoc = "";
        currentEditExistingImage = "";
        if (formArtikel) formArtikel.reset();
      }

      loadArticles();
    } catch (err) {
      console.error("❌ FETCH ERROR DELETE /articles/:id", err);
      showAlertSwal("Error", "Tidak dapat terhubung ke server.", "error");
    }
  }

  // ==========================
  // Events
  // ==========================
  if (formArtikel) formArtikel.addEventListener("submit", submitArtikel);

  if (selectJenis) {
    selectJenis.addEventListener("change", (e) => {
      const val = e.target.value || "";
      if (!val) {
        if (selectKategori) {
          selectKategori.innerHTML = '<option value="" disabled selected>Pilih kategori / bidang artikel</option>';
        }
        return;
      }
      populateKategoriOptions(val);
    });
  }

  initCategories();
  loadArticles();
});
