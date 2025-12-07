// /user/tanyajaksa/fetch/tanya.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";

  const modal = document.getElementById("modalTanya");
  const btnAjukan = document.getElementById("btnAjukan");
  const btnTutup = document.getElementById("tutupModal");
  const btnKirim = document.getElementById("kirimTanya");
  const listContainer = document.getElementById("daftar-pertanyaan");

  // simpan semua pertanyaan di sini supaya bisa diakses saat "Lihat Jawaban"
  let allQuestions = [];

  // Pastikan modal tertutup saat load
  if (modal) {
    modal.style.display = "none";
  }

  // ===================================
  // Helper: ambil field aman dari objek
  // ===================================
  function pickField(obj, fields, fallback = "") {
    if (!obj) return fallback;
    for (const f of fields) {
      if (obj[f] !== undefined && obj[f] !== null) {
        return String(obj[f]);
      }
    }
    return fallback;
  }

  // ===================================
  // ====== BAGIAN: AJUKAN PERTANYAAN ===
  // ===================================

  function handleAjukanClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const token = localStorage.getItem("token");
    console.log("🔎 Cek token saat klik Ajukan:", token);

    if (!token) {
      Swal.fire({
        icon: "warning",
        title: "Login dulu ya",
        text: "Kamu harus registrasi dan login terlebih dahulu untuk mengajukan pertanyaan kepada Jaksa.",
        showCancelButton: true,
        confirmButtonText: "Login / Daftar",
        cancelButtonText: "Nanti saja",
        confirmButtonColor: "#6D4C41"
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = "/auth/login.html";
        }
      });
      return;
    }

    // Sudah login → buka modal
    if (modal) modal.style.display = "flex";
  }

  if (btnAjukan) {
    btnAjukan.onclick = null; // buang handler inline lama
    btnAjukan.addEventListener("click", handleAjukanClick, true);
  }

  // Tombol "Batal"
  if (btnTutup) {
    btnTutup.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
    });
  }

  // Tutup modal kalau klik area luar
  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // Kirim pertanyaan → POST /questions
  if (btnKirim) {
    btnKirim.addEventListener("click", async () => {
      const nama = document.getElementById("namaUser")?.value.trim();
      const jenis = document.getElementById("jenis")?.value;
      const isi = document.getElementById("isiTanya")?.value.trim();

      if (!nama || !isi) {
        Swal.fire({
          icon: "warning",
          title: "Lengkapi Formulir!",
          text: "Nama dan isi pertanyaan wajib diisi.",
          confirmButtonColor: "#6D4C41"
        });
        return;
      }

      const token = localStorage.getItem("token");

      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const payload = {
        nama: nama,
        nama_penanya: nama,
        bidang: jenis,
        jenis: jenis,
        pertanyaan: isi,
        question: isi,
        isi: isi,
        content: isi
      };

      console.log("📤 Kirim pertanyaan:", payload);

      try {
        const res = await fetch(`${API_BASE}/questions`, {
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

        console.log("📥 Respon /questions:", data);

        if (!res.ok) {
          Swal.fire({
            icon: "error",
            title: "Gagal mengirim pertanyaan",
            text: data.error || data.message || "Terjadi kesalahan pada server.",
            confirmButtonColor: "#6D4C41"
          });
          return;
        }

        Swal.fire({
          icon: "success",
          title: "Terkirim!",
          text: "Pertanyaan Anda telah dikirim ke Jaksa.",
          confirmButtonColor: "#6D4C41"
        });

        if (modal) modal.style.display = "none";
        const namaInput = document.getElementById("namaUser");
        const isiInput = document.getElementById("isiTanya");
        if (namaInput) namaInput.value = "";
        if (isiInput) isiInput.value = "";

        await loadQuestions(); // refresh list
      } catch (err) {
        console.error("❌ FETCH ERROR /questions:", err);
        Swal.fire({
          icon: "error",
          title: "Gagal mengirim pertanyaan",
          text: "Tidak dapat terhubung ke server.",
          confirmButtonColor: "#6D4C41"
        });
      }
    });
  }

  // ===================================
  // ====== BAGIAN: LIST & JAWABAN =====
  // ===================================

  function renderQuestions(questions) {
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (!Array.isArray(questions) || questions.length === 0) {
      listContainer.innerHTML = `
        <p style="text-align:center; color:#777; font-weight:600;">
          Belum ada pertanyaan yang ditampilkan.
        </p>
      `;
      return;
    }

    questions.forEach((q) => {
      const id = q._id || q.id || q.question_id || "";
      const nama = pickField(q, ["nama", "nama_penanya", "name", "username"], "Pengguna");
      const bidang = pickField(q, ["bidang", "jenis", "kategori"], "-");
      const pertanyaan = pickField(
        q,
        ["pertanyaan", "question", "isi", "content", "deskripsi"],
        "(Teks pertanyaan tidak tersedia)"
      );

      const card = document.createElement("div");
      card.className = "card-pertanyaan";
      card.style.background = "#ffffff";
      card.style.borderRadius = "18px";
      card.style.padding = "20px 24px";
      card.style.marginBottom = "18px";
      card.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
      card.style.border = "1px solid #f0dfd4";

      card.innerHTML = `
        <h3 style="
          margin-top:0;
          margin-bottom:8px;
          color:#4e342e;
          font-family:'Poppins', sans-serif;
          font-size:1.1rem;
        ">
          ${pertanyaan.length > 80 ? pertanyaan.slice(0, 77) + "..." : pertanyaan}
        </h3>

        <p style="
          margin:0 0 8px;
          font-size:0.9rem;
          color:#6d4c41;
          font-family:'Poppins', sans-serif;
        ">
          <strong>Penanya:</strong> ${nama}
          &nbsp; | &nbsp;
          <strong>Bidang:</strong> ${bidang}
        </p>

        <p style="
          margin:0 0 10px;
          font-size:0.95rem;
          color:#424242;
          line-height:1.5;
          font-family:'Open Sans', sans-serif;
        ">
          ${pertanyaan}
        </p>

        <button
          class="btn-lihat-jawaban"
          data-id="${id}"
          style="
            margin-top:6px;
            padding:8px 16px;
            border-radius:6px;
            border:none;
            background:#6d4c41;
            color:#fff;
            cursor:pointer;
            font-size:0.9rem;
            font-family:'Poppins', sans-serif;
            font-weight:600;
            box-shadow:0 2px 4px rgba(0,0,0,0.12);
            transition:background 0.2s, transform 0.1s;
          "
          onmouseover="this.style.background='#5d3a33'; this.style.transform='translateY(-1px)';"
          onmouseout="this.style.background='#6d4c41'; this.style.transform='translateY(0)';"
        >
          Lihat Jawaban
        </button>

        <div id="jawaban-${id}" class="jawaban-container" style="margin-top:10px; display:none;"></div>
      `;

      listContainer.appendChild(card);
    });
  }

  // Ambil jawaban dari data allQuestions (tanpa fetch baru)
  function showJawaban(questionId) {
    const container = document.getElementById(`jawaban-${questionId}`);
    if (!container) return;

    // toggle: kalau sudah kelihatan, sembunyikan lagi
    if (container.style.display === "block") {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";
    container.innerHTML = `<p style="color:#777; font-size:0.9rem;">Memuat jawaban...</p>`;

    const q = allQuestions.find(
      (item) =>
        item._id === questionId ||
        item.id === questionId ||
        item.question_id === questionId
    );

    if (!q) {
      container.innerHTML = `
        <p style="color:#d32f2f; font-size:0.9rem;">
          Data pertanyaan tidak ditemukan.
        </p>
      `;
      return;
    }

    let jawabanText = "";

    // 1. Cek array diskusi (paling umum)
    if (Array.isArray(q.diskusi) && q.diskusi.length > 0) {
      let fromJaksa = q.diskusi.filter(
        (d) =>
          (d.pengirim && String(d.pengirim).toLowerCase() === "jaksa") ||
          (d.role && String(d.role).toLowerCase() === "jaksa")
      );

      const chosen =
        fromJaksa.length > 0
          ? fromJaksa[fromJaksa.length - 1]
          : q.diskusi[q.diskusi.length - 1];

      jawabanText = pickField(
        chosen,
        ["jawaban", "answer", "isi", "pesan", "content", "respon", "balasan"],
        ""
      );
    }

    // 2. Kalau tidak ada di diskusi, cek field langsung di question
    if (!jawabanText) {
      jawabanText = pickField(
        q,
        ["jawaban", "jawaban_jaksa", "answer", "respon"],
        ""
      );
    }

    container.innerHTML = `
      <div style="
        background:#f9f3ef;
        border-radius:10px;
        padding:10px 14px;
        border-left:4px solid #6d4c41;
        font-size:0.95rem;
        color:#424242;
        font-family:'Open Sans', sans-serif;
        margin-top:6px;
      ">
        <strong>Jawaban Jaksa:</strong><br/>
        ${jawabanText || "Jawaban belum tersedia."}
      </div>
    `;
  }

  // Ambil list pertanyaan dari backend
  async function loadQuestions() {
    if (!listContainer) return;

    listContainer.innerHTML = `
      <p style="text-align:center; color:#777; font-weight:600;">
        ⏳ Memuat data pertanyaan...
      </p>
    `;

    try {
      const res = await fetch(`${API_BASE}/questions`);
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = [];
      }

      if (!Array.isArray(data)) {
        console.warn("Respon /questions bukan array:", data);
        allQuestions = [];
      } else {
        allQuestions = data;
      }

      renderQuestions(allQuestions);
    } catch (err) {
      console.error("❌ FETCH ERROR /questions:", err);
      listContainer.innerHTML = `
        <p style="text-align:center; color:#d32f2f; font-weight:600;">
          Gagal memuat data pertanyaan. Silakan coba beberapa saat lagi.
        </p>
      `;
    }
  }

  // Delegasi klik untuk "Lihat Jawaban"
  if (listContainer) {
    listContainer.addEventListener("click", (e) => {
      const target = e.target;
      if (target && target.classList.contains("btn-lihat-jawaban")) {
        const id = target.getAttribute("data-id");
        if (id) {
          showJawaban(id);
        }
      }
    });
  }

  // ===================================
  // Initial load
  // ===================================
  loadQuestions();
});
