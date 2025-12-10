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

  // Elemen DOM yang dipakai
  const totalBelumDijawabEl = document.getElementById("totalBelumDijawab");
  const totalTerjawabEl = document.getElementById("totalTerjawab");
  const totalTulisanJaksaEl = document.getElementById("totalTulisanJaksa");

  const tanyaTableBody = document.getElementById("tanyaTableBody");
  const tulisanTableBody = document.getElementById("tulisanTableBody");

  const formJawabanContainer = document.getElementById("formJawabanJaksa");
  const jawabanForm = document.getElementById("jawabanForm");
  const jawabanText = document.getElementById("jawabanText");
  const batalJawabBtn = document.getElementById("batalJawab");

  let pertanyaanTerpilih = null; // simpan pertanyaan yang sedang dijawab

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
        showAlert("Gagal memuat statistik dashboard.", "error");
        return;
      }

      // fleksibel dengan berbagai bentuk response
      const stats =
        data && typeof data === "object" && data.data && typeof data.data === "object"
          ? data.data
          : data;

      const belum =
        stats.totalBelumDijawab ??
        stats.belum_dijawab ??
        stats.unanswered ??
        0;

      const terjawab =
        stats.totalTerjawab ??
        stats.terjawab ??
        stats.answered ??
        0;

      const tulisan =
        stats.totalTulisanJaksa ??
        stats.tulisanJaksa ??
        stats.totalTulisan ??
        0;

      if (totalBelumDijawabEl) totalBelumDijawabEl.textContent = belum;
      if (totalTerjawabEl) totalTerjawabEl.textContent = terjawab;
      if (totalTulisanJaksaEl) totalTulisanJaksaEl.textContent = tulisan;
    } catch (err) {
      console.error("❌ ERROR LOAD STATS:", err);
      showAlert("Gagal terhubung ke server (stats).", "error");
    }
  }

  // ========================================================
  // LOAD PERTANYAAN BELUM DIJAWAB
  // ========================================================
  async function loadPertanyaan() {
    try {
      const res = await fetch(`${apiBase}/jaksa/pertanyaan`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const { data, raw } = await parseResponse(res);
      console.log("💬 RAW PERTANYAAN:", raw);
      console.log("💬 PARSED PERTANYAAN:", data);

      if (!res.ok) {
        showAlert("Gagal memuat daftar pertanyaan.", "error");
        return;
      }

      // support bentuk: [ ... ] atau { data: [ ... ] }
      const list =
        Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

      if (!Array.isArray(list)) {
        console.warn("Format data pertanyaan tidak dikenal:", data);
        return;
      }

      if (tanyaTableBody) tanyaTableBody.innerHTML = "";

      list.forEach((p) => {
        const tr = document.createElement("tr");

        const nama =
          p.nama ||
          p.namaPenanya ||
          p.nama_penanya ||
          p.userName ||
          p.username ||
          "-";

        const kategori =
          p.kategori ||
          p.kategoriPertanyaan ||
          p.category ||
          "-";

        const pertanyaanText =
          p.pertanyaan ||
          p.isiPertanyaan ||
          p.question ||
          "-";

        const statusRaw =
          p.status ||
          p.statusPertanyaan ||
          (p.terjawab ? "TERJAWAB" : "BELUM DIJAWAB");

        const statusLabel =
          (statusRaw || "").toString().toUpperCase().includes("JAWAB")
            ? statusRaw
            : p.terjawab
            ? "TERJAWAB"
            : "BELUM DIJAWAB";

        tr.innerHTML = `
          <td>${nama}</td>
          <td>${kategori}</td>
          <td>${pertanyaanText}</td>
          <td>${statusLabel}</td>
          <td></td>
        `;

        // tombol aksi
        const aksiTd = tr.lastElementChild;
        if (aksiTd) {
          const btnJawab = document.createElement("button");
          btnJawab.className = "btn-aksi-jawab";
          btnJawab.innerHTML = `<i class="fas fa-reply"></i> Jawab`;

          btnJawab.addEventListener("click", () => {
            pertanyaanTerpilih = p;
            if (formJawabanContainer) formJawabanContainer.classList.remove("hidden");
            if (jawabanText) jawabanText.value = "";
            window.scrollTo({ top: formJawabanContainer.offsetTop - 80, behavior: "smooth" });
          });

          aksiTd.appendChild(btnJawab);
        }

        tanyaTableBody && tanyaTableBody.appendChild(tr);
      });

      // kalau stats belum diisi, pakai panjang list sebagai fallback
      if (totalBelumDijawabEl && totalBelumDijawabEl.textContent === "0") {
        totalBelumDijawabEl.textContent = list.length.toString();
      }
    } catch (err) {
      console.error("❌ ERROR LOAD PERTANYAAN:", err);
      showAlert("Gagal terhubung ke server (pertanyaan).", "error");
    }
  }

  // ========================================================
  // FORM JAWABAN JAKSA (HANYA FRONTEND – BELUM POST KE BE)
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

      // NOTE:
      // Di sini HARUSNYA ada fetch ke endpoint jawaban,
      // misalnya: POST /jaksa/pertanyaan/{id}/jawab
      // Karena endpoint-nya belum kamu kasih, sementara ini
      // kita cuma tampilkan notifikasi & log ke console.

      console.log("💬 (SIMULASI) KIRIM JAWABAN:", {
        pertanyaan: pertanyaanTerpilih,
        jawaban,
      });

      showAlert("Fitur kirim jawaban belum dikonfigurasi endpoint-nya.", "info");

      // kalau nanti endpoint sudah ada, tinggal ganti bagian di atas
      // dengan fetch POST dan setelah sukses:
      //  - hide form
      //  - reload loadPertanyaan()

      // Contoh rough:
      // const res = await fetch(`${apiBase}/jaksa/pertanyaan/${pertanyaanTerpilih.id}/jawab`, { ... })

    });
  }

  if (batalJawabBtn) {
    batalJawabBtn.addEventListener("click", () => {
      pertanyaanTerpilih = null;
      if (formJawabanContainer) formJawabanContainer.classList.add("hidden");
    });
  }

  // ========================================================
  // (OPSIONAL) TULISAN JAKSA – TABLE BIAR GAK ERROR
  // ========================================================
  if (tulisanTableBody) {
    // sementara kosong dulu, nanti kalau endpoint list tulisan sudah ada
    // tinggal tambahin fungsi loadTulisan() mirip loadPertanyaan()
    tulisanTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;">Belum ada data tulisan jaksa.</td>
      </tr>
    `;
  }

  // ========================================================
  // JALANKAN LOAD DATA AWAL
  // ========================================================
  loadStats();
  loadPertanyaan();
});
