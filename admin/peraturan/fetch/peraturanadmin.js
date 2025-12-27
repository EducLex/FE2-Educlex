// /admin/peraturan/fetch/peraturanadmin.js
document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const formPeraturan = document.getElementById("formPeraturan");
  const tabelBody = document.getElementById("tabelPeraturanBody");

  const selectKategoriUtama = document.getElementById("kategoriUtama");
  const selectKategoriDetail = document.getElementById("kategoriDetail");

  // dukung beberapa kemungkinan id input file
  const dokumenFileInput =
    document.getElementById("dokumenFile") ||
    document.getElementById("dokumen") ||
    document.querySelector("input[type='file'][name='dokumen']");

  const dokumenUrlInput = document.getElementById("dokumenUrl"); // kalau ada versi link

  let editingId = null; // null = mode tambah
  let categories = []; // hasil GET /categories
  let internalSubs = [];
  let eksternalSubs = [];

  // simpan list supaya edit bisa ambil record-nya
  let allPeraturan = [];

  // simpan dokumen lama agar edit tanpa upload file tetap aman
  let existingDokumenValue = "";

  // ============================
  // Helper SweetAlert
  // ============================
  function showError(message) {
    if (typeof Swal === "undefined") return alert(message);
    Swal.fire("Gagal", message, "error");
  }

  function showSuccess(message) {
    if (typeof Swal === "undefined") return alert(message);
    Swal.fire("Berhasil", message, "success");
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  function extractErr(data) {
    return (
      data?.error ||
      data?.message ||
      data?.msg ||
      (Array.isArray(data?.errors) ? data.errors.map((e) => e.message || e.msg).join(", ") : "") ||
      "Terjadi kesalahan."
    );
  }

  function pick(obj, keys, fallback = "") {
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

  // ============================
  // ✅ Normalizer & helpers
  // ============================
  function normalizeSubkategori(value) {
    return String(value || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function prettifySpaces(value) {
    return String(value || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function debugCharCodes(label, str) {
    try {
      const s = String(str ?? "");
      const codes = Array.from(s).map((ch) => ch.charCodeAt(0));
      const hasNBSP = codes.includes(160);
      console.log(`🧾 DEBUG ${label}:`, {
        text: s,
        length: s.length,
        hasNBSP,
        charCodes: codes,
      });
    } catch (e) {
      console.warn("debugCharCodes error:", e);
    }
  }

  function toTitleCaseKeepDan(str) {
    const raw = prettifySpaces(str);
    return raw
      .split(" ")
      .map((w) => {
        const lw = w.toLowerCase();
        if (lw === "dan") return "dan";
        if (!w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  function makeSlugForms(label) {
    const norm = normalizeSubkategori(label);
    const snake = norm.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const kebab = norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return { norm, snake, kebab };
  }

  function isObjectIdLike(v) {
    const s = String(v || "");
    return /^[a-f\d]{24}$/i.test(s);
  }

  function getSubkategoriVariantsForBackend(kategoriDetailRaw, kategoriDetailPretty, categoryIdResolved) {
    const baseRaw = String(kategoriDetailRaw || "");
    const basePretty = prettifySpaces(kategoriDetailPretty || kategoriDetailRaw || "");
    const titlePretty = toTitleCaseKeepDan(basePretty);
    const { norm, snake, kebab } = makeSlugForms(basePretty);

    const variants = [
      baseRaw,
      basePretty,
      titlePretty,
      norm,
      snake,
      kebab,
      basePretty.replace(/\s+dan\s+/gi, " & "),
      titlePretty.replace(/\s+dan\s+/gi, " & "),
      ...(categoryIdResolved ? [String(categoryIdResolved)] : []),
    ].filter(Boolean);

    return Array.from(new Set(variants));
  }

  // ============================
  // ✅ RESOLVE kategori & id
  // ============================
  function resolveKategoriDetailAndId({ kategoriUtama, kategoriDetailRaw, kategoriDetailPretty, categoryId }) {
    const jenisLower = String(kategoriUtama || "").toLowerCase();
    const targetNorm = normalizeSubkategori(kategoriDetailPretty || kategoriDetailRaw);

    const matches = categories.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const subRaw = String(c.subkategori || c.subKategori || c.sub_kategori || "");
      return name === jenisLower && normalizeSubkategori(subRaw) === targetNorm;
    });

    let match = matches[0];
    if (matches.length > 1) {
      const preferred = matches.find(
        (m) => String(m._id || m.id || m.categoryId || "") === String(categoryId || "")
      );
      if (preferred) match = preferred;
    }

    if (match) {
      const resolvedId = String(match._id || match.id || match.categoryId || categoryId || "");
      const resolvedSubRaw = String(match.subkategori || match.subKategori || match.sub_kategori || kategoriDetailRaw || "");
      const resolvedSubPretty = prettifySpaces(resolvedSubRaw);

      return {
        resolvedKategoriDetailRaw: resolvedSubRaw,
        resolvedKategoriDetailPretty: resolvedSubPretty,
        resolvedCategoryId: resolvedId,
        found: true,
      };
    }

    return {
      resolvedKategoriDetailRaw: String(kategoriDetailRaw || ""),
      resolvedKategoriDetailPretty: prettifySpaces(kategoriDetailPretty || kategoriDetailRaw || ""),
      resolvedCategoryId: String(categoryId || ""),
      found: false,
    };
  }

  // ============================
  // KATEGORI dari /categories
  // ============================
  function applySubkategoriOptions(jenis, preselectText) {
    if (!selectKategoriDetail) return;

    const jenisLower = (jenis || "").toLowerCase();

    selectKategoriDetail.innerHTML = `
      <option value="" disabled selected>Pilih kategori / subkategori</option>
    `;

    if (!jenisLower) return;

    const filtered = categories.filter((c) => String(c.name || "").toLowerCase() === jenisLower);

    const usedSubs = new Set();

    filtered.forEach((c) => {
      const id = c._id || c.id || c.categoryId;
      const subRaw = String(c.subkategori || c.subKategori || c.sub_kategori || "");
      if (!id || !subRaw) return;

      const key = normalizeSubkategori(subRaw);
      if (usedSubs.has(key)) return;
      usedSubs.add(key);

      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = subRaw;

      opt.dataset.subkategori = subRaw; // lama dipertahankan
      opt.dataset.subkategoriRaw = subRaw; // baru
      opt.dataset.subkategoriNorm = key; // baru

      if (preselectText && normalizeSubkategori(preselectText) === key) opt.selected = true;

      selectKategoriDetail.appendChild(opt);
    });
  }

  async function loadCategories() {
    if (!selectKategoriDetail) return;

    const token = getToken();

    const tryFetch = async (withAuth) => {
      const headers = { "Content-Type": "application/json" };
      if (withAuth && token) headers.Authorization = "Bearer " + token;

      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers,
      });

      const raw = await res.text();
      const data = safeParse(raw);
      return { res, data };
    };

    try {
      let out = await tryFetch(true);
      if (!out.res.ok && (out.res.status === 401 || out.res.status === 403)) {
        out = await tryFetch(false);
      }

      let data = out.data;

      if (!Array.isArray(data)) {
        if (Array.isArray(data.data)) data = data.data;
        else if (Array.isArray(data.categories)) data = data.categories;
        else data = [];
      }
      if (!Array.isArray(data)) data = [];

      categories = data;

      // inject pemulihan aset (tetap dipertahankan sesuai kode kamu)
      const extraInternalCategory = {
        _id: "693f6813e1e21d9a8b0101d6",
        name: "internal",
        subkategori: "Pemulihan Aset",
      };

      const alreadyHasPemulihan = categories.some((c) => {
        const name = String(c.name || "").toLowerCase();
        const sub = String(c.subkategori || c.subKategori || c.sub_kategori || "").toLowerCase();
        return name === "internal" && sub === "pemulihan aset";
      });

      if (!alreadyHasPemulihan) categories.push(extraInternalCategory);

      internalSubs = categories
        .filter((c) => String(c.name || "").toLowerCase() === "internal")
        .map((c) => String(c.subkategori || c.subKategori || c.sub_kategori || ""))
        .filter(Boolean);

      eksternalSubs = categories
        .filter((c) => String(c.name || "").toLowerCase() === "eksternal")
        .map((c) => String(c.subkategori || c.subKategori || c.sub_kategori || ""))
        .filter(Boolean);

      // debug table
      const debugInternal = categories
        .filter((c) => String(c.name || "").toLowerCase() === "internal")
        .map((c) => ({
          id: c._id || c.id || c.categoryId,
          subkategori: c.subkategori || c.subKategori || c.sub_kategori,
        }));
      console.table(debugInternal);

      const currentJenis = selectKategoriUtama ? selectKategoriUtama.value : "";
      applySubkategoriOptions(currentJenis);
    } catch (err) {
      console.warn("Gagal memuat /categories:", err);
    }
  }

  // ============================
  // Load list peraturan (GET)
  // ============================
  async function loadPeraturan() {
    if (!tabelBody) return;

    tabelBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; color:#6d4c41;">
          Memuat data...
        </td>
      </tr>
    `;

    try {
      const res = await fetch(`${API_BASE}/peraturan`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
      });

      const text = await res.text();
      let data = safeParse(text);

      if (!res.ok) {
        console.error("❌ Error GET /peraturan:", res.status, data);
        tabelBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; color:#f44336;">
              Gagal mengambil data peraturan.
            </td>
          </tr>
        `;
        return;
      }

      // normalisasi list
      let list = [];
      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data.data)) list = data.data;
      else if (Array.isArray(data.peraturan)) list = data.peraturan;

      if (!Array.isArray(list) || list.length === 0) {
        allPeraturan = [];
        tabelBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; color:#6d4c41;">
              Belum ada data peraturan.
            </td>
          </tr>
        `;
        return;
      }

      // urutkan terbaru
      list.sort((a, b) => {
        const da = a.tanggal || a.createdAt || a.created_at;
        const db = b.tanggal || b.createdAt || b.created_at;
        return new Date(db || 0) - new Date(da || 0);
      });

      allPeraturan = list;

      tabelBody.innerHTML = list
        .map((item) => {
          const id = item.id || item._id || "";
          const judul = item.judul || "-";

          const tanggalRaw = item.tanggal || item.created_at || item.createdAt || "";
          const tanggal = tanggalRaw
            ? new Date(tanggalRaw).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "-";

          return `
            <tr>
              <td>${judul}</td>
              <td>${tanggal}</td>
              <td>
                <button class="btn-edit action-btn" data-id="${id}">
                  <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-delete action-btn" data-id="${id}">
                  <i class="fas fa-trash"></i> Hapus
                </button>
              </td>
            </tr>
          `;
        })
        .join("");

      // EDIT
      document.querySelectorAll(".btn-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const record = allPeraturan.find((x) => String(x.id || x._id) === String(id));
          if (!record) return;

          editingId = id;

          const judulInput = document.getElementById("judul");
          if (judulInput) judulInput.value = record.judul || "";

          // isi peraturan (support array / string)
          const container = document.getElementById("peraturanContainer");
          if (container) {
            container.innerHTML = "";

            const isiRaw = record.isi || record.content || "";
            const isiArray = Array.isArray(isiRaw)
              ? isiRaw
              : String(isiRaw)
                  .split(/\n{2,}|\r\n{2,}/)
                  .map((s) => s.trim())
                  .filter(Boolean);

            if (isiArray.length === 0) isiArray.push("");

            isiArray.forEach((teks, idx) => {
              const div = document.createElement("div");
              div.className = "form-group peraturan-item";
              div.innerHTML = `
                <label for="isi${idx + 1}">Isi Peraturan</label>
                <textarea
                  id="isi${idx + 1}"
                  name="isi[]"
                  rows="4"
                  placeholder="Masukkan isi peraturan..."
                  required
                >${teks}</textarea>
              `;
              container.appendChild(div);
            });
          }

          // kategori utama & subkategori
          const kategori = record.kategori || record.kategoriUtama || "";
          const bidang =
            record.bidang || record.kategoriDetail || record.subkategori || record.sub_kategori || "";

          if (selectKategoriUtama) selectKategoriUtama.value = kategori || "";
          applySubkategoriOptions(kategori, bidang);

          // simpan dokumen lama
          existingDokumenValue = pick(record, ["dokumen", "dokumen_url", "dokumenUrl", "file", "attachment", "documentUrl"], "");

          if (dokumenUrlInput) {
            dokumenUrlInput.value = pick(record, ["dokumen_url", "dokumenUrl", "link_dokumen"], "");
          }
          if (dokumenFileInput) dokumenFileInput.value = "";

          const btnSimpan = formPeraturan?.querySelector(".btn-simpan");
          if (btnSimpan) btnSimpan.innerHTML = `<i class="fas fa-save"></i> Perbarui Data`;

          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });

      // DELETE
      document.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;

          if (typeof Swal === "undefined") {
            const ok = confirm("Hapus peraturan ini?");
            if (ok) deletePeraturan(id);
            return;
          }

          Swal.fire({
            title: "Hapus peraturan ini?",
            text: "Tindakan ini tidak dapat dibatalkan.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6D4C41",
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal",
          }).then((result) => {
            if (result.isConfirmed) deletePeraturan(id);
          });
        });
      });
    } catch (err) {
      console.error("❌ FETCH ERROR /peraturan:", err);
      tabelBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; color:#f44336;">
            Gagal terhubung ke server.
          </td>
        </tr>
      `;
    }
  }

  // ============================
  // DELETE /peraturan/:id
  // ============================
  async function deletePeraturan(id) {
    try {
      const res = await fetch(`${API_BASE}/peraturan/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + getToken() },
      });

      const text = await res.text();
      const data = safeParse(text);

      if (!res.ok) {
        console.error("❌ Error DELETE /peraturan/:id:", res.status, data);
        showError(extractErr(data) || "Gagal menghapus peraturan.");
        return;
      }

      showSuccess("Peraturan berhasil dihapus.");
      loadPeraturan();
    } catch (err) {
      console.error("❌ FETCH ERROR DELETE /peraturan/:id:", err);
      showError("Gagal terhubung ke server.");
    }
  }

  // ============================
  // SUBMIT (POST / PUT)
  // ============================
  function buildCommonFields({ judul, isiText, kategoriUtama, kategoriDetailRaw, kategoriDetailPretty, categoryId }) {
    return {
      judul,
      title: judul,

      isi: isiText,
      content: isiText,

      kategori: kategoriUtama,
      kategoriUtama: kategoriUtama,
      jenis: kategoriUtama,
      type: kategoriUtama,

      // kirim RAW + pretty
      bidang: kategoriDetailRaw,
      kategoriDetail: kategoriDetailRaw,
      subkategori: kategoriDetailRaw,
      sub_kategori: kategoriDetailRaw,

      bidang_pretty: kategoriDetailPretty,
      kategoriDetail_pretty: kategoriDetailPretty,
      subkategori_pretty: kategoriDetailPretty,

      categoryId: categoryId,
      kategoriId: categoryId,
      category_id: categoryId,

      kategoriDetailId: categoryId,
      subkategoriId: categoryId,
      bidangId: categoryId,
      sub_kategori_id: categoryId,
    };
  }

  function validateSubkategori(kategoriUtama, kategoriDetailPretty) {
    const ku = String(kategoriUtama || "").toLowerCase();

    if (ku === "internal" && internalSubs.length) {
      const targetNorm = normalizeSubkategori(kategoriDetailPretty);
      const internalNorms = internalSubs.map((s) => normalizeSubkategori(s));
      if (!internalNorms.includes(targetNorm)) {
        showError(
          `Subkategori internal "${kategoriDetailPretty}" tidak ditemukan di data /categories.\n` +
            `Gunakan salah satu dari: ${internalSubs.join(", ")}`
        );
        return false;
      }
    }

    if (ku === "eksternal" && eksternalSubs.length) {
      const targetNorm = normalizeSubkategori(kategoriDetailPretty);
      const eksternalNorms = eksternalSubs.map((s) => normalizeSubkategori(s));
      if (!eksternalNorms.includes(targetNorm)) {
        showError(
          `Subkategori eksternal "${kategoriDetailPretty}" tidak ditemukan di data /categories.\n` +
            `Gunakan salah satu dari: ${eksternalSubs.join(", ")}`
        );
        return false;
      }
    }

    return true;
  }

  async function submitPeraturan(e) {
    e.preventDefault();

    const judulInput = document.getElementById("judul");
    const judul = judulInput ? judulInput.value.trim() : "";

    const isiTextareas = document.querySelectorAll("#peraturanContainer textarea[name='isi[]']");
    const isiList = Array.from(isiTextareas)
      .map((ta) => ta.value.trim())
      .filter((v) => v !== "");

    const kategoriUtama = selectKategoriUtama ? selectKategoriUtama.value : "";

    const selectedOption =
      selectKategoriDetail && selectKategoriDetail.selectedIndex >= 0
        ? selectKategoriDetail.options[selectKategoriDetail.selectedIndex]
        : null;

    const categoryId = selectedOption ? String(selectedOption.value || "") : "";

    const kategoriDetailRaw = selectedOption
      ? String(selectedOption.dataset.subkategoriRaw || selectedOption.dataset.subkategori || selectedOption.textContent || "")
      : "";

    const kategoriDetailPretty = selectedOption ? prettifySpaces(kategoriDetailRaw) : "";

    if (!judul || isiList.length === 0) {
      showError("Judul dan isi peraturan wajib diisi.");
      return;
    }
    if (!kategoriUtama) {
      showError("Pilih jenis peraturan (internal / eksternal).");
      return;
    }
    if (!kategoriDetailRaw) {
      showError("Pilih kategori / subkategori peraturan.");
      return;
    }

    debugCharCodes("kategoriDetailRaw (dari option)", kategoriDetailRaw);
    debugCharCodes("kategoriDetailPretty (dirapikan)", kategoriDetailPretty);

    const resolved = resolveKategoriDetailAndId({
      kategoriUtama,
      kategoriDetailRaw,
      kategoriDetailPretty,
      categoryId,
    });

    const kategoriDetailResolvedRaw = resolved.resolvedKategoriDetailRaw;
    const kategoriDetailResolvedPretty = resolved.resolvedKategoriDetailPretty;
    const categoryIdResolved = resolved.resolvedCategoryId;

    console.info("✅ Subkategori resolved:", {
      before: { kategoriDetailRaw, kategoriDetailPretty, categoryId },
      after: { kategoriDetailResolvedRaw, kategoriDetailResolvedPretty, categoryIdResolved },
      foundInCategories: resolved.found,
    });

    debugCharCodes("resolved RAW", kategoriDetailResolvedRaw);
    debugCharCodes("resolved PRETTY", kategoriDetailResolvedPretty);

    if (!validateSubkategori(kategoriUtama, kategoriDetailResolvedPretty)) return;

    const token = getToken();
    if (!token) {
      showError("Sesi login berakhir, silakan login ulang.");
      return;
    }

    const isiText = isiList.join("\n\n");

    const common = buildCommonFields({
      judul,
      isiText,
      kategoriUtama,
      kategoriDetailRaw: kategoriDetailResolvedRaw,
      kategoriDetailPretty: kategoriDetailResolvedPretty,
      categoryId: categoryIdResolved,
    });

    const hasFile = dokumenFileInput && dokumenFileInput.files && dokumenFileInput.files.length > 0;

    const isEdit = !!editingId;
    const url = isEdit ? `${API_BASE}/peraturan/${editingId}` : `${API_BASE}/peraturan`;
    const method = isEdit ? "PUT" : "POST";

    const fillDokumenToFD = (fd) => {
      fd.append("hasDokumenFile", hasFile ? "true" : "false");
      if (hasFile) {
        fd.append("dokumen", dokumenFileInput.files[0]);
        fd.append("file", dokumenFileInput.files[0]);
        fd.append("attachment", dokumenFileInput.files[0]);
        fd.append("document", dokumenFileInput.files[0]);
      } else if (dokumenUrlInput && dokumenUrlInput.value.trim()) {
        fd.append("dokumen_url", dokumenUrlInput.value.trim());
        fd.append("dokumenUrl", dokumenUrlInput.value.trim());
      } else if (existingDokumenValue) {
        fd.append("dokumenLama", existingDokumenValue);
        fd.append("existingDokumen", existingDokumenValue);
        fd.append("dokumen", existingDokumenValue);
      }
    };

    const buildFDWithInternalValue = (internalValue) => {
      const fd = new FormData();
      Object.entries(common).forEach(([k, v]) => fd.append(k, v));

      // penting: internal fields
      fd.append("subkategoriInternal", String(internalValue));
      fd.append("subKategoriInternal", String(internalValue));
      fd.append("subkategori_internal", String(internalValue));

      // label (buat display)
      fd.append("subkategoriInternalLabel", kategoriDetailResolvedPretty);
      fd.append("subKategoriInternalLabel", kategoriDetailResolvedPretty);
      fd.append("subkategori_internal_label", kategoriDetailResolvedPretty);

      // eksternal (tetap)
      fd.append("subkategoriEksternal", kategoriDetailResolvedRaw);
      fd.append("subKategoriEksternal", kategoriDetailResolvedRaw);
      fd.append("subkategori_eksternal", kategoriDetailResolvedRaw);

      // extra debug fields (aman)
      fd.append("categoryIdResolved", String(categoryIdResolved || ""));
      fd.append("kategoriDetailResolvedRaw", String(kategoriDetailResolvedRaw || ""));
      fd.append("kategoriDetailResolvedPretty", String(kategoriDetailResolvedPretty || ""));

      fillDokumenToFD(fd);
      return fd;
    };

    try {
      // ============================
      // 1) EDIT TANPA FILE => JSON PUT
      // ============================
      if (isEdit && !hasFile) {
        const dokUrl = (dokumenUrlInput && dokumenUrlInput.value.trim()) || "";

        // kirim banyak alias internal sekaligus
        const payload = {
          ...common,

          subkategoriInternal: kategoriDetailResolvedRaw,
          subKategoriInternal: kategoriDetailResolvedRaw,
          subkategori_internal: kategoriDetailResolvedRaw,

          subkategoriInternalLabel: kategoriDetailResolvedPretty,
          subKategoriInternalLabel: kategoriDetailResolvedPretty,
          subkategori_internal_label: kategoriDetailResolvedPretty,

          // juga kirim versi ID kalau backend pakai id
          subkategoriInternalId: categoryIdResolved,
          sub_kategori_internal_id: categoryIdResolved,

          // eksternal tetap
          subkategoriEksternal: kategoriDetailResolvedRaw,
          subKategoriEksternal: kategoriDetailResolvedRaw,
          subkategori_eksternal: kategoriDetailResolvedRaw,

          dokumen_url:
            dokUrl || (String(existingDokumenValue || "").includes("http") ? existingDokumenValue : ""),
          dokumenUrl: dokUrl,

          dokumen: existingDokumenValue || "",
          existingDokumen: existingDokumenValue || "",
          dokumenLama: existingDokumenValue || "",
        };

        const res = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        const data = safeParse(text);

        if (!res.ok) {
          const res2 = await fetch(url, {
            method: "PATCH",
            headers: {
              Authorization: "Bearer " + token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const text2 = await res2.text();
          const data2 = safeParse(text2);

          if (!res2.ok) {
            console.error("❌ Error PATCH(JSON) /peraturan/:id:", res2.status, data2);
            showError(extractErr(data2));
            return;
          }
        }

        showSuccess("Data peraturan berhasil diperbarui.");

        // reset
        editingId = null;
        existingDokumenValue = "";
        if (formPeraturan) formPeraturan.reset();

        if (selectKategoriDetail) {
          selectKategoriDetail.innerHTML = `<option value="" disabled selected>Pilih kategori / subkategori</option>`;
        }

        const container = document.getElementById("peraturanContainer");
        if (container) {
          container.innerHTML = `
            <div class="form-group peraturan-item">
              <label for="isi1">Isi Peraturan</label>
              <textarea id="isi1" name="isi[]" rows="4" placeholder="Masukkan isi peraturan..." required></textarea>
            </div>
          `;
        }
        if (dokumenFileInput) dokumenFileInput.value = "";

        const btnSimpan = formPeraturan?.querySelector(".btn-simpan");
        if (btnSimpan) btnSimpan.innerHTML = `<i class="fas fa-save"></i> Simpan Data`;

        loadPeraturan();
        return;
      }

      // ============================
      // 2) TAMBAH / EDIT DENGAN FILE => FormData
      // ============================
      // attempt pertama: RAW
      let res = await fetch(url, {
        method,
        headers: { Authorization: "Bearer " + token },
        body: buildFDWithInternalValue(kategoriDetailResolvedRaw),
      });

      let text = await res.text();
      let data = safeParse(text);

      if (!res.ok) {
        const errMsg = String(extractErr(data) || "").toLowerCase();
        const isSubInvalid = errMsg.includes("subkategori internal tidak valid");

        if (isSubInvalid) {
          const variants = getSubkategoriVariantsForBackend(
            kategoriDetailResolvedRaw,
            kategoriDetailResolvedPretty,
            categoryIdResolved
          );

          console.warn("⚠️ Backend nolak subkategori internal. Coba variants:", variants);

          for (const v of variants) {
            const resTry = await fetch(url, {
              method,
              headers: { Authorization: "Bearer " + token },
              body: buildFDWithInternalValue(v),
            });

            const textTry = await resTry.text();
            const dataTry = safeParse(textTry);

            if (resTry.ok) {
              console.info("✅ Retry sukses pakai internalValue:", v);
              res = resTry;
              text = textTry;
              data = dataTry;
              break;
            } else {
              console.warn("❌ Retry gagal pakai internalValue:", v, dataTry);
            }
          }
        }
      }

      if (!res.ok) {
        console.error(`❌ Error ${method} /peraturan:`, res.status, data);

        if (isEdit) {
          // fallback PATCH multipart
          const res2 = await fetch(url, {
            method: "PATCH",
            headers: { Authorization: "Bearer " + token },
            body: buildFDWithInternalValue(kategoriDetailResolvedRaw),
          });

          const text2 = await res2.text();
          const data2 = safeParse(text2);

          if (!res2.ok) {
            console.error("❌ Error PATCH(multipart) /peraturan/:id:", res2.status, data2);
            showError(extractErr(data2));
            return;
          }
        } else {
          showError(extractErr(data) || "Gagal menyimpan data peraturan.");
          return;
        }
      }

      showSuccess(isEdit ? "Data peraturan berhasil diperbarui." : "Data peraturan berhasil disimpan.");

      // reset
      editingId = null;
      existingDokumenValue = "";
      if (formPeraturan) formPeraturan.reset();

      if (selectKategoriDetail) {
        selectKategoriDetail.innerHTML = `<option value="" disabled selected>Pilih kategori / subkategori</option>`;
      }

      const container = document.getElementById("peraturanContainer");
      if (container) {
        container.innerHTML = `
          <div class="form-group peraturan-item">
            <label for="isi1">Isi Peraturan</label>
            <textarea id="isi1" name="isi[]" rows="4" placeholder="Masukkan isi peraturan..." required></textarea>
          </div>
        `;
      }
      if (dokumenFileInput) dokumenFileInput.value = "";

      const btnSimpan = formPeraturan?.querySelector(".btn-simpan");
      if (btnSimpan) btnSimpan.innerHTML = `<i class="fas fa-save"></i> Simpan Data`;

      loadPeraturan();
    } catch (err) {
      console.error("❌ FETCH ERROR submitPeraturan:", err);
      showError("Gagal terhubung ke server.");
    }
  }

  // ============================
  // Events
  // ============================
  if (formPeraturan) formPeraturan.addEventListener("submit", submitPeraturan);

  if (selectKategoriUtama) {
    selectKategoriUtama.addEventListener("change", () => {
      const jenis = selectKategoriUtama.value;
      applySubkategoriOptions(jenis);
    });
  }

  // initial load
  loadCategories();
  loadPeraturan();
});
