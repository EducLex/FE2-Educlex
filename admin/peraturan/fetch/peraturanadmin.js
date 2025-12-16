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
  let categories = [];  // hasil GET /categories
  let internalSubs = [];
  let eksternalSubs = [];

  // ============================
  // Helper SweetAlert
  // ============================
  function showError(message) {
    Swal.fire("Gagal", message, "error");
  }

  function showSuccess(message) {
    Swal.fire("Berhasil", message, "success");
  }

  function getToken() {
    return localStorage.getItem("token") || "";
  }

  // ============================
  // KATEGORI dari /categories
  // ============================
  function applySubkategoriOptions(jenis, preselectText) {
    if (!selectKategoriDetail) return;

    const jenisLower = (jenis || "").toLowerCase();

    // reset options
    selectKategoriDetail.innerHTML = `
      <option value="" disabled selected>Pilih kategori / subkategori</option>
    `;

    if (!jenisLower) return;

    const filtered = categories.filter(
      (c) => String(c.name || "").toLowerCase() === jenisLower
    );

    const usedSubs = new Set();

    filtered.forEach((c) => {
      const id = c._id || c.id || c.categoryId;
      const sub = c.subkategori || "";
      if (!id || !sub) return;

      // hindari duplikat subkategori kalau ada dua entry sama
      if (usedSubs.has(sub)) return;
      usedSubs.add(sub);

      const opt = document.createElement("option");
      opt.value = id;                 // value = ID kategori (disimpan di DB)
      opt.textContent = sub;          // teks yang kelihatan
      opt.dataset.subkategori = sub;  // simpan teks aslinya

      if (preselectText && preselectText === sub) {
        opt.selected = true;
      }
      selectKategoriDetail.appendChild(opt);
    });
  }

  async function loadCategories() {
    if (!selectKategoriDetail) return;

    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!Array.isArray(data)) return;

      // simpan hasil aslinya dulu
      categories = data;

      // ==============================
      // Tambah kategori internal manual:
      // _id: 693f6813e1e21d9a8b0101d6
      // name: "internal"
      // subkategori: "Pemulihan Aset"
      // ==============================
      const extraInternalCategory = {
        _id: "693f6813e1e21d9a8b0101d6",
        name: "internal",
        subkategori: "Pemulihan Aset"
      };

      const alreadyHasPemulihan = categories.some((c) => {
        const name = String(c.name || "").toLowerCase();
        const sub = String(c.subkategori || "").toLowerCase();
        return name === "internal" && sub === "pemulihan aset";
      });

      // kalau backend belum punya, kita inject; kalau sudah, kita nggak dobelin
      if (!alreadyHasPemulihan) {
        categories.push(extraInternalCategory);
      }

      // rebuild list internal & eksternal setelah injeksi
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
          Authorization: "Bearer " + getToken()
        }
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

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

      if (!Array.isArray(data) || data.length === 0) {
        tabelBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; color:#6d4c41;">
              Belum ada data peraturan.
            </td>
          </tr>
        `;
        return;
      }

      // urutkan dari yang terbaru
      data.sort((a, b) => {
        const da = a.tanggal || a.createdAt || a.created_at;
        const db = b.tanggal || b.createdAt || b.created_at;
        return new Date(db || 0) - new Date(da || 0);
      });

      tabelBody.innerHTML = data
        .map((item) => {
          const id = item.id || item._id || "";
          const judul = item.judul || "-";

          const tanggalRaw =
            item.tanggal || item.created_at || item.createdAt || "";
          const tanggal = tanggalRaw
            ? new Date(tanggalRaw).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "long",
                year: "numeric"
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
          const record = data.find(
            (item) => String(item.id || item._id) === String(id)
          );
          if (!record) return;

          editingId = id;

          const judulInput = document.getElementById("judul");
          if (judulInput) judulInput.value = record.judul || "";

          const container = document.getElementById("peraturanContainer");
          if (container) {
            container.innerHTML = "";
            const isiArray = Array.isArray(record.isi)
              ? record.isi
              : (record.isi || "")
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
            record.bidang ||
            record.kategoriDetail ||
            record.subkategori ||
            "";

          if (selectKategoriUtama) {
            selectKategoriUtama.value = kategori || "";
          }
          applySubkategoriOptions(kategori, bidang);

          if (dokumenUrlInput) {
            dokumenUrlInput.value =
              record.dokumen_url ||
              record.dokumenUrl ||
              record.link_dokumen ||
              "";
          }
          if (dokumenFileInput) dokumenFileInput.value = "";

          const btnSimpan = formPeraturan.querySelector(".btn-simpan");
          if (btnSimpan) {
            btnSimpan.innerHTML = `<i class="fas fa-save"></i> Perbarui Data`;
          }

          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });

      // DELETE
      document.querySelectorAll(".btn-delete").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          if (!id) return;

          Swal.fire({
            title: "Hapus peraturan ini?",
            text: "Tindakan ini tidak dapat dibatalkan.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#6D4C41",
            confirmButtonText: "Ya, hapus",
            cancelButtonText: "Batal"
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
        headers: {
          Authorization: "Bearer " + getToken()
        }
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        console.error("❌ Error DELETE /peraturan/:id:", res.status, data);
        showError(
          data.error || data.message || "Gagal menghapus peraturan."
        );
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
  async function submitPeraturan(e) {
    e.preventDefault();

    const judulInput = document.getElementById("judul");
    const judul = judulInput ? judulInput.value.trim() : "";

    const isiTextareas = document.querySelectorAll(
      "#peraturanContainer textarea[name='isi[]']"
    );
    const isiList = Array.from(isiTextareas)
      .map((ta) => ta.value.trim())
      .filter((v) => v !== "");

    const kategoriUtama = selectKategoriUtama
      ? selectKategoriUtama.value
      : "";
    const selectedOption = selectKategoriDetail
      ? selectKategoriDetail.options[selectKategoriDetail.selectedIndex]
      : null;

    const categoryId = selectedOption ? selectedOption.value : "";
    const kategoriDetail = selectedOption
      ? (selectedOption.dataset.subkategori || selectedOption.textContent || "").trim()
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

    // VALIDASI lawan /categories
    if (kategoriUtama === "internal" && internalSubs.length) {
      if (!internalSubs.includes(kategoriDetail)) {
        showError(
          `Subkategori internal "${kategoriDetail}" tidak ditemukan di data /categories. ` +
          `Gunakan salah satu dari: ${internalSubs.join(", ")}`
        );
        return;
      }
    }
    if (kategoriUtama === "eksternal" && eksternalSubs.length) {
      if (!eksternalSubs.includes(kategoriDetail)) {
        showError(
          `Subkategori eksternal "${kategoriDetail}" tidak ditemukan di data /categories. ` +
          `Gunakan salah satu dari: ${eksternalSubs.join(", ")}`
        );
        return;
      }
    }

    const token = getToken();
    if (!token) {
      showError("Sesi login berakhir, silakan login ulang.");
      return;
    }

    const fd = new FormData();
    fd.append("judul", judul);
    fd.append("isi", isiList.join("\n\n"));
    fd.append("kategori", kategoriUtama);
    fd.append("bidang", kategoriDetail);
    fd.append("subkategori", kategoriDetail);

    // field spesifik internal / eksternal
    if (kategoriUtama === "internal") {
      fd.append("subkategoriInternal", kategoriDetail);
      fd.append("subKategoriInternal", kategoriDetail);
      fd.append("subkategori_internal", kategoriDetail);
    } else if (kategoriUtama === "eksternal") {
      fd.append("subkategoriEksternal", kategoriDetail);
      fd.append("subKategoriEksternal", kategoriDetail);
      fd.append("subkategori_eksternal", kategoriDetail);
    }

    if (categoryId) {
      fd.append("categoryId", categoryId);
      fd.append("kategoriId", categoryId);
    }

    const hasFile =
      dokumenFileInput &&
      dokumenFileInput.files &&
      dokumenFileInput.files.length > 0;

    fd.append("hasDokumenFile", hasFile ? "true" : "false");

    if (hasFile) {
      // backend sebaiknya menyimpan req.file.filename dan path "uploads/<filename>"
      fd.append("dokumen", dokumenFileInput.files[0]);
    } else if (dokumenUrlInput && dokumenUrlInput.value.trim()) {
      fd.append("dokumen_url", dokumenUrlInput.value.trim());
    }

    console.log("📤 PAYLOAD PREVIEW POST/PUT /peraturan:", {
      judul,
      isi: isiList.join("\n\n"),
      kategori: kategoriUtama,
      bidang: kategoriDetail,
      categoryId,
      hasDokumenFile: hasFile
    });

    const url = editingId
      ? `${API_BASE}/peraturan/${editingId}`
      : `${API_BASE}/peraturan`;
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: "Bearer " + token
          // jangan set Content-Type, biar browser set multipart/form-data
        },
        body: fd
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        console.error(`❌ Error ${method} /peraturan:`, res.status, data);
        showError(
          data.error ||
            data.message ||
            `Gagal menyimpan data peraturan.`
        );
        return;
      }

      showSuccess(
        editingId
          ? "Data peraturan berhasil diperbarui."
          : "Data peraturan berhasil disimpan."
      );

      // reset form
      editingId = null;
      if (formPeraturan) formPeraturan.reset();

      if (selectKategoriDetail) {
        selectKategoriDetail.innerHTML =
          `<option value="" disabled selected>Pilih kategori / subkategori</option>`;
      }

      const container = document.getElementById("peraturanContainer");
      if (container) {
        container.innerHTML = `
          <div class="form-group peraturan-item">
            <label for="isi1">Isi Peraturan</label>
            <textarea
              id="isi1"
              name="isi[]"
              rows="4"
              placeholder="Masukkan isi peraturan..."
              required
            ></textarea>
          </div>
        `;
      }
      if (dokumenFileInput) dokumenFileInput.value = "";

      const btnSimpan = formPeraturan.querySelector(".btn-simpan");
      if (btnSimpan) {
        btnSimpan.innerHTML = `<i class="fas fa-save"></i> Simpan Data`;
      }

      loadPeraturan();
    } catch (err) {
      console.error(`❌ FETCH ERROR ${method} /peraturan:`, err);
      showError("Gagal terhubung ke server.");
    }
  }

  // ============================
  // Events
  // ============================
  if (formPeraturan) {
    formPeraturan.addEventListener("submit", submitPeraturan);
  }

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
