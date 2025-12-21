// ============================
//  GLOBAL LOGOUT HANDLER
//  Berlaku di semua halaman
//  - Pakai Swal kalau ada
//  - Kalau Swal gak ada, fallback ke confirm()
//  - Bersihin localStorage + sessionStorage (karena auth kamu pakai sessionStorage juga)
// ============================

document.addEventListener("DOMContentLoaded", () => {
  // Ambil semua kemungkinan tombol logout
  const btnLogout = document.getElementById("btn-logout");
  const logoutBtn = document.getElementById("logoutBtn");
  const navLogout = document.getElementById("navLogout");
  const btnCancel = document.getElementById("btn-cancel");

  const hasSwal = typeof window.Swal !== "undefined" && typeof window.Swal.fire === "function";

  function clearAuthStorage() {
    try {
      // localStorage (legacy)
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      localStorage.removeItem("displayName");

      // sessionStorage (yang kamu pakai sekarang)
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("role");
      sessionStorage.removeItem("displayName");
      sessionStorage.removeItem("redirectAfterLogin");
    } catch (_) {}
  }

  async function handleLogout(e) {
    // biar klik <a href="#"> gak loncat ke atas halaman
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    // ====== CONFIRM ======
    let confirmed = false;

    if (hasSwal) {
      const result = await Swal.fire({
        title: "Keluar dari Akun?",
        text: "Anda akan logout dari sistem EducLex.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, Logout",
        cancelButtonText: "Batal",
        reverseButtons: true,
      });
      confirmed = !!result.isConfirmed;
    } else {
      confirmed = window.confirm("Keluar dari Akun?\nAnda akan logout dari sistem EducLex.");
    }

    if (!confirmed) return;

    // ====== CLEAR TOKEN ======
    clearAuthStorage();

    // ====== FEEDBACK ======
    if (hasSwal) {
      await Swal.fire({
        icon: "success",
        title: "Logout Berhasil!",
        text: "Mengalihkan ke halaman login...",
        timer: 900,
        showConfirmButton: false,
      });
    }

    // ====== REDIRECT ======
    window.location.href = "/auth/login.html";
  }

  // ============================
  // EVENT LISTENER UNTUK SEMUA TYPE BUTTON LOGOUT
  // ============================

  if (btnLogout) btnLogout.addEventListener("click", handleLogout);
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  if (navLogout) {
    navLogout.addEventListener("click", handleLogout);
  }

  // Tombol Cancel (jika ada)
  if (btnCancel) {
    btnCancel.addEventListener("click", async (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();

      if (hasSwal) {
        await Swal.fire({
          title: "Dibatalkan",
          text: "Anda tetap berada di halaman.",
          icon: "info",
          timer: 1200,
          showConfirmButton: false,
        });
      } else {
        alert("Dibatalkan. Anda tetap berada di halaman.");
      }
      window.history.back();
    });
  }
});
