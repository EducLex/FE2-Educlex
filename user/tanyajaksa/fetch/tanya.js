// /user/tanyajaksa/fetch/tanya.js

(() => {
  const API_BASE = "http://localhost:8080";
  console.log("✅ [tanya.js] loaded", new Date().toLocaleString());

  function $(id) {
    return document.getElementById(id);
  }

  // =========================
  // Token helpers
  // =========================
  function getToken() {
    const t = localStorage.getItem("token");
    if (!t) return null;
    const s = String(t).trim();
    if (!s || s === "null" || s === "undefined") return null;
    return s;
  }

  function decodeJwtPayload(token) {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function isTokenExpired(token) {
    const payload = decodeJwtPayload(token);
    if (!payload || !payload.exp) return false;
    return Date.now() >= Number(payload.exp) * 1000;
  }

  function hasValidLogin() {
    const token = getToken();
    if (!token) return false;
    if (isTokenExpired(token)) return false;
    return true;
  }

  function rememberReturnUrl(openModal = false) {
    try {
      sessionStorage.setItem("redirectAfterLogin", location.pathname + location.search);
      if (openModal) sessionStorage.setItem("openAjukanAfterLogin", "1");
    } catch {}
  }

  function redirectToLogin(openModal = false) {
    rememberReturnUrl(openModal);
    const redirect = encodeURIComponent(location.pathname + location.search);
    const open = openModal ? "ajukan" : "";
    location.href = `/auth/login.html?redirect=${redirect}&open=${open}`;
  }

  // =========================
  // fetch with timeout (anti-stuck)
  // =========================
  async function fetchWithTimeout(url, options = {}, ms = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  // =========================
  // Helpers umum
  // =========================
  function pickField(obj, keys, fallback = "") {
    if (!obj) return fallback;
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return String(obj[k]);
    }
    return fallback;
  }

  document.addEventListener("DOMContentLoaded", () => {
    // ================
    // DOM elements
    // ================
    const modal = $("modalTanya");
    const btnAjukan = $("btnAjukan");
    const btnTutup = $("tutupModal");
    const btnKirim = $("kirimTanya");
    const listContainer = $("daftar-pertanyaan");

    const selectJenis = $("jenisPeraturan");     // dropdown jenis (Internal/Eksternal)
    const selectKategori = $("bidangKategori");  // dropdown kategori/subkategori

    const inputNama = $("namaUser");
    const inputIsi = $("isiTanya");

    // guard basic
    if (!listContainer) {
      console.error("❌ [tanya.js] Element #daftar-pertanyaan tidak ditemukan. Cek id HTML.");
      return;
    }

    let allQuestions = [];
    let allCategories = [];

    if (modal) modal.style.display = "none";

    // ==========================
    // 1) LOGIN GUARD: hanya Ajukan & Kirim yang wajib login
    // ==========================
    // Capture listener supaya ngalahin event lain yang mungkin masih kepasang
    document.addEventListener(
      "click",
      (e) => {
        const hit = e.target?.closest?.("#btnAjukan");
        if (!hit) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (!hasValidLogin()) {
          if (modal) modal.style.display = "none";
          redirectToLogin(true);
          return;
        }

        if (modal) modal.style.display = "flex";
      },
      true
    );

    // bersihin kemungkinan onclick lama
    if (btnAjukan) {
      btnAjukan.onclick = null;
      btnAjukan.removeAttribute("onclick");
    }

    // tutup modal
    if (btnTutup) {
      btnTutup.addEventListener("click", () => {
        if (modal) modal.style.display = "none";
      });
    }
    window.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });

    // auto open modal setelah login kalau diminta
    try {
      const shouldOpen = sessionStorage.getItem("openAjukanAfterLogin") === "1";
      if (shouldOpen && hasValidLogin()) {
        sessionStorage.removeItem("openAjukanAfterLogin");
        if (modal) modal.style.display = "flex";
      }
    } catch {}

    // ==========================
    // 2) CATEGORIES: GET /categories
    // Backend kamu:
    // - name: "internal"/"eksternal"
    // - subkategori: label dropdown
    // ==========================
    function setKategoriPlaceholder(text) {
      if (!selectKategori) return;
      selectKategori.innerHTML = `<option value="">${text}</option>`;
      selectKategori.disabled = true;
    }

    function catId(cat) {
      return cat?._id || cat?.id || "";
    }

    function catJenisNormalized(cat) {
      const raw = String(cat?.name || "").toLowerCase().trim();
      if (raw === "internal") return "internal";
      if (raw === "eksternal" || raw === "external") return "eksternal";
      return "";
    }

    function catLabel(cat) {
      return String(cat?.subkategori || "Tanpa Nama");
    }

    function renderKategoriByJenis(jenisUi) {
      if (!selectKategori) return;

      const jenis = String(jenisUi || "").toLowerCase().trim();
      if (!jenis) {
        setKategoriPlaceholder("Pilih jenis dulu");
        return;
      }

      const filtered = allCategories.filter((c) => catJenisNormalized(c) === jenis);

      if (!filtered.length) {
        setKategoriPlaceholder(`Tidak ada kategori untuk ${jenisUi}`);
        return;
      }

      // remove duplicates (kalau backend ada duplikat)
      const uniq = [];
      const seen = new Set();
      for (const c of filtered) {
        const label = catLabel(c);
        if (!seen.has(label)) {
          seen.add(label);
          uniq.push(c);
        }
      }

      const options = uniq
        .map((c) => {
          const id = catId(c);
          if (!id) return "";
          return `<option value="${id}">${catLabel(c)}</option>`;
        })
        .filter(Boolean)
        .join("");

      selectKategori.innerHTML = `
        <option value="">-- Pilih kategori / subkategori --</option>
        ${options}
      `;
      selectKategori.disabled = false;
    }

    async function loadCategories() {
      if (!selectJenis || !selectKategori) return;

      setKategoriPlaceholder("Memuat kategori...");

      try {
        const res = await fetchWithTimeout(`${API_BASE}/categories`, {}, 12000);
        const raw = await res.text();

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = [];
        }

        const cats = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.categories)
          ? data.categories
          : [];

        if (!res.ok) {
          console.error("❌ GET /categories error:", data);
          setKategoriPlaceholder("Gagal memuat kategori");
          return;
        }

        allCategories = cats;

        // default render sesuai dropdown jenis
        renderKategoriByJenis(selectJenis.value || "Internal");
      } catch (err) {
        console.error("❌ FETCH /categories error:", err);
        setKategoriPlaceholder("Gagal memuat kategori");
      }
    }

    if (selectJenis) {
      selectJenis.addEventListener("change", () => {
        renderKategoriByJenis(selectJenis.value);
      });
    }

    // ==========================
    // 3) QUESTIONS LIST: GET /questions
    // ==========================
    function renderQuestions(questions) {
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
        const bidang = pickField(q, ["bidang_nama", "kategori", "bidang", "jenis"], "-");
        const pertanyaan = pickField(q, ["pertanyaan", "question", "isi", "content"], "(Tidak ada teks)");

        const card = document.createElement("div");
        card.className = "card-pertanyaan";
        card.style.background = "#ffffff";
        card.style.borderRadius = "18px";
        card.style.padding = "20px 24px";
        card.style.marginBottom = "18px";
        card.style.boxShadow = "0 2px 6px rgba(0,0,0,0.06)";
        card.style.border = "1px solid #f0dfd4";

        card.innerHTML = `
          <h3 style="margin:0 0 8px;color:#4e342e;font-family:'Poppins', sans-serif;font-size:1.1rem;">
            ${pertanyaan.length > 80 ? pertanyaan.slice(0, 77) + "..." : pertanyaan}
          </h3>

          <p style="margin:0 0 8px;font-size:0.9rem;color:#6d4c41;font-family:'Poppins', sans-serif;">
            <strong>Penanya:</strong> ${nama}
            &nbsp; | &nbsp;
            <strong>Bidang:</strong> ${bidang}
          </p>

          <p style="margin:0 0 10px;font-size:0.95rem;color:#424242;line-height:1.5;font-family:'Open Sans', sans-serif;">
            ${pertanyaan}
          </p>

          <button class="btn-lihat-jawaban" data-id="${id}"
            style="margin-top:6px;padding:8px 16px;border-radius:6px;border:none;background:#6d4c41;color:#fff;cursor:pointer;font-size:0.9rem;font-family:'Poppins', sans-serif;font-weight:600;box-shadow:0 2px 4px rgba(0,0,0,0.12);"
          >
            Lihat Jawaban
          </button>

          <div id="jawaban-${id}" style="margin-top:10px; display:none;"></div>
        `;

        listContainer.appendChild(card);
      });
    }

    async function loadQuestions() {
      listContainer.innerHTML = `
        <p style="text-align:center; color:#777; font-weight:600;">
          ⏳ Memuat data pertanyaan...
        </p>
      `;

      try {
        const res = await fetchWithTimeout(`${API_BASE}/questions`, {}, 12000);
        const raw = await res.text();

        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = [];
        }

        const questions = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.questions)
          ? data.questions
          : [];

        if (!res.ok) {
          console.error("❌ GET /questions error:", data);
          listContainer.innerHTML = `
            <p style="text-align:center; color:#d32f2f; font-weight:700;">
              Gagal memuat pertanyaan (${res.status}).
            </p>
            <div style="text-align:center; margin-top:10px;">
              <button id="retryQuestions" style="padding:10px 16px;border:none;border-radius:8px;background:#6d4c41;color:#fff;cursor:pointer;">
                Coba lagi
              </button>
            </div>
          `;
          $("retryQuestions")?.addEventListener("click", loadQuestions);
          return;
        }

        allQuestions = questions;
        renderQuestions(allQuestions);
      } catch (err) {
        console.error("❌ FETCH /questions error:", err);
        listContainer.innerHTML = `
          <p style="text-align:center; color:#d32f2f; font-weight:700;">
            Gagal memuat data (timeout / server mati / CORS).
          </p>
          <div style="text-align:center; margin-top:10px;">
            <button id="retryQuestions" style="padding:10px 16px;border:none;border-radius:8px;background:#6d4c41;color:#fff;cursor:pointer;">
              Coba lagi
            </button>
          </div>
        `;
        $("retryQuestions")?.addEventListener("click", loadQuestions);
      }
    }

    // ==========================
    // 4) LIHAT JAWABAN
    // ==========================
    function getAnswerFromQuestion(q) {
      // diskusi -> ambil jawaban terakhir dari Jaksa
      if (Array.isArray(q.diskusi) && q.diskusi.length > 0) {
        const fromJaksa = q.diskusi.filter((d) => {
          const pengirim = String(d.pengirim || "").toLowerCase();
          const role = String(d.role || "").toLowerCase();
          return pengirim === "jaksa" || role === "jaksa";
        });

        const chosen = fromJaksa.length
          ? fromJaksa[fromJaksa.length - 1]
          : q.diskusi[q.diskusi.length - 1];

        return pickField(
          chosen,
          ["jawaban", "answer", "isi", "pesan", "content", "balasan", "respon"],
          ""
        );
      }

      // fallback field langsung
      return pickField(q, ["jawaban", "jawaban_jaksa", "answer", "respon", "reply"], "");
    }

    function showJawaban(questionId) {
      const container = document.getElementById(`jawaban-${questionId}`);
      if (!container) return;

      // toggle
      if (container.style.display === "block") {
        container.style.display = "none";
        return;
      }

      container.style.display = "block";
      container.innerHTML = `<p style="color:#777; font-size:0.9rem;">Memuat jawaban...</p>`;

      const q = allQuestions.find(
        (item) =>
          String(item._id || item.id || item.question_id || "") === String(questionId)
      );

      if (!q) {
        container.innerHTML = `<p style="color:#d32f2f; font-size:0.9rem;">Data pertanyaan tidak ditemukan.</p>`;
        return;
      }

      const jawabanText = getAnswerFromQuestion(q);

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
          ${jawabanText ? jawabanText : "Jawaban belum tersedia."}
        </div>
      `;
    }

    // Delegation listener untuk semua tombol yang dibuat dinamis
    listContainer.addEventListener("click", (e) => {
      const btn = e.target?.closest?.(".btn-lihat-jawaban");
      if (!btn) return;

      e.preventDefault();
      const id = btn.getAttribute("data-id");
      if (!id) return;

      showJawaban(id);
    });

    // ==========================
    // 5) KIRIM PERTANYAAN: POST /questions
    // ==========================
    if (btnKirim) {
      btnKirim.addEventListener("click", async () => {
        if (!hasValidLogin()) {
          redirectToLogin(true);
          return;
        }

        const nama = inputNama?.value?.trim() || "";
        const isi = inputIsi?.value?.trim() || "";

        const jenis = selectJenis?.value || "";
        const kategoriId = selectKategori?.value || "";
        const kategoriNama = selectKategori?.options?.[selectKategori.selectedIndex]?.text || "";

        if (!nama || !isi || !jenis || !kategoriId) {
          Swal.fire({
            icon: "warning",
            title: "Lengkapi dulu ya",
            text: "Nama, Jenis, Kategori, dan Pertanyaan wajib diisi.",
            confirmButtonColor: "#6D4C41",
          });
          return;
        }

        const token = getToken();
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const payload = {
          nama,
          nama_penanya: nama,
          jenis,

          // penting: id kategori
          bidang_id: kategoriId,
          kategori_id: kategoriId,
          category_id: kategoriId,

          bidang_nama: kategoriNama,
          kategori: kategoriNama,

          pertanyaan: isi,
          isi,
          question: isi,
          content: isi,
        };

        console.log("📤 POST /questions payload:", payload);

        try {
          const res = await fetchWithTimeout(
            `${API_BASE}/questions`,
            {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
            },
            12000
          );

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = { message: raw };
          }

          if (!res.ok) {
            Swal.fire({
              icon: "error",
              title: "Gagal mengirim",
              text: data.error || data.message || "Server menolak request.",
              confirmButtonColor: "#6D4C41",
            });
            return;
          }

          Swal.fire({
            icon: "success",
            title: "Terkirim!",
            text: "Pertanyaan kamu sudah masuk.",
            confirmButtonColor: "#6D4C41",
          });

          if (modal) modal.style.display = "none";
          if (inputNama) inputNama.value = "";
          if (inputIsi) inputIsi.value = "";
          if (selectKategori) selectKategori.value = "";

          await loadQuestions();
        } catch (err) {
          console.error("❌ POST /questions error:", err);
          Swal.fire({
            icon: "error",
            title: "Gagal mengirim",
            text: "Koneksi ke server bermasalah / timeout.",
            confirmButtonColor: "#6D4C41",
          });
        }
      });
    }

    // ==========================
    // INIT
    // ==========================
    loadCategories();
    loadQuestions();
  });
})();
