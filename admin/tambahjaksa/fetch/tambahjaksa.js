// /admin/tambahjaksa/fetch/tambahjaksa.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8080";
  const REGISTER_JAKSA_ENDPOINT = "/auth/register-jaksa";
  const BIDANG_ENDPOINT = "/bidang";
  const VERIFY_EMAIL_ENDPOINT = "/auth/verify-email";
  const JAKSA_LIST_ENDPOINT = "/jaksa"; // GET /jaksa, PUT/DELETE /jaksa/:id

  const formJaksa = document.getElementById("formJaksa");
  const tabelBody = document.getElementById("tabelJaksaBody");
  const selectBidang = document.getElementById("bidang_nama");

  const namaInput = document.getElementById("nama");
  const nipInput = document.getElementById("nip");
  const jabatanInput = document.getElementById("jabatan");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm_password");
  const fotoInput = document.getElementById("foto");

  const submitBtn = formJaksa?.querySelector(".btn-simpan");

  // state edit
  let isEditMode = false;
  let editingJaksaId = null;

  // id -> nama kalau /bidang berhasil
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

  function escapeHtml(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setCreateMode() {
    isEditMode = false;
    editingJaksaId = null;
    if (submitBtn) {
      submitBtn.innerHTML = `<i class="fas fa-save"></i> Simpan Data Jaksa`;
    }
    // password wajib lagi
    passwordInput?.setAttribute("required", "required");
    confirmInput?.setAttribute("required", "required");
    formJaksa?.reset();
    if (selectBidang) selectBidang.selectedIndex = 0;
  }

  function setEditMode(id) {
    isEditMode = true;
    editingJaksaId = id;
    if (submitBtn) {
      submitBtn.innerHTML = `<i class="fas fa-save"></i> Perbarui Data Jaksa`;
    }
    // di edit, password boleh kosong
    passwordInput?.removeAttribute("required");
    confirmInput?.removeAttribute("required");
  }

  // =========================
  // Load Bidang dari /bidang (kalau ada)
  // =========================
  async function loadBidang() {
    if (!selectBidang) return;

    try {
      const token = getToken();
      const headers = {};
      if (token) headers["Authorization"] = "Bearer " + token;

      const res = await fetch(`${API_BASE}${BIDANG_ENDPOINT}`, { headers });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

      if (!res.ok || !Array.isArray(data) || data.length === 0) {
        console.warn("⚠️ /bidang gagal atau kosong, pakai option statis HTML saja.", data);
        return;
      }

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
        opt.value = id;          // simpan id di value
        opt.textContent = nama;  // tampilkan nama
        opt.dataset.nama = nama;
        selectBidang.appendChild(opt);
      });
    } catch (err) {
      console.error("❌ FETCH ERROR /bidang:", err);
    }
  }

  // =========================
  // Render tabel jaksa
  // =========================
  function renderJaksaTable(list) {
    if (!tabelBody) return;

    if (!Array.isArray(list) || list.length === 0) {
      tabelBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center;">Belum ada data jaksa</td></tr>
      `;
      return;
    }

    tabelBody.innerHTML = list
      .map((j) => {
        const id =
          j._id ||
          j.id ||
          j.jaksa_id ||
          j.user_id ||
          "";

        const nama = j.nama || j.name || "-";
        const nip = j.nip || "-";
        const jabatan = j.jabatan || "-";
        const email = j.email || "-";
        const bidangNama =
          j.bidang_nama ||
          j.bidang?.nama ||
          j.bidang ||
          "";

        return `
          <tr
            data-id="${escapeHtml(id)}"
            data-nama="${escapeHtml(nama)}"
            data-nip="${escapeHtml(nip)}"
            data-jabatan="${escapeHtml(jabatan)}"
            data-email="${escapeHtml(email)}"
            data-bidang="${escapeHtml(bidangNama)}"
          >
            <td>${escapeHtml(nama)}</td>
            <td>${escapeHtml(nip)}</td>
            <td>${escapeHtml(jabatan)}</td>
            <td>${escapeHtml(email)}</td>
            <td>
              <button class="btn-aksi btn-edit" data-id="${escapeHtml(id)}">
                <i class="fas fa-pen"></i> Edit
              </button>
              <button class="btn-aksi btn-delete" data-id="${escapeHtml(id)}">
                <i class="fas fa-trash"></i> Hapus
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Pasang handler Edit
    tabelBody.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const tr = btn.closest("tr");
        if (!id || !tr) return;

        const nama = tr.getAttribute("data-nama") || "";
        const nip = tr.getAttribute("data-nip") || "";
        const jabatan = tr.getAttribute("data-jabatan") || "";
        const email = tr.getAttribute("data-email") || "";
        const bidangNama = (tr.getAttribute("data-bidang") || "").trim();

        if (namaInput) namaInput.value = nama;
        if (nipInput) nipInput.value = nip;
        if (jabatanInput) jabatanInput.value = jabatan;
        if (emailInput) emailInput.value = email;

        // set select bidang sesuai nama
        if (selectBidang && bidangNama) {
          let found = false;
          Array.from(selectBidang.options).forEach((opt) => {
            const optNama = (opt.dataset.nama || opt.textContent || "").trim();
            if (!found && optNama === bidangNama) {
              opt.selected = true;
              found = true;
            }
          });
        }

        setEditMode(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    // Pasang handler Delete
    tabelBody.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        hapusJaksa(id);
      });
    });
  }

  // =========================
  // Load daftar jaksa dari BE
  // =========================
  async function loadDaftarJaksa() {
    if (!tabelBody) return;

    const token = getToken();
    if (!token) {
      // Kalau belum login admin, tampilkan kosong tapi jangan error terus
      tabelBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; color:#f44336;">
          Sesi admin habis. Silakan login ulang.
        </td></tr>
      `;
      return;
    }

    tabelBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;">Memuat data jaksa...</td></tr>
    `;

    try {
      const res = await fetch(`${API_BASE}${JAKSA_LIST_ENDPOINT}`, {
        headers: { Authorization: "Bearer " + token },
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

      if (!res.ok) {
        console.error("❌ Error GET /jaksa:", res.status, data);
        tabelBody.innerHTML = `
          <tr><td colspan="5" style="text-align:center; color:#f44336;">
            Gagal memuat data jaksa.
          </td></tr>
        `;
        return;
      }

      const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      renderJaksaTable(list);
    } catch (err) {
      console.error("❌ FETCH ERROR /jaksa:", err);
      tabelBody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; color:#f44336;">
          Gagal terhubung ke server.
        </td></tr>
      `;
    }
  }

  // =========================
  // Hapus Jaksa
  // =========================
  async function hapusJaksa(id) {
    const token = getToken();
    if (!token) {
      showError("Sesi admin habis. Silakan login ulang.");
      return;
    }

    const konfirmasi = await Swal.fire({
      title: "Hapus Jaksa ini?",
      text: "Tindakan ini tidak dapat dibatalkan.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d32f2f",
      cancelButtonColor: "#6d4c41",
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
    });

    if (!konfirmasi.isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}${JAKSA_LIST_ENDPOINT}/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        console.error("❌ Error DELETE /jaksa/:id:", res.status, data);
        showError(data.error || data.message || "Gagal menghapus data jaksa.");
        return;
      }

      showSuccess("Data jaksa berhasil dihapus.");
      await loadDaftarJaksa();
    } catch (err) {
      console.error("❌ FETCH ERROR DELETE /jaksa/:id:", err);
      showError("Gagal terhubung ke server.");
    }
  }

  // =========================
  // Submit Register / Update Jaksa
  // =========================
  async function handleSubmit(e) {
    e.preventDefault();

    const nama = namaInput.value.trim();
    const nip = nipInput.value.trim();
    const jabatan = jabatanInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (!nama || !nip || !jabatan || !email) {
      showError("Nama, NIP, jabatan, dan email wajib diisi.");
      return;
    }

    if (!/^\d+$/.test(nip)) {
      showError("NIP wajib berisi angka saja.");
      return;
    }

    if (!selectBidang || !selectBidang.value) {
      showError("Pilih bidang jaksa terlebih dahulu.");
      return;
    }

    const fotoFile =
      fotoInput && fotoInput.files && fotoInput.files.length > 0
        ? fotoInput.files[0]
        : null;

    if (!fotoFile && !isEditMode) {
      showError("Silakan unggah foto jaksa.");
      return;
    }

    // Validasi password
    if (!isEditMode) {
      // TAMBAH BARU → password wajib
      if (!password || !confirmPassword) {
        showError("Password dan konfirmasi password wajib diisi.");
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
    } else {
      // EDIT → password opsional
      if (password || confirmPassword) {
        if (password !== confirmPassword) {
          showError("Password dan konfirmasi password tidak sama.");
          return;
        }
        if (password.length < 8) {
          showError("Password minimal 8 karakter.");
          return;
        }
      }
    }

    const token = getToken();
    if (!token) {
      showError("Sesi admin habis. Silakan login ulang.");
      return;
    }

    const selectedOption = selectBidang.options[selectBidang.selectedIndex];
    const bidangId = bidangMap.size > 0 ? selectBidang.value : "";
    const bidangNama =
      selectedOption?.dataset.nama ||
      selectedOption?.textContent ||
      selectBidang.value ||
      "";

    const username = nama; // biar field username di Mongo terisi

    // Pakai FormData supaya bisa kirim file
    const formData = new FormData();
    formData.append("nama", nama);
    formData.append("username", username);
    formData.append("nip", nip);
    formData.append("jabatan", jabatan);
    formData.append("email", email);
    if (!isEditMode || (password && confirmPassword)) {
      formData.append("password", password);
      formData.append("confirm_password", confirmPassword);
    }
    if (fotoFile) {
      formData.append("foto", fotoFile);
    }
    if (bidangId) {
      formData.append("bidang_id", bidangId);
    }
    if (bidangNama) {
      formData.append("bidang_nama", bidangNama);
    }

    try {
      if (isEditMode && editingJaksaId) {
        // =========================
        // UPDATE JAKSA (PUT /jaksa/:id)
        // =========================
        console.log(
          "📤 UPDATE JAKSA: PUT",
          `${API_BASE}${JAKSA_LIST_ENDPOINT}/${editingJaksaId}`
        );

        const res = await fetch(
          `${API_BASE}${JAKSA_LIST_ENDPOINT}/${editingJaksaId}`,
          {
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            body: formData,
          }
        );

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        console.log("📥 RESPONSE UPDATE:", res.status, data);

        if (!res.ok) {
          if (res.status === 401) {
            showError(
              data.error ||
                "Invalid atau expired token. Silakan login ulang sebagai admin."
            );
            return;
          }
          if (res.status === 403) {
            showError(
              data.error || "Forbidden: hanya Admin yang boleh mengubah Jaksa."
            );
            return;
          }

          showError(
            data.error ||
              data.message ||
              `Gagal memperbarui data jaksa (status ${res.status}).`
          );
          return;
        }

        showSuccess(data.message || "Data jaksa berhasil diperbarui.");
        setCreateMode();
        await loadDaftarJaksa();
        return;
      }

      // =========================
      // REGISTER JAKSA BARU (POST /auth/register-jaksa)
      // =========================
      console.log(
        "📤 REGISTER JAKSA: POST",
        `${API_BASE}${REGISTER_JAKSA_ENDPOINT}`,
        {
          nama,
          username,
          nip,
          jabatan,
          email,
          bidang_id: bidangId,
          bidang_nama: bidangNama,
          foto: fotoFile?.name,
        }
      );

      const res = await fetch(`${API_BASE}${REGISTER_JAKSA_ENDPOINT}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
        },
        body: formData,
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      console.log("📥 RESPONSE REGISTER:", res.status, data);

      if (!res.ok) {
        if (res.status === 401) {
          showError(
            data.error ||
              "Invalid atau expired token. Silakan login ulang sebagai admin."
          );
          return;
        }
        if (res.status === 403) {
          showError(
            data.error || "Forbidden: hanya Admin yang boleh menambah Jaksa."
          );
          return;
        }

        showError(
          data.error ||
            data.message ||
            `Gagal menyimpan data jaksa (status ${res.status}).`
        );
        return;
      }

      showSuccess(
        data.message ||
          "Data jaksa berhasil disimpan. Kode OTP verifikasi telah dikirim ke email jaksa."
      );

      setCreateMode();
      await loadDaftarJaksa();

      // =======================
      // OPSIONAL: langsung verifikasi OTP
      // =======================
      try {
        const { value: otp } = await Swal.fire({
          title: "Verifikasi Email Jaksa?",
          html:
            `Kode OTP telah dikirim ke <b>${escapeHtml(
              email
            )}</b>.<br/>` +
            `<small>Kalau mau langsung verifikasi, masukkan kode OTP di sini. Kalau tidak, klik "Nanti Saja".</small>`,
          input: "text",
          inputPlaceholder: "Masukkan kode OTP (boleh dikosongkan)",
          showCancelButton: true,
          confirmButtonText: "Verifikasi OTP",
          cancelButtonText: "Nanti Saja",
        });

        if (!otp) {
          // user milih nanti saja
          return;
        }

        const resVerify = await fetch(
          `${API_BASE}${VERIFY_EMAIL_ENDPOINT}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, otp: otp.trim() }),
          }
        );

        const textVerify = await resVerify.text();
        let dataVerify;
        try {
          dataVerify = JSON.parse(textVerify);
        } catch {
          dataVerify = { error: textVerify };
        }

        console.log("📥 RESPONSE VERIFY OTP:", resVerify.status, dataVerify);

        if (!resVerify.ok) {
          Swal.fire(
            "Gagal Verifikasi",
            dataVerify.error ||
              dataVerify.message ||
              "OTP salah atau sudah kedaluwarsa.",
            "error"
          );
        } else {
          Swal.fire(
            "Berhasil",
            dataVerify.message || "Email jaksa berhasil diverifikasi.",
            "success"
          );
        }
      } catch (errVerify) {
        console.error("❌ VERIFY OTP ERROR:", errVerify);
        Swal.fire(
          "Error",
          "Terjadi kesalahan saat mengirim/verifikasi OTP.",
          "error"
        );
      }
    } catch (err) {
      console.error("❌ FETCH ERROR REGISTER/UPDATE JAKSA:", err);
      showError("Gagal terhubung ke server.");
    }
  }

  // =========================
  // Event binding & init
  // =========================
  if (formJaksa) {
    formJaksa.addEventListener("submit", handleSubmit);
  }

  loadBidang();      // kalau gagal, tetap pakai option statis HTML
  loadDaftarJaksa(); // tarik data jaksa existing
});
