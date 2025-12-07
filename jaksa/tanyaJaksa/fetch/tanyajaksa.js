// /jaksa/tanyaJaksa/fetch/tanyajaksa.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const tbody = document.getElementById("tabelPertanyaanBody");
  const filterStatus = document.getElementById("filterStatus");
  const searchInput = document.getElementById("searchPertanyaan");
  const modalJawaban = document.getElementById("modalJawaban");
  const btnTutupJawaban = document.getElementById("btnTutupJawaban");
  const btnKirimJawaban = document.getElementById("btnKirimJawaban");
  const modalNama = document.getElementById("modalNama");
  const modalPertanyaan = document.getElementById("modalPertanyaan");
  const modalKategori = document.getElementById("modalKategori");
  const jawabanText = document.getElementById("jawabanText");

  let currentQuestionId = null;
  let allQuestions = [];
  let currentMode = "jawab"; // "jawab" | "edit"

  // ====================================
  // Helper ambil field yang mungkin beda
  // ====================================
  function pickField(obj, keys, fallback = "") {
    if (!obj) return fallback;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        return String(obj[k]);
      }
    }
    return fallback;
  }

  // ====================================
  // Status sudah dijawab / belum
  // ====================================
  function isAnswered(q) {
    return !!(
      q.jawaban ||
      q.answer ||
      q.dijawab ||
      q.sudah_dijawab ||
      (Array.isArray(q.diskusi) && q.diskusi.length > 0) ||
      q.status === "answered" ||
      q.status === "sudah"
    );
  }

  // ====================================
  // Ambil jawaban terakhir dari Jaksa
  // (untuk mode EDIT)
  // ====================================
  async function getLastJaksaAnswer(questionId) {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE}/questions/${questionId}/diskusi`, {
        headers
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }

      let lastAnswer = "";

      if (Array.isArray(data) && data.length > 0) {
        // Cari diskusi dengan pengirim = Jaksa (case-insensitive)
        const jaksaMessages = data.filter((d) => {
          const sender = pickField(d, ["pengirim", "sender", "role"], "").toLowerCase();
          return sender === "jaksa";
        });

        const target = jaksaMessages.length
          ? jaksaMessages[jaksaMessages.length - 1]
          : data[data.length - 1];

        lastAnswer = pickField(
          target,
          ["pesan", "message", "isi", "content", "jawaban", "answer"],
          ""
        );
      } else if (data && typeof data === "object") {
        lastAnswer = pickField(
          data,
          ["pesan", "message", "isi", "content", "jawaban", "answer"],
          ""
        );
      } else if (typeof data === "string") {
        lastAnswer = data;
      }

      return lastAnswer;
    } catch (err) {
      console.error("❌ FETCH ERROR getLastJaksaAnswer:", err);
      return "";
    }
  }

  // ====================================
  // Buka modal Jawab / Edit
  // ====================================
  async function openJawabanModal({ id, nama, isi, kategori, mode }) {
    currentQuestionId = id;
    currentMode = mode || "jawab";

    if (modalNama) modalNama.textContent = nama || "Anonim";
    if (modalPertanyaan) modalPertanyaan.textContent = isi || "-";
    if (modalKategori) modalKategori.textContent = kategori || "-";

    if (jawabanText) {
      jawabanText.value = "";
    }

    // Kalau EDIT → isi textarea dengan jawaban Jaksa terakhir
    if (currentMode === "edit" && jawabanText) {
      jawabanText.placeholder = "Memuat jawaban sebelumnya...";
      const previous = await getLastJaksaAnswer(id);
      jawabanText.value = previous || "";
      jawabanText.placeholder = "Ketik jawaban resmi sebagai Jaksa...";
    } else if (jawabanText) {
      jawabanText.placeholder = "Ketik jawaban resmi sebagai Jaksa...";
    }

    if (modalJawaban) {
      modalJawaban.style.display = "flex";
    }
  }

  // ====================================
  // Render tabel berdasarkan allQuestions
  // + filter & search
  // ====================================
  function renderTable() {
    if (!tbody) return;

    const status = filterStatus ? filterStatus.value : "semua";
    const keyword = (searchInput?.value || "").trim().toLowerCase();

    const filtered = allQuestions.filter((q) => {
      const answered = isAnswered(q);

      const matchStatus =
        status === "semua" ||
        (status === "belum" && !answered) ||
        (status === "sudah" && answered);

      const nama = pickField(q, ["nama", "nama_penanya", "name", "username"]).toLowerCase();
      const isi = pickField(q, ["isi", "pertanyaan", "question", "content", "deskripsi"]).toLowerCase();
      const kategori = pickField(q, ["kategori", "bidang", "jenis"]).toLowerCase();

      const matchSearch =
        !keyword ||
        nama.includes(keyword) ||
        isi.includes(keyword) ||
        kategori.includes(keyword);

      return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #6d4c41;">
            Tidak ada data.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map((q) => {
        const id = q._id || q.id || q.question_id || "";

        const nama = pickField(q, ["nama", "nama_penanya", "name", "username"], "Anonim");
        const isi = pickField(q, ["isi", "pertanyaan", "question", "content", "deskripsi"], "-");
        const kategori = pickField(q, ["kategori", "bidang", "jenis"], "-");
        const tanggalRaw = pickField(q, ["tanggal", "created_at", "createdAt"], "");
        const tanggal = tanggalRaw
          ? new Date(tanggalRaw).toLocaleDateString("id-ID")
          : "-";

        const answered = isAnswered(q);
        const statusBadge = answered
          ? '<span class="badge answered">Dijawab</span>'
          : '<span class="badge pending">Belum Dijawab</span>';

        // Aksi: Jawab, Edit, Hapus (Edit disabled kalau belum ada jawaban)
        const safeNama = nama.replace(/"/g, "&quot;");
        const safeIsi = isi.replace(/"/g, "&quot;");
        const safeKategori = kategori.replace(/"/g, "&quot;");

        const editButtonHtml = answered
          ? `
            <button
              class="btn-edit action-btn"
              data-id="${id}"
              data-nama="${safeNama}"
              data-isi="${safeIsi}"
              data-kategori="${safeKategori}"
            >
              <i class="fas fa-pen"></i> Edit
            </button>
          `
          : `
            <button
              class="btn-edit action-btn"
              data-id="${id}"
              data-nama="${safeNama}"
              data-isi="${safeIsi}"
              data-kategori="${safeKategori}"
              disabled
              title="Belum ada jawaban untuk diedit"
            >
              <i class="fas fa-pen"></i> Edit
            </button>
          `;

        return `
          <tr>
            <td>${nama}</td>
            <td>${isi}</td>
            <td>${kategori}</td>
            <td>${tanggal}</td>
            <td>${statusBadge}</td>
            <td>
              <button
                class="btn-jawab action-btn"
                data-id="${id}"
                data-nama="${safeNama}"
                data-isi="${safeIsi}"
                data-kategori="${safeKategori}"
              >
                <i class="fas fa-reply"></i> Jawab
              </button>
              ${editButtonHtml}
              <button
                class="btn-delete action-btn"
                data-id="${id}"
              >
                <i class="fas fa-trash"></i> Hapus
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Pasang event untuk tombol "Jawab"
    document.querySelectorAll(".btn-jawab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const nama = btn.getAttribute("data-nama") || "Anonim";
        const isi = btn.getAttribute("data-isi") || "-";
        const kategori = btn.getAttribute("data-kategori") || "-";

        openJawabanModal({ id, nama, isi, kategori, mode: "jawab" });
      });
    });

    // Pasang event untuk tombol "Edit"
    document.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const id = btn.getAttribute("data-id");
        const nama = btn.getAttribute("data-nama") || "Anonim";
        const isi = btn.getAttribute("data-isi") || "-";
        const kategori = btn.getAttribute("data-kategori") || "-";

        openJawabanModal({ id, nama, isi, kategori, mode: "edit" });
      });
    });

    // Pasang event untuk tombol "Hapus"
    document.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;

        Swal.fire({
          title: "Hapus pertanyaan ini?",
          text: "Tindakan ini tidak dapat dibatalkan.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#6D4C41",
          confirmButtonText: "Ya, hapus",
          cancelButtonText: "Batal"
        }).then((result) => {
          if (result.isConfirmed) {
            deleteQuestion(id);
          }
        });
      });
    });
  }

  // ====================================
  // GET /questions → loadPertanyaan
  // ====================================
  async function loadPertanyaan() {
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #6d4c41;">
          Memuat data...
        </td>
      </tr>
    `;

    const token = localStorage.getItem("token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE}/questions`, { headers });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!res.ok) {
        console.error("❌ Error GET /questions:", data);
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; color:#f44336;">
              Gagal memuat data pertanyaan.
            </td>
          </tr>
        `;
        return;
      }

      if (!Array.isArray(data)) {
        console.warn("Respon /questions bukan array:", data);
        allQuestions = [];
      } else {
        allQuestions = data;
      }

      renderTable();
    } catch (err) {
      console.error("❌ FETCH ERROR /questions:", err);
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:#f44336;">
            Gagal terhubung ke server.
          </td>
        </tr>
      `;
    }
  }

  // ====================================
  // DELETE /questions/:id
  // ====================================
  async function deleteQuestion(id) {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE}/questions/${id}`, {
        method: "DELETE",
        headers
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }

      if (!res.ok) {
        console.error("❌ Error DELETE /questions/:id:", data);
        Swal.fire("Gagal", data.error || data.message || "Tidak dapat menghapus pertanyaan.", "error");
        return;
      }

      Swal.fire("Terhapus!", "Pertanyaan berhasil dihapus.", "success");
      loadPertanyaan();
    } catch (err) {
      console.error("❌ FETCH ERROR DELETE /questions/:id:", err);
      Swal.fire("Error", "Gagal terhubung ke server.", "error");
    }
  }

  // ====================================
  // POST /questions/:id/diskusi → kirim jawaban
  // (dipakai untuk Jawab & Edit)
  // ====================================
  async function kirimJawaban() {
    const pesan = jawabanText?.value.trim();
    if (!currentQuestionId) {
      Swal.fire("Error", "Tidak ada pertanyaan yang dipilih.", "error");
      return;
    }
    if (!pesan) {
      Swal.fire("Peringatan", "Jawaban tidak boleh kosong.", "warning");
      return;
    }

    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const payload = {
      pengirim: "Jaksa",
      pesan: pesan
    };

    try {
      const res = await fetch(`${API_BASE}/questions/${currentQuestionId}/diskusi`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }

      if (!res.ok) {
        console.error("❌ Error POST /questions/:id/diskusi:", data);
        Swal.fire("Gagal", data.error || data.message || "Gagal mengirim jawaban.", "error");
        return;
      }

      const successMsg =
        currentMode === "edit"
          ? "Jawaban telah diperbarui."
          : "Jawaban telah dikirim.";

      Swal.fire("Berhasil!", successMsg, "success");
      if (modalJawaban) modalJawaban.style.display = "none";
      currentQuestionId = null;
      currentMode = "jawab";
      loadPertanyaan();
    } catch (err) {
      console.error("❌ FETCH ERROR /questions/:id/diskusi:", err);
      Swal.fire("Error", "Koneksi ke server gagal.", "error");
    }
  }

  // ====================================
  // Event listeners
  // ====================================
  if (filterStatus) {
    filterStatus.addEventListener("change", renderTable);
  }
  if (searchInput) {
    searchInput.addEventListener("input", renderTable);
  }

  if (btnTutupJawaban) {
    btnTutupJawaban.addEventListener("click", () => {
      if (modalJawaban) modalJawaban.style.display = "none";
      currentQuestionId = null;
      currentMode = "jawab";
    });
  }

  if (btnKirimJawaban) {
    btnKirimJawaban.addEventListener("click", kirimJawaban);
  }

  // tutup modal kalau klik area gelap di luar konten
  if (modalJawaban) {
    modalJawaban.addEventListener("click", (e) => {
      if (e.target === modalJawaban) {
        modalJawaban.style.display = "none";
        currentQuestionId = null;
        currentMode = "jawab";
      }
    });
  }

  // ====================================
  // Initial load
  // ====================================
  loadPertanyaan();
});
