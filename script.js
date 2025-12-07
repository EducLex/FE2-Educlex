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
});
