// /admin/peraturan/fetch/peraturanadmin.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const formPeraturan = document.getElementById("formPeraturan");
  const tabelBody = document.getElementById("tabelPeraturanBody");

  const selectKategoriUtama = document.getElementById("kategoriUtama");
  const selectKategoriDetail = document.getElementById("kategoriDetail");

  let editingId = null; // null = mode tambah, ada nilai = mode edit

  // ============================
  // Helper SweetAlert wrapper
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
  // Load list peraturan (GET)
  // ============================
  async function loadPeraturan() {
    if (!tabelBody) return;

    tabelBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color:#6d4c41;">
          Memuat data...
        </td>
      </tr>
    `;

    try {
      const res = await fetch(`${API_BASE}/peraturan`, {
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
            <td colspan="4" style="text-align:center; color:#f44336;">
              Gagal mengambil data peraturan.
            </td>
          </tr>
        `;
        return;
      }

      if (!Array.isArray(data) || data.length === 0) {
        tabelBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center; color:#6d4c41;">
              Belum ada data peraturan.
            </td>
          </tr>
        `;
        return;
      }

      tabelBody.innerHTML = data
        .map((item) => {
          const id = item.id || item._id || "";
          const judul = item.judul || "-";
          const isi = item.isi;
          const jumlahPeraturan = Array.isArray(isi) ? isi.length : 1;

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
              <td style="text-align:center;">${jumlahPeraturan}</td>
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

      // Pasang event Edit
      document.querySelectorAll(".btn-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const record = data.find(
            (item) => String(item.id || item._id) === String(id)
          );
          if (!record) return;

          // Isi form untuk mode edit
          editingId = id;
          document.getElementById("judul").value = record.judul || "";

          const container = document.getElementById("peraturanContainer");
          container.innerHTML = "";

          const isiArray = Array.isArray(record.isi)
            ? record.isi
            : (record.isi || "").split("\n").filter((s) => s.trim() !== "");

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

          // Kategori utama & detail jika ada
          if (selectKategoriUtama) {
            selectKategoriUtama.value =
              record.kategori === "internal" || record.kategori === "eksternal"
                ? record.kategori
                : "";
          }
          if (selectKategoriDetail) {
            selectKategoriDetail.value =
              record.bidang || record.kategori_detail || "";
          }

          // Ubah teks tombol
          const btnSimpan = formPeraturan.querySelector(".btn-simpan");
          if (btnSimpan) {
            btnSimpan.innerHTML = `<i class="fas fa-save"></i> Perbarui Data`;
          }
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });

      // Pasang event Delete
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
            if (result.isConfirmed) {
              deletePeraturan(id);
            }
          });
        });
      });
    } catch (err) {
      console.error("❌ FETCH ERROR /peraturan:", err);
      tabelBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#f44336;">
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
        showError(data.error || data.message || "Gagal menghapus peraturan.");
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
  // POST /peraturan  (tambah)
  // PUT  /peraturan/:id (edit)
  // ============================
  async function submitPeraturan(e) {
    e.preventDefault();

    const judul = document.getElementById("judul").value.trim();
    const isiTextareas = document.querySelectorAll(
      "#peraturanContainer textarea[name='isi[]']"
    );

    const isiList = Array.from(isiTextareas)
      .map((ta) => ta.value.trim())
      .filter((v) => v !== "");

    const kategoriUtama = selectKategoriUtama
      ? selectKategoriUtama.value
      : "";
    const kategoriDetail = selectKategoriDetail
      ? selectKategoriDetail.value
      : "";

    if (!judul || isiList.length === 0) {
      showError("Judul dan isi peraturan wajib diisi.");
      return;
    }

    if (!kategoriUtama) {
      showError("Pilih jenis peraturan (internal / eksternal).");
      return;
    }

    // BE minta kategori HARUS 'internal' atau 'eksternal'
    if (!["internal", "eksternal"].includes(kategoriUtama)) {
      showError("Kategori harus 'internal' atau 'eksternal'.");
      return;
    }

    const payload = {
      judul: judul,
      isi: isiList.join("\n\n"), // ikuti format curl: satu field string
      kategori: kategoriUtama,   // <-- INI yang dibaca BE
      // info tambahan, kalau BE abaikan juga tidak masalah
      bidang: kategoriDetail || null
    };

    console.log("📤 PAYLOAD POST/PUT /peraturan:", payload);

    const url = editingId
      ? `${API_BASE}/peraturan/${editingId}`
      : `${API_BASE}/peraturan`;
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken()
        },
        body: JSON.stringify(payload)
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
      formPeraturan.reset();
      if (selectKategoriUtama) selectKategoriUtama.value = "";
      if (selectKategoriDetail) selectKategoriDetail.value = "";
      // kembalikan 1 textarea default
      const container = document.getElementById("peraturanContainer");
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
  // Event bindings
  // ============================
  if (formPeraturan) {
    formPeraturan.addEventListener("submit", submitPeraturan);
  }

  // initial load
  loadPeraturan();
});
