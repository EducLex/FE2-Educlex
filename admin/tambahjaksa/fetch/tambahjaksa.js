// /admin/tambahjaksa/tambahjaksa.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";
  const REGISTER_JAKSA_ENDPOINT = "/auth/register-jaksa";
  const BIDANG_ENDPOINT = "/bidang";

  const formJaksa = document.getElementById("formJaksa");
  const tabelBody = document.getElementById("tabelJaksaBody");
  const selectBidang = document.getElementById("bidang_nama");

  // Map id -> nama bidang (kalau berhasil di-load dari /bidang)
  const bidangMap = new Map();

  // =========================
  // Helper
  // =========================
  function getToken() {
    return localStorage.getItem("token") || "";
  }

  function showError(message) {
    Swal.fire("Gagal", message, "error");
  }

  function showSuccess(message) {
    Swal.fire("Berhasil", message, "success");
  }

  function clearTableIfEmpty() {
    if (!tabelBody) return;
    if (tabelBody.children.length === 1) {
      const onlyRow = tabelBody.children[0];
      if (
        onlyRow.children.length === 1 &&
        onlyRow.children[0].textContent.includes("Belum ada data jaksa")
      ) {
        tabelBody.innerHTML = "";
      }
    }
  }

  function appendJaksaRow(jaksa) {
    if (!tabelBody) return;

    clearTableIfEmpty();

    const tr = document.createElement("tr");

    const nama = jaksa.nama || jaksa.name || "-";
    const nip = jaksa.nip || "-";
    const jabatan = jaksa.jabatan || "-";
    const email = jaksa.email || "-";

    tr.innerHTML = `
      <td>${nama}</td>
      <td>${nip}</td>
      <td>${jabatan}</td>
      <td>${email}</td>
      <td>
        <!-- nanti kalau mau edit/hapus bisa ditambah di sini -->
        <span style="color:#6d4c41; font-size: 0.9rem;">Ditambahkan</span>
      </td>
    `;

    tabelBody.appendChild(tr);
  }

  // =========================
  // Load Bidang dari /bidang
  // =========================
  async function loadBidang() {
    if (!selectBidang) return;

    try {
      const token = getToken();
      const headers = {};
      if (token) {
        headers["Authorization"] = "Bearer " + token;
      }

      const res = await fetch(`${API_BASE}${BIDANG_ENDPOINT}`, { headers });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

      if (!res.ok || !Array.isArray(data) || data.length === 0) {
        console.warn("⚠️ Gagal atau kosong /bidang, pakai opsi statis HTML saja.", data);
        return; // biarin pakai <option> yang sudah ada di HTML
      }

      // Kosongkan option existing lalu isi pakai data dari BE
      selectBidang.innerHTML = `
        <option value="" disabled selected>Pilih Bidang Jaksa</option>
      `;

      data.forEach((item) => {
        const id =
          item.id ||
          item._id ||
          item.bidang_id ||
          item.value ||
          "";
        const nama =
          item.nama ||
          item.name ||
          item.bidang_nama ||
          "Tanpa Nama";

        if (!id) return;

        bidangMap.set(id, nama);

        const opt = document.createElement("option");
        opt.value = id;          // simpan id
        opt.textContent = nama;  // tampilkan nama
        opt.dataset.nama = nama;
        selectBidang.appendChild(opt);
      });
    } catch (err) {
      console.error("❌ FETCH ERROR /bidang:", err);
      // Kalau error, tetap pakai opsi statis di HTML
    }
  }

  // =========================
  // Submit Register Jaksa
  // =========================
  async function handleSubmit(e) {
    e.preventDefault();

    const nama = document.getElementById("nama").value.trim();
    const nip = document.getElementById("nip").value.trim();
    const jabatan = document.getElementById("jabatan").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm_password").value;
    const fotoInput = document.getElementById("foto");

    if (!nama || !nip || !jabatan || !email || !password || !confirmPassword) {
      showError("Semua field wajib diisi.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Password dan konfirmasi password tidak sama.");
      return;
    }

    if (password.length < 8) {
      showError("Password minimal 8 karakter.");
      return;
    }

    if (!selectBidang || !selectBidang.value) {
      showError("Pilih bidang jaksa terlebih dahulu.");
      return;
    }

    const bidangId = bidangMap.size > 0
      ? selectBidang.value // berisi ID dari /bidang
      : "";                // kalau gagal load /bidang, kita cuma kirim nama

    const selectedOption = selectBidang.options[selectBidang.selectedIndex];
    const bidangNama =
      selectedOption?.dataset.nama ||
      selectedOption?.textContent ||
      selectBidang.value ||
      "";

    if (!fotoInput || !fotoInput.files || fotoInput.files.length === 0) {
      showError("Silakan unggah foto jaksa.");
      return;
    }

    const fotoFile = fotoInput.files[0];

    const token = getToken();
    if (!token) {
      showError("Anda belum login atau sesi telah habis.");
      return;
    }

    // Pakai FormData untuk kirim file + field lain
    const formData = new FormData();
    formData.append("nama", nama);
    formData.append("nip", nip);
    formData.append("jabatan", jabatan);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("confirm_password", confirmPassword);
    formData.append("foto", fotoFile);

    // Kirim bidang_id kalau ada, plus nama untuk jaga-jaga
    if (bidangId) {
      formData.append("bidang_id", bidangId);
    }
    if (bidangNama) {
      formData.append("bidang_nama", bidangNama);
    }

    console.log("📤 REGISTER JAKSA payload (FormData):", {
      nama,
      nip,
      jabatan,
      email,
      bidang_id: bidangId,
      bidang_nama: bidangNama,
      foto: fotoFile?.name
    });

    try {
      const res = await fetch(`${API_BASE}${REGISTER_JAKSA_ENDPOINT}`, {
        method: "POST",
        headers: {
          // JANGAN set Content-Type di sini, biar browser yang set (multipart/form-data)
          Authorization: "Bearer " + token
        },
        body: formData
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        console.error("❌ Error POST /auth/register-jaksa:", res.status, data);
        showError(
          data.error ||
            data.message ||
            `Gagal menyimpan data jaksa (status ${res.status}).`
        );
        return;
      }

      showSuccess("Data jaksa berhasil disimpan.");

      // Tambah ke tabel (pakai data dari server kalau ada, fallback ke input)
      const created =
        data.jaksa ||
        data.data ||
        {
          nama,
          nip,
          jabatan,
          email
        };

      appendJaksaRow(created);

      // Reset form
      formJaksa.reset();
      // Reset placeholder "Pilih Bidang"
      if (selectBidang) {
        selectBidang.selectedIndex = 0;
      }
    } catch (err) {
      console.error("❌ FETCH ERROR /auth/register-jaksa:", err);
      showError("Gagal terhubung ke server.");
    }
  }

  // =========================
  // Event binding
  // =========================
  if (formJaksa) {
    formJaksa.addEventListener("submit", handleSubmit);
  }

  // Load list bidang saat halaman dibuka
  loadBidang();
});
