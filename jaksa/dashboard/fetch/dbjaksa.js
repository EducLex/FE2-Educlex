// ============================================================
// KONFIG DASAR
// ============================================================
const apiBase = "http://localhost:8080";

// ============================================================
// Fallback showAlert (pakai SweetAlert kalau ada)
// ============================================================
function showAlert(message, type = "info") {
  const iconMap = {
    success: "success",
    error: "error",
    warning: "warning",
    info: "info",
  };

  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: iconMap[type] || "info",
      title: message,
      timer: 2500,
      showConfirmButton: false,
    });
  } else {
    alert(message);
  }
}

// ============================================================
// HELPER PARSE RESPONSE (TEXT -> JSON fallback)
// ============================================================
async function parseResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { data, raw: text };
}

// ============================================================
// READY
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("role") || "").toLowerCase();

  // Cek login + role jaksa
  if (!token || (role && role !== "jaksa" && role !== "prosecutor")) {
    showAlert("Silakan login sebagai jaksa terlebih dahulu.", "warning");
    setTimeout(() => {
      window.location.href = "/auth/login.html";
    }, 1000);
    return;
  }

  // Set nama jaksa (kalau disimpan di localStorage)
  const jaksaNameEl = document.getElementById("jaksaName");
  const storedName =
    localStorage.getItem("jaksaName") ||
    localStorage.getItem("username") ||
    localStorage.getItem("name");

  if (jaksaNameEl && storedName) {
    jaksaNameEl.textContent = storedName;
  }

  // Elemen kartu statistik
  const totalBelumDijawabEl = document.getElementById("totalBelumDijawab");
  const totalTerjawabEl = document.getElementById("totalTerjawab");
  const totalTulisanJaksaEl = document.getElementById("totalTulisanJaksa");

  // Tabel tulisan jaksa
  const tulisanTableBody = document.getElementById("tulisanTableBody");

  // Elemen lama (tetap dipertahankan supaya tidak error kalau dipakai nanti)
  const formJawabanContainer = document.getElementById("formJawabanJaksa");
  const jawabanForm = document.getElementById("jawabanForm");
  const jawabanText = document.getElementById("jawabanText");
  const batalJawabBtn = document.getElementById("batalJawab");

  let pertanyaanTerpilih = null; // simpan pertanyaan yang sedang dijawab
  let tulisanCache = []; // cache tulisan, buat fallback hitung jumlah

  // ========================================================
  // UTIL: FORMAT TANGGAL
  // ========================================================
  function formatTanggalId(raw) {
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // ========================================================
  // LOAD STATISTIK DASHBOARD
  // ========================================================
  async function loadStats() {
    try {
      const res = await fetch(`${apiBase}/jaksa/dashboard/stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("📊 RAW DASHBOARD STATS:", raw);
      console.log("📊 PARSED DASHBOARD STATS:", data);

      if (!res.ok) {
        console.warn("Dashboard stats tidak OK, akan pakai fallback jika ada.");
        return;
      }

      // fleksibel dengan berbagai bentuk response
      const stats =
        data &&
        typeof data === "object" &&
        data.data &&
        typeof data.data === "object"
          ? data.data
          : data || {};

      // backend kamu kirim: { jaksa_count, questions, tulisan, unanswered_questions }
      const totalQuestions =
        stats.totalPertanyaan ??
        stats.questions ??
        stats.total_questions ??
        stats.jumlah_pertanyaan ??
        0;

      const belum =
        stats.totalBelumDijawab ??
        stats.belum_dijawab ??
        stats.unanswered_questions ??
        stats.unanswered ??
        0;

      const terjawab =
        stats.totalTerjawab ??
        stats.terjawab ??
        stats.answered ??
        (totalQuestions >= belum ? totalQuestions - belum : 0);

      const tulisan =
        stats.totalTulisanJaksa ??
        stats.tulisanJaksa ??
        stats.totalTulisan ??
        stats.tulisan ??
        0;

      if (totalBelumDijawabEl) totalBelumDijawabEl.textContent = String(belum);
      if (totalTerjawabEl) totalTerjawabEl.textContent = String(terjawab);
      if (totalTulisanJaksaEl) totalTulisanJaksaEl.textContent = String(tulisan);
    } catch (err) {
      console.error("❌ ERROR LOAD STATS:", err);
      showAlert("Gagal terhubung ke server (stats).", "error");
    }
  }

  // ========================================================
  // FALLBACK: HITUNG STATISTIK DARI /questions
  // ========================================================
  async function loadQuestionStatsFallback() {
    try {
      const res = await fetch(`${apiBase}/questions`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("💬 RAW QUESTIONS (/questions):", raw);
      console.log("💬 PARSED QUESTIONS (/questions):", data);

      if (!res.ok) {
        console.warn("GET /questions tidak OK, skip fallback stats.");
        return;
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : [];

      let answered = 0;
      let unanswered = 0;

      list.forEach((q) => {
        const statusStr = (q.status || q.statusPertanyaan || "")
          .toString()
          .toLowerCase();

        const sudahDijawab =
          q.terjawab === true ||
          statusStr === "dijawab" ||
          statusStr === "answered" ||
          !!(Array.isArray(q.jawaban) && q.jawaban.length);

        if (sudahDijawab) answered += 1;
        else unanswered += 1;
      });

      if (
        totalBelumDijawabEl &&
        (!totalBelumDijawabEl.textContent ||
          totalBelumDijawabEl.textContent === "0")
      ) {
        totalBelumDijawabEl.textContent = String(unanswered);
      }

      if (
        totalTerjawabEl &&
        (!totalTerjawabEl.textContent ||
          totalTerjawabEl.textContent === "0")
      ) {
        totalTerjawabEl.textContent = String(answered);
      }
    } catch (err) {
      console.warn("❌ ERROR LOAD QUESTIONS FALLBACK:", err);
    }
  }

  // ========================================================
  // LOAD TULISAN JAKSA (TABEL + fallback jumlah kartu)
  // ========================================================
  async function loadTulisan() {
    if (!tulisanTableBody) return;

    tulisanTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center; padding:12px;">
          Memuat data tulisan jaksa...
        </td>
      </tr>
    `;

    try {
      const res = await fetch(`${apiBase}/tulisan`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("📝 RAW TULISAN (/tulisan):", raw);
      console.log("📝 PARSED TULISAN (/tulisan):", data);

      if (!res.ok) {
        tulisanTableBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; padding:12px; color:#d32f2f;">
              Gagal memuat tulisan jaksa.
            </td>
          </tr>
        `;
        showAlert("Gagal memuat tulisan jaksa.", "error");
        return;
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.tulisan)
        ? data.tulisan
        : [];

      tulisanCache = list;

      if (!list.length) {
        tulisanTableBody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center; padding:12px;">
              Belum ada tulisan jaksa.
            </td>
          </tr>
        `;
      } else {
        tulisanTableBody.innerHTML = list
          .map((t) => {
            const judul = t.judul || t.title || t.nama || "Tanpa Judul";
            const penulis =
              t.penulis ||
              t.author ||
              t.nama_penulis ||
              t.createdBy ||
              "Jaksa";
            const createdRaw =
              t.tanggal || t.createdAt || t.created_at || t.date;
            const tanggal = formatTanggalId(createdRaw);

            return `
              <tr>
                <td>${judul}</td>
                <td>${penulis}</td>
                <td>${tanggal}</td>
              </tr>
            `;
          })
          .join("");
      }

      if (
        totalTulisanJaksaEl &&
        (!totalTulisanJaksaEl.textContent ||
          totalTulisanJaksaEl.textContent === "0")
      ) {
        totalTulisanJaksaEl.textContent = String(list.length);
      }
    } catch (err) {
      console.error("❌ ERROR LOAD TULISAN:", err);
      tulisanTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align:center; padding:12px; color:#d32f2f;">
            Tidak dapat terhubung ke server.
          </td>
        </tr>
      `;
      showAlert("Gagal terhubung ke server (tulisan).", "error");
    }
  }

  // ========================================================
  // FORM JAWABAN JAKSA (kode lama tetap disimpan)
  // ========================================================
  if (jawabanForm) {
    jawabanForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!pertanyaanTerpilih) {
        showAlert("Tidak ada pertanyaan yang dipilih.", "warning");
        return;
      }

      const jawaban = jawabanText ? jawabanText.value.trim() : "";
      if (!jawaban) {
        showAlert("Jawaban tidak boleh kosong.", "warning");
        return;
      }

      console.log("💬 (SIMULASI) KIRIM JAWABAN:", {
        pertanyaan: pertanyaanTerpilih,
        jawaban,
      });

      showAlert(
        "Fitur kirim jawaban belum dikonfigurasi endpoint-nya.",
        "info"
      );
    });
  }

  if (batalJawabBtn) {
    batalJawabBtn.addEventListener("click", () => {
      pertanyaanTerpilih = null;
      if (formJawabanContainer)
        formJawabanContainer.classList.add("hidden");
    });
  }

  // ========================================================
  // JALANKAN LOAD DATA AWAL
  // ========================================================
  loadStats();               // pakai /jaksa/dashboard/stats
  loadTulisan();             // isi tabel tulisan (judul, penulis, tanggal)
  loadQuestionStatsFallback(); // fallback statistik pertanyaan
});
