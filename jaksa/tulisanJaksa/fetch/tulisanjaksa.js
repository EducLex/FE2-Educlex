// /jaksa/tulisanJaksa/fetch/tulisanjaksa.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const formTulisan = document.getElementById("formTulisan");
  const inputPenulis = document.getElementById("penulis");
  const inputJudul = document.getElementById("judul");
  const inputIsi = document.getElementById("isi");
  const inputTanggal = document.getElementById("tanggal");
  const tbody = document.getElementById("tabelTulisanBody");

  // state untuk mode edit
  let editingId = null;

  // ==========================
  // Helper ambil token
  // ==========================
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  // ==========================
  // Set default tanggal = hari ini
  // ==========================
  if (inputTanggal) {
    const today = new Date().toISOString().split("T")[0];
    inputTanggal.value = today;
  }

  // ==========================
  // Render tabel tulisan
  // ==========================
  function renderTulisanTable(list) {
    if (!tbody) return;

    if (!Array.isArray(list) || list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#6D4C41;">
            Belum ada tulisan.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list
      .map((t) => {
        const id = t.id || t._id || t.tulisan_id || "";
        const judul = t.judul || "-";
        const penulis = t.penulis || "-";
        const tanggal = t.tanggal
          ? new Date(t.tanggal).toLocaleDateString("id-ID")
          : "-";

        const safeJudul = judul.replace(/"/g, "&quot;");
        const safePenulis = penulis.replace(/"/g, "&quot;");
        const safeIsi = (t.isi || "").replace(/"/g, "&quot;");

        return `
          <tr>
            <td>${judul}</td>
            <td>${penulis}</td>
            <td>${tanggal}</td>
            <td>
              <button
                class="btn-edit action-btn"
                data-id="${id}"
                data-judul="${safeJudul}"
                data-penulis="${safePenulis}"
                data-isi="${safeIsi}"
                data-tanggal="${t.tanggal || ""}"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                class="btn-delete action-btn"
                data-id="${id}"
              >
                <i class="fas fa-trash"></i>
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
        const judul = btn.getAttribute("data-judul") || "";
        const penulis = btn.getAttribute("data-penulis") || "";
        const isi = btn.getAttribute("data-isi") || "";
        const tanggal = btn.getAttribute("data-tanggal") || "";

        editingId = id;

        if (inputJudul) inputJudul.value = judul;
        if (inputPenulis) inputPenulis.value = penulis;
        if (inputIsi) inputIsi.value = isi;
        if (inputTanggal) {
          inputTanggal.value = tanggal
            ? new Date(tanggal).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];
        }

        Swal.fire("Mode Edit", "Silakan ubah tulisan lalu klik Simpan.", "info");
      });
    });

    // Pasang event Delete
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
        }).then((result) => {
          if (result.isConfirmed) {
            deleteTulisan(id);
          }
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
      <tr>
        <td colspan="4" style="text-align:center; color:#6D4C41;">
          Memuat data...
        </td>
      </tr>
    `;

    const token = getToken();
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE}/tulisan`, { headers });

      if (!res.ok) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center; color:#f44336;">
              Gagal memuat data tulisan.
            </td>
          </tr>
        `;
        return;
      }

      const data = await res.json().catch(() => []);
      renderTulisanTable(data);
    } catch (err) {
      // jangan spam console error, cukup tampilkan di UI
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#f44336;">
            Gagal terhubung ke server.
          </td>
        </tr>
      `;
    }
  }

  // ==========================
  // POST /tulisan (tambah)
  // PUT /tulisan/:id (edit)
  // ==========================
  async function submitTulisan(e) {
    e.preventDefault();

    const token = getToken();
    if (!token) {
      Swal.fire("Error", "Anda belum login.", "error");
      return;
    }

    const penulis = inputPenulis?.value.trim() || "";
    const judul = inputJudul?.value.trim() || "";
    const isi = inputIsi?.value.trim() || "";
    const tanggal = inputTanggal?.value || "";

    if (!penulis || !judul || !isi || !tanggal) {
      Swal.fire("Peringatan", "Semua kolom wajib diisi.", "warning");
      return;
    }

    const payload = { penulis, judul, isi, tanggal };

    const isEdit = !!editingId;
    const url = isEdit
      ? `${API_BASE}/tulisan/${editingId}`
      : `${API_BASE}/tulisan`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Swal.fire(
          "Gagal",
          err.message || "Gagal menyimpan tulisan.",
          "error"
        );
        return;
      }

      Swal.fire(
        "Berhasil!",
        isEdit ? "Tulisan berhasil diperbarui." : "Tulisan berhasil disimpan.",
        "success"
      );

      // reset form & mode
      formTulisan.reset();
      if (inputTanggal) {
        inputTanggal.value = new Date().toISOString().split("T")[0];
      }
      editingId = null;

      loadTulisan();
    } catch (err) {
      Swal.fire("Error", "Gagal terhubung ke server.", "error");
    }
  }

  // ==========================
  // DELETE /tulisan/:id
  // ==========================
  async function deleteTulisan(id) {
    const token = getToken();
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE}/tulisan/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Swal.fire(
          "Gagal",
          err.message || "Tidak bisa menghapus tulisan.",
          "error"
        );
        return;
      }

      Swal.fire("Dihapus!", "Tulisan berhasil dihapus.", "success");
      loadTulisan();
    } catch (err) {
      Swal.fire("Error", "Gagal menghubungi server.", "error");
    }
  }

  // ==========================
  // Event binding
  // ==========================
  if (formTulisan) {
    formTulisan.addEventListener("submit", submitTulisan);
  }

  // initial load
  loadTulisan();
});
