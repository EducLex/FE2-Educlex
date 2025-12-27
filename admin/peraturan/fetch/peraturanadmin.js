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
      const sub = c.subkategori || "";
      if (!id || !sub) return;

      if (usedSubs.has(sub)) return;
      usedSubs.add(sub);

      const opt = document.createElement("option");
      opt.value = id; // value = ID kategori (disimpan di DB)
      opt.textContent = sub; // teks yang kelihatan
      opt.dataset.subkategori = sub;

      if (preselectText && preselectText === sub) opt.selected = true;

      selectKategoriDetail.appendChild(opt);
    });
  }

  async function loadCategories() {
    if (!selectKategoriDetail) return;

    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const raw = await res.text();
      let data = safeParse(raw);

      // beberapa backend balikin {data:[...]}
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
        const sub = String(c.subkategori || "").toLowerCase();
        return name === "internal" && sub === "pemulihan aset";
      });

      if (!alreadyHasPemulihan) categories.push(extraInternalCategory);

      internalSubs = categories
        .filter((c) => String(c.name || "").toLowerCase() === "internal")
        .map((c) => c.subkategori)
        .filter(Boolean);

      eksternalSubs = categories
        .filter((c) => String(c.name || "").toLowerCase() === "eksternal")
        .map((c) => c.subkategori)
        .filter(Boolean);

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

          // simpan dokumen lama supaya PUT tanpa file tidak menghilangkan dokumen
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
  function buildCommonFields({ judul, isiText, kategoriUtama, kategoriDetail, categoryId }) {
    // banyak alias biar backend kamu “nerima”
    return {
      judul,
      title: judul,

      isi: isiText,
      content: isiText,

      kategori: kategoriUtama,
      kategoriUtama: kategoriUtama,
      jenis: kategoriUtama,
      type: kategoriUtama,

      bidang: kategoriDetail,
      kategoriDetail: kategoriDetail,
      subkategori: kategoriDetail,
      sub_kategori: kategoriDetail,

      categoryId: categoryId,
      kategoriId: categoryId,
      category_id: categoryId,
    };
  }

  function validateSubkategori(kategoriUtama, kategoriDetail) {
    if (kategoriUtama === "internal" && internalSubs.length) {
      if (!internalSubs.includes(kategoriDetail)) {
        showError(
          `Subkategori internal "${kategoriDetail}" tidak ditemukan di data /categories.\n` +
            `Gunakan salah satu dari: ${internalSubs.join(", ")}`
        );
        return false;
      }
    }
    if (kategoriUtama === "eksternal" && eksternalSubs.length) {
      if (!eksternalSubs.includes(kategoriDetail)) {
        showError(
          `Subkategori eksternal "${kategoriDetail}" tidak ditemukan di data /categories.\n` +
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
    const kategoriDetail = selectedOption
      ? String(selectedOption.dataset.subkategori || selectedOption.textContent || "").trim()
      : "";

    if (!judul || isiList.length === 0) {
      showError("Judul dan isi peraturan wajib diisi.");
      return;
    }
    if (!kategoriUtama) {
      showError("Pilih jenis peraturan (internal / eksternal).");
      return;
    }
    if (!kategoriDetail) {
      showError("Pilih kategori / subkategori peraturan.");
      return;
    }

    if (!validateSubkategori(kategoriUtama, kategoriDetail)) return;

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
      kategoriDetail,
      categoryId,
    });

    const hasFile =
      dokumenFileInput && dokumenFileInput.files && dokumenFileInput.files.length > 0;

    // URL + method
    const isEdit = !!editingId;
    const url = isEdit ? `${API_BASE}/peraturan/${editingId}` : `${API_BASE}/peraturan`;

    try {
      // ============================
      // 1) EDIT TANPA FILE => JSON PUT (INI YANG BIKIN EDIT KAMU BERHASIL)
      // ============================
      if (isEdit && !hasFile) {
        // bawa dokumen lama kalau ada supaya gak hilang
        const dokUrl = (dokumenUrlInput && dokumenUrlInput.value.trim()) || "";
        const payload = {
          ...common,

          // kalau backend pakai dokumen_url:
          dokumen_url: dokUrl || (String(existingDokumenValue || "").includes("http") ? existingDokumenValue : ""),
          dokumenUrl: dokUrl,

          // kalau backend pakai dokumen path (uploads/xxx.pdf):
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
          console.error("❌ Error PUT(JSON) /peraturan/:id:", res.status, data);

          // fallback: beberapa backend maunya PATCH
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

        // reset form
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
      // 2) TAMBAH / EDIT DENGAN FILE => FormData (POST/PUT)
      // ============================
      const fd = new FormData();

      // append common fields + alias
      Object.entries(common).forEach(([k, v]) => fd.append(k, v));

      // alias tambahan yang sering dipakai
      fd.append("subkategoriInternal", kategoriDetail);
      fd.append("subKategoriInternal", kategoriDetail);
      fd.append("subkategori_internal", kategoriDetail);

      fd.append("subkategoriEksternal", kategoriDetail);
      fd.append("subKategoriEksternal", kategoriDetail);
      fd.append("subkategori_eksternal", kategoriDetail);

      // dokumen: file atau url
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
        // jaga-jaga agar backend gak ngeblank-in dokumen
        fd.append("dokumenLama", existingDokumenValue);
        fd.append("existingDokumen", existingDokumenValue);
        fd.append("dokumen", existingDokumenValue);
      }

      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          // JANGAN set Content-Type agar boundary multipart benar
        },
        body: fd,
      });

      const text = await res.text();
      const data = safeParse(text);

      if (!res.ok) {
        console.error(`❌ Error ${method} /peraturan:`, res.status, data);

        // fallback PATCH multipart (beberapa API pakai PATCH)
        if (isEdit) {
          const res2 = await fetch(url, {
            method: "PATCH",
            headers: { Authorization: "Bearer " + token },
            body: fd,
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

      // reset form
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
