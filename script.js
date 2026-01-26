// script.js
// Khusus untuk index.html

document.addEventListener("DOMContentLoaded", () => {
  // =====================================================
  // 1. Atur tampilan menu Akun (Login / Logout)
  // =====================================================
  const token = localStorage.getItem("token");
  const loginLink = document.getElementById("loginLink");
  const logoutBtn = document.getElementById("btn-logout");

  if (token) {
    // User sudah login → sembunyikan tombol Login
    if (loginLink) loginLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "block";
  } else {
    // User belum login → sembunyikan tombol Logout
    if (logoutBtn) logoutBtn.style.display = "none";
    if (loginLink) loginLink.style.display = "block";
  }

  // =====================================================
  // 2. Public access: Artikel / Peraturan / Tulisan
  //    → hapus proteksi require-login di link non-tanya
  // =====================================================
  const protectedLinks = document.querySelectorAll("a.require-login");

  protectedLinks.forEach((link) => {
    const href = (link.getAttribute("href") || "").toLowerCase();

    // Kalau link menuju tanya.html → tetap butuh login
    if (href.includes("tanya")) {
      // Biarkan class require-login tetap ada (kalau dipakai CSS)
      return;
    }

    // Selain tanya → jadikan public
    link.classList.remove("require-login");
  });

  // =====================================================
  // 3. Khusus: Tanya Jaksa (harus login)
  //    - Link di navbar: /user/tanyajaksa/tanya.html
  //    - Link di card: tanya.html
  // =====================================================
  const tanyaLinks = [
    ...document.querySelectorAll('a[href*="tanya.html"]'),
    ...document.querySelectorAll('a[href*="tanyajaksa"]')
  ];

  tanyaLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const currentToken = localStorage.getItem("token");

      if (!currentToken) {
        e.preventDefault();

        Swal.fire({
          icon: "warning",
          title: "Login dulu ya",
          text: "Kamu harus registrasi dan login terlebih dahulu untuk mengajukan pertanyaan kepada Jaksa.",
          showCancelButton: true,
          confirmButtonText: "Login / Daftar",
          cancelButtonText: "Nanti saja",
        }).then((result) => {
          if (result.isConfirmed) {
            // Sesuaikan path login kalau beda
            window.location.href = "/auth/login.html";
          }
        });
      }
    });
  });

  // =====================================================
  // ✅ 4. Kisi-kisi Tanya Jaksa per Bidang (Homepage)
  // =====================================================
  const kisiGrid = document.getElementById("kisiGrid");
  const kisiTitle = document.getElementById("kisiTitle");
  const kisiDesc = document.getElementById("kisiDesc");
  const kisiTopics = document.getElementById("kisiTopics");
  const kisiQuestions = document.getElementById("kisiQuestions");
  const kisiBadge = document.getElementById("kisiBadge");
  const kisiReset = document.getElementById("kisiReset");
  const kisiCopy = document.getElementById("kisiCopy");

  const escapeHTML = (str) =>
    String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // Data kisi-kisi: 8 bidang seperti di sistem kamu
  const KISI = [
    {
      key: "Pembinaan",
      icon: "fa-solid fa-people-roof",
      mini: "Urusan pembinaan internal & layanan kelembagaan. Cocok buat tanya soal prosedur dan layanan kejaksaan.",
      desc:
        "Bidang Pembinaan fokus ke urusan pembinaan organisasi, tata kelola, layanan administratif, dan dukungan internal. Kalau kamu bingung prosedur layanan atau alur resmi, biasanya masuk sini.",
      topics: [
        "Prosedur layanan/administrasi di lingkungan kejaksaan",
        "Tata cara pengaduan/permohonan informasi (umum)",
        "Kegiatan edukasi atau sosialisasi hukum di sekolah"
      ],
      questions: [
        "Kalau mau minta edukasi hukum ke sekolah, prosedurnya gimana?",
        "Bagaimana cara menyampaikan pengaduan secara resmi dan benar?",
        "Dokumen apa saja yang perlu disiapkan saat membuat laporan/pengaduan?"
      ],
    },
    {
      key: "Intelijen",
      icon: "fa-solid fa-user-shield",
      mini: "Deteksi dini & pengamanan. Cocok buat isu keamanan, hoaks hukum, penyuluhan, atau hal yang perlu dicek dulu.",
      desc:
        "Bidang Intelijen melakukan deteksi dini, pengamanan, dan penggalangan informasi terkait potensi masalah hukum. Cocok untuk pertanyaan awal tentang indikasi pelanggaran, hoaks, atau hal yang butuh arahan sebelum melapor.",
      topics: [
        "Hoaks/ancaman yang berpotensi jadi masalah hukum",
        "Pencegahan perundungan/kejahatan digital",
        "Cara melapor jika ada indikasi pelanggaran (tanpa menuduh berlebihan)"
      ],
      questions: [
        "Aku lihat ancaman di chat, langkah aman apa yang harus aku lakukan?",
        "Kalau ada dugaan pungli di lingkungan sekolah, cara melaporkannya gimana?",
        "Aku ragu ini hoaks atau bukan—apa dampak hukumnya kalau aku ikut sebar?"
      ],
    },
    {
      key: "Pidana Umum",
      icon: "fa-solid fa-scale-balanced",
      mini: "Kasus pidana sehari-hari: perundungan, penganiayaan, pencurian, penipuan, kekerasan, dsb.",
      desc:
        "Pidana Umum menangani tindak pidana umum yang sering terjadi di kehidupan sehari-hari. Kalau kasusnya terkait kekerasan, perundungan, pencurian, penipuan biasa, atau penganiayaan—biasanya masuk sini.",
      topics: [
        "Bullying (offline/online) dan kekerasan",
        "Pencurian, perusakan, pemerasan",
        "Penipuan (jual beli, transfer, akun palsu)"
      ],
      questions: [
        "Kalau aku dibully dan diancam, itu termasuk pidana? langkah aman apa?",
        "Aku ketipu transfer saat beli barang online, bukti apa yang perlu disiapkan?",
        "Kalau ada penganiayaan di sekolah, siapa yang harus dihubungi dulu?"
      ],
    },
    {
      key: "Pidana Khusus",
      icon: "fa-solid fa-landmark",
      mini: "Kasus pidana khusus: korupsi, gratifikasi, pungli, kejahatan ekonomi tertentu, dsb.",
      desc:
        "Pidana Khusus biasanya menangani perkara tertentu seperti korupsi, gratifikasi, atau pungutan liar (pungli) serta tindak pidana khusus lainnya. Kalau pertanyaanmu terkait uang/penyalahgunaan wewenang, ini tempatnya.",
      topics: [
        "Gratifikasi dan korupsi (dalam konteks umum)",
        "Pungli (pungutan liar) di layanan publik",
        "Penyalahgunaan kewenangan"
      ],
      questions: [
        "Kalau diminta ‘uang pelicin’ untuk urus dokumen, itu pungli? gimana sikapnya?",
        "Apa bedanya suap dan gratifikasi secara umum?",
        "Kalau aku punya bukti chat pungli, cara lapor yang aman gimana?"
      ],
    },
    {
      key: "Perdata dan Tata Usaha Negara",
      icon: "fa-solid fa-file-signature",
      mini: "Sengketa perdata & urusan administrasi negara: perjanjian, ganti rugi, surat-menyurat resmi, dll.",
      desc:
        "Bidang Perdata dan TUN berkaitan dengan sengketa perdata (hubungan antar orang/kelompok) dan perkara administrasi negara. Cocok untuk pertanyaan soal perjanjian, ganti rugi, atau keputusan administrasi.",
      topics: [
        "Perjanjian sederhana (utang piutang, jual beli)",
        "Ganti rugi/kerugian non-pidana",
        "Keputusan administrasi (surat keputusan, prosedur administratif)"
      ],
      questions: [
        "Kalau aku minjemin uang tapi gak dibayar, langkah yang benar apa?",
        "Kalau ada perjanjian online, apa yang bikin itu sah secara umum?",
        "Kalau merasa dirugikan karena keputusan administrasi, harus mulai dari mana?"
      ],
    },
    {
      key: "Pidana Militer",
      icon: "fa-solid fa-person-military-pointing",
      mini: "Perkara yang terkait anggota militer. Kalau kasusnya melibatkan TNI/ranah militer.",
      desc:
        "Pidana Militer berkaitan dengan perkara yang melibatkan subjek/ranah militer. Kalau kamu berhadapan dengan situasi yang melibatkan anggota militer, biasanya mekanismenya berbeda.",
      topics: [
        "Pertanyaan umum terkait mekanisme penanganan perkara militer",
        "Ke mana melapor jika kejadian melibatkan oknum militer",
        "Perbedaan proses (umum vs militer) secara garis besar"
      ],
      questions: [
        "Kalau kejadian melibatkan oknum militer, pelaporannya lewat jalur apa?",
        "Apakah prosesnya sama dengan pidana umum? bedanya di mana secara garis besar?",
        "Kalau aku cuma saksi, hak dan kewajibanku apa?"
      ],
    },
    {
      key: "Pengawasan",
      icon: "fa-solid fa-eye",
      mini: "Pengawasan perilaku/etik dan kinerja internal. Cocok untuk pengaduan pelayanan/oknum di kejaksaan.",
      desc:
        "Bidang Pengawasan menangani pengawasan internal: perilaku, etika, dan kinerja aparatur. Cocok untuk pengaduan layanan atau dugaan pelanggaran disiplin aparat (dalam konteks lembaga).",
      topics: [
        "Pengaduan layanan/etik aparatur (umum)",
        "Prosedur pelaporan internal",
        "Tindak lanjut pengaduan dan bukti yang diperlukan"
      ],
      questions: [
        "Kalau aku merasa dipersulit saat mengurus sesuatu, bisa mengadu ke mana?",
        "Bukti apa yang paling kuat untuk pengaduan layanan/etik?",
        "Bagaimana cara membuat pengaduan yang jelas dan tidak emosional?"
      ],
    },
    {
      key: "Pemulihan Aset",
      icon: "fa-solid fa-hand-holding-dollar",
      mini: "Pemulihan/penyitaan aset hasil kejahatan. Cocok buat tanya soal pengembalian kerugian atau aset terkait kasus.",
      desc:
        "Pemulihan Aset fokus pada upaya menelusuri, mengamankan, dan memulihkan aset yang terkait tindak pidana. Kalau pertanyaanmu terkait pengembalian kerugian, aset, atau barang bukti—ini relevan.",
      topics: [
        "Barang bukti & aset terkait perkara",
        "Pengembalian kerugian/asset recovery (umum)",
        "Status aset dalam proses hukum (garis besar)"
      ],
      questions: [
        "Kalau barangku jadi barang bukti, kapan bisa diambil lagi?",
        "Bagaimana proses umum pengembalian kerugian dari pelaku ke korban?",
        "Apa yang harus disiapkan untuk mengklaim barang milik sendiri dalam perkara?"
      ],
    },
  ];

  let selectedKey = "";

  const renderGrid = () => {
    if (!kisiGrid) return;

    kisiGrid.innerHTML = KISI.map((b) => {
      return `
        <div class="kisi-card" data-key="${escapeHTML(b.key)}" role="button" tabindex="0" aria-label="Pilih bidang ${escapeHTML(b.key)}">
          <div class="kisi-card-top">
            <div class="kisi-icon"><i class="${escapeHTML(b.icon)}"></i></div>
            <div class="kisi-name">${escapeHTML(b.key)}</div>
            <div style="opacity:.75;"><i class="fa-solid fa-chevron-right"></i></div>
          </div>
          <div class="kisi-mini">${escapeHTML(b.mini)}</div>
          <div class="kisi-pill"><i class="fa-regular fa-circle-question"></i> Lihat contoh pertanyaan</div>
        </div>
      `;
    }).join("");
  };

  const setActiveCard = (key) => {
    if (!kisiGrid) return;
    kisiGrid.querySelectorAll(".kisi-card").forEach((el) => {
      const k = el.getAttribute("data-key") || "";
      el.classList.toggle("active", k === key);
    });
  };

  const renderDetail = (key) => {
    const data = KISI.find((x) => x.key === key);
    if (!data) return;

    selectedKey = key;
    setActiveCard(key);

    if (kisiTitle) kisiTitle.textContent = data.key;
    if (kisiBadge) kisiBadge.textContent = "Bidang Kejaksaan";

    if (kisiDesc) kisiDesc.textContent = data.desc;

    if (kisiTopics) {
      kisiTopics.innerHTML = data.topics.map((t) => `<li>${escapeHTML(t)}</li>`).join("");
    }

    if (kisiQuestions) {
      kisiQuestions.innerHTML = data.questions
        .map((q) => `<div class="kisi-q-item">${escapeHTML(q)}</div>`)
        .join("");
    }
  };

  const resetDetail = () => {
    selectedKey = "";
    setActiveCard("");

    if (kisiTitle) kisiTitle.textContent = "Pilih salah satu bidang";
    if (kisiBadge) kisiBadge.textContent = "8 Bidang Kejaksaan";
    if (kisiDesc) kisiDesc.textContent =
      "Klik kartu bidang di samping buat lihat penjelasan singkat + contoh pertanyaan yang cocok.";

    if (kisiTopics) {
      kisiTopics.innerHTML = `
        <li>Contoh: “Aku kena bully online, itu masuk ranah apa?”</li>
        <li>Contoh: “Kalau jadi saksi, hakku apa aja?”</li>
        <li>Contoh: “Boleh gak sebar foto orang tanpa izin?”</li>
      `;
    }

    if (kisiQuestions) {
      kisiQuestions.innerHTML = `<div class="kisi-q-item">Pilih bidang dulu ya 🙂</div>`;
    }
  };

  const setupInteractions = () => {
    if (!kisiGrid) return;

    kisiGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".kisi-card");
      if (!card) return;
      const key = card.getAttribute("data-key") || "";
      if (!key) return;
      renderDetail(key);
    });

    // keyboard accessibility
    kisiGrid.addEventListener("keydown", (e) => {
      const card = e.target.closest(".kisi-card");
      if (!card) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const key = card.getAttribute("data-key") || "";
        if (key) renderDetail(key);
      }
    });

    if (kisiReset) {
      kisiReset.addEventListener("click", () => resetDetail());
    }

    if (kisiCopy) {
      kisiCopy.addEventListener("click", async () => {
        if (!selectedKey) {
          Swal.fire({
            icon: "info",
            title: "Pilih bidang dulu",
            text: "Klik salah satu bidang dulu, baru bisa salin contoh pertanyaannya.",
            confirmButtonColor: "#6D4C41",
          });
          return;
        }

        const data = KISI.find((x) => x.key === selectedKey);
        const textToCopy = data ? data.questions.join("\n") : "";

        try {
          await navigator.clipboard.writeText(textToCopy);
          Swal.fire({
            icon: "success",
            title: "Berhasil disalin",
            text: "Contoh pertanyaan sudah masuk clipboard. Tinggal paste di form Tanya Jaksa.",
            confirmButtonColor: "#6D4C41",
          });
        } catch {
          // fallback: tampilkan supaya bisa copy manual
          Swal.fire({
            icon: "info",
            title: "Salin manual",
            html: `<pre style="text-align:left; white-space:pre-wrap; line-height:1.6;">${escapeHTML(textToCopy)}</pre>`,
            confirmButtonColor: "#6D4C41",
          });
        }
      });
    }
  };

  // Init kisi-kisi
  renderGrid();
  setupInteractions();
  resetDetail();
});
