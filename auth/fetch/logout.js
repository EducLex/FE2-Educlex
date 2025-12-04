// ============================
//  GLOBAL LOGOUT HANDLER
//  Berlaku di semua halaman
// ============================

document.addEventListener("DOMContentLoaded", () => {
  // Ambil semua kemungkinan tombol logout
  const btnLogout = document.getElementById("btn-logout");
  const logoutBtn = document.getElementById("logoutBtn");
  const navLogout = document.getElementById("navLogout");
  const btnCancel = document.getElementById("btn-cancel");

  // Fungsi utama logout (HANYA dibuat sekali, dipakai semua tombol)
  async function handleLogout() {
    const result = await Swal.fire({
      title: "Keluar dari Akun?",
      text: "Anda akan logout dari sistem EducLex.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Logout",
      cancelButtonText: "Batal",
      reverseButtons: true
    });

    if (result.isConfirmed) {

      // Bersihkan localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");

      await Swal.fire({
        icon: "success",
        title: "Logout Berhasil!",
        text: "Mengalihkan ke halaman login...",
        timer: 1000,
        showConfirmButton: false
      });

      // ✅ PERBAIKAN: Naik 2 level ke root, lalu masuk ke auth/login.html
      window.location.href = "/auth/login.html"; 

      // ⚠️ HAPUS BARIS INI (redundan & salah)
      // window.location.href = "/auth/login.html"; 
    }
  }

  // ============================
  // EVENT LISTENER UNTUK SEMUA TYPE BUTTON LOGOUT
  // ============================

  if (btnLogout) btnLogout.addEventListener("click", handleLogout);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  // Navbar logout → trigger tombol utama
  if (navLogout) {
    navLogout.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Tombol Cancel (jika ada)
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      Swal.fire({
        title: "Dibatalkan",
        text: "Anda tetap berada di halaman.",
        icon: "info",
        timer: 1400,
        showConfirmButton: false
      }).then(() => {
        window.history.back();
      });
    });
  }
});