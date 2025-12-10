// Fallback showAlert jika belum ada
if (typeof showAlert !== "function") {
  function showAlert(message, type = "info") {
    const container = document.getElementById("alert-container");
    if (container) {
      const icon = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" }[type] || "ℹ️";
      container.innerHTML = `<div class="alert ${type}">${icon} ${message}</div>`;
      setTimeout(() => (container.innerHTML = ""), 4000);
    } else {
      alert(message);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const apiBase = "http://localhost:8080";

  // ======================================================
  //  ❗ KALAU ENDPOINT OTP DI BACKEND BUKAN /auth/send-otp
  //  CUKUP GANTI NILAI VARIABEL INI
  // ======================================================
  const SEND_OTP_ENDPOINT = "/auth/send-otp";
  const VERIFY_EMAIL_ENDPOINT = "/auth/verify-email";
  const RESET_PASSWORD_ENDPOINT = "/jaksa/auth/reset-password-jaksa";
  const LOGIN_ENDPOINT = "/auth/login";

  // ============================================
  //  VARIABEL ELEMEN LOGIN & RESET PASSWORD
  // ============================================
  const loginForm = document.getElementById("loginForm");
  const loginFormContainer = document.getElementById("login-form-container");

  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const forgotContainer = document.getElementById("forgot-password-container");
  const backToLoginBtn = document.getElementById("back-to-login");

  const resetContainer = document.getElementById("reset-password-container");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const backToForgotBtn = document.getElementById("back-to-forgot");

  // FORM LUPA PASSWORD (STEP EMAIL → KIRIM OTP)
  const forgotForm = document.getElementById("forgotPasswordForm");
  const resetEmailInput = document.getElementById("resetEmail"); // hidden input untuk simpan email

  // ============================================
  //  Helper: ambil role dari response / token
  // ============================================
  function extractRoleFromResponse(data, token) {
    let role =
      data.role ||
      data.user?.role ||
      data.data?.role ||
      (Array.isArray(data.roles) ? data.roles[0] : null);

    // Kalau backend taruh role di dalam JWT & tidak ada di body
    if (!role && token && token.split(".").length === 3) {
      try {
        const payloadStr = atob(token.split(".")[1]);
        const payload = JSON.parse(payloadStr);
        role =
          payload.role ||
          payload.roles?.[0] ||
          payload.authorities?.[0] ||
          null;
      } catch (e) {
        console.warn("Gagal decode JWT untuk ambil role:", e);
      }
    }
    return role || null;
  }

  function getRedirectByRole(role) {
    if (!role) return "/index.html";
    const r = role.toString().toLowerCase();

    if (r === "admin") return "/admin/dashboard/dbadmin.html";
    if (r === "jaksa" || r === "prosecutor") return "/jaksa/dashboard/dbjaksa.html";

    // default user biasa
    return "/index.html";
  }

  // ============================================
  //  A. LOGIN USERNAME / PASSWORD
  // ============================================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("loginUsername")?.value.trim();
      const password = document.getElementById("loginPassword")?.value;

      if (!username || !password) {
        showAlert("Username dan password wajib diisi!", "warning");
        return;
      }

      try {
        const res = await fetch(`${apiBase}${LOGIN_ENDPOINT}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (!res.ok) {
          console.error("❌ LOGIN ERROR:", res.status, text);
          showAlert(data.error || data.message || "Login gagal!", "error");
          return;
        }

        // Ambil token (support beberapa kemungkinan field)
        const token =
          data.token ||
          data.access_token ||
          data.data?.token ||
          null;

        if (token) {
          localStorage.setItem("token", token);
        }

        // Ambil role & simpan
        const role = extractRoleFromResponse(data, token);
        if (role) {
          localStorage.setItem("role", role);
        }

        showAlert("Login berhasil!", "success");

        const redirectUrl = getRedirectByRole(role);

        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 800);
      } catch (err) {
        console.error("❌ FETCH ERROR LOGIN:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================================
  //  B. LUPA PASSWORD – STEP 1: INPUT EMAIL
  //      (email → kirim OTP ke email)
  // ============================================
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();

      // tampilin form lupa password (email)
      if (loginFormContainer) loginFormContainer.style.display = "none";
      if (resetContainer) resetContainer.style.display = "none";
      if (forgotContainer) forgotContainer.style.display = "block";
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      // balik ke form login dari manapun
      if (forgotContainer) forgotContainer.style.display = "none";
      if (resetContainer) resetContainer.style.display = "none";
      if (loginFormContainer) loginFormContainer.style.display = "block";
    });
  }

  if (backToForgotBtn) {
    backToForgotBtn.addEventListener("click", () => {
      // dari reset password balik ke form email
      if (resetContainer) resetContainer.style.display = "none";
      if (loginFormContainer) loginFormContainer.style.display = "none";
      if (forgotContainer) forgotContainer.style.display = "block";
    });
  }

  // STEP 1: submit email untuk minta OTP
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("forgotEmail")?.value.trim();

      if (!email) {
        showAlert("Email wajib diisi!", "warning");
        return;
      }

      try {
        console.log(
          "📤 SEND OTP (forgot password) ke:",
          email,
          "→",
          `${apiBase}${SEND_OTP_ENDPOINT}`
        );

        const res = await fetch(`${apiBase}${SEND_OTP_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        console.log("📥 RESPONSE SEND OTP:", res.status, text);

        if (!res.ok) {
          showAlert(data.error || data.message || "Gagal mengirim OTP!", "error");
          return;
        }

        // simpan email ke hidden input untuk dipakai di step berikutnya
        if (resetEmailInput) resetEmailInput.value = email;

        // pindah ke form reset (OTP + password baru)
        if (forgotContainer) forgotContainer.style.display = "none";
        if (resetContainer) resetContainer.style.display = "block";

        showAlert("Kode OTP telah dikirim ke email kamu!", "success");
      } catch (err) {
        console.error("❌ FETCH ERROR SEND OTP:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================================
  //  C. LUPA PASSWORD – STEP 2:
  //     VERIFIKASI OTP + RESET PASSWORD
  // ============================================
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // email diambil dari hidden input (hasil step 1)
      const email =
        document.getElementById("resetEmail")?.value.trim() ||
        document.getElementById("forgotEmail")?.value.trim() ||
        "";

      const otp = document.getElementById("resetOtp")?.value?.trim();
      const newPassword = document.getElementById("newPassword")?.value;
      const confirmNewPassword = document.getElementById("confirmNewPassword")?.value;

      if (!email || !otp || !newPassword || !confirmNewPassword) {
        showAlert("Email, OTP, dan kedua kolom password wajib diisi!", "warning");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        showAlert("Password baru dan konfirmasi tidak sama!", "error");
        return;
      }

      if (newPassword.length < 8) {
        showAlert("Password minimal 8 karakter!", "warning");
        return;
      }

      // 1) VERIFIKASI OTP (SAMA SEPERTI DI regis.js)
      try {
        console.log("📤 SENDING OTP VERIFY (forgot password):", { email, otp });

        const verifyRes = await fetch(`${apiBase}${VERIFY_EMAIL_ENDPOINT}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, otp }),
        });

        const verifyText = await verifyRes.text();
        console.log("📥 RAW RESPONSE VERIFY (forgot):", verifyRes.status, verifyText);

        let verifyData = {};
        try {
          verifyData = JSON.parse(verifyText);
        } catch {
          verifyData = { error: verifyText };
        }

        console.log("📥 PARSED RESPONSE VERIFY (forgot):", verifyData);

        if (!verifyRes.ok) {
          showAlert(
            verifyData.error || verifyData.message || "OTP salah!",
            "error"
          );
          return;
        }
      } catch (err) {
        console.error("❌ FETCH ERROR VERIFY OTP (forgot):", err);
        showAlert("Gagal terhubung ke server saat verifikasi OTP.", "error");
        return;
      }

      // 2) OTP VALID → KIRIM PERMINTAAN RESET PASSWORD
      try {
        const res = await fetch(`${apiBase}${RESET_PASSWORD_ENDPOINT}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            new_password: newPassword,
          }),
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        console.log("📥 RESPONSE RESET PASSWORD:", res.status, text);

        if (!res.ok) {
          showAlert(data.error || data.message || "Gagal reset password!", "error");
          return;
        }

        Swal.fire({
          icon: "success",
          title: "Password berhasil diubah",
          text: "Silakan login dengan password baru.",
          timer: 2500,
          showConfirmButton: false,
        }).then(() => {
          if (resetContainer) resetContainer.style.display = "none";
          if (loginFormContainer) loginFormContainer.style.display = "block";
        });
      } catch (err) {
        console.error("❌ FETCH ERROR RESET PASSWORD:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================================
  //  BAGIAN LAMA: REGISTER + OTP (TETAP DIPERTAHANKAN)
  // ============================================
  const registerForm = document.getElementById("registerForm");
  const otpForm = document.getElementById("otpForm");

  const registerContainer = document.getElementById("register-form-container");
  const otpContainer = document.getElementById("otp-form-container");
  const backToRegisterBtn = document.getElementById("back-to-register");

  // ... (bagian register & tanya.html tetap sama seperti yang kamu kirim)
});

// ============================================================
// ⭐ GOOGLE REGISTER BUTTON (KODE LAMA – DIPERTAHANKAN)
// ============================================================
const googleRegisBtn = document.getElementById("googleRegisBtn");

if (googleRegisBtn) {
  googleRegisBtn.addEventListener("click", () => {
    localStorage.setItem("googleRegisterMode", "yes"); // tandai ini register
    window.location.href = "http://localhost:8080/auth/google/login";
  });
}

// ============================================================
// ⭐ HANDLE CALLBACK GOOGLE — FIX: OTP MUNCUL DULU
// ============================================================
(function () {
  const url = new URLSearchParams(window.location.search);

  const googleEmail = url.get("email");
  const googleToken = url.get("token");
  const googleError = url.get("error");

  // apakah user datang dari tombol REGISTER google?
  const isGoogleRegister = localStorage.getItem("googleRegisterMode") === "yes";

  // jika error dari backend
  if (googleError) {
    showAlert(googleError, "error");
    return;
  }

  // 1. GOOGLE REGISTER MODE — WAJIB OTP & JANGAN LOGIN
  if (isGoogleRegister && googleEmail) {
    console.log("📌 GOOGLE REGISTER MODE. Email:", googleEmail);

    // Minta backend kirim OTP ke email Google
    fetch("http://localhost:8080" + SEND_OTP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: googleEmail }),
    });

    // Tampilkan form OTP
    const registerContainer = document.getElementById("register-form-container");
    const otpContainer = document.getElementById("otp-form-container");

    if (registerContainer) registerContainer.style.display = "none";
    if (otpContainer) otpContainer.style.display = "block";

    const otpEmailInput = document.getElementById("otpEmail");
    if (otpEmailInput) otpEmailInput.value = googleEmail;

    localStorage.setItem("pendingGoogleEmail", googleEmail);

    showAlert("Kode OTP telah dikirim ke email Anda!", "success");

    return; // ❗ STOP — jangan eksekusi login
  }

  // 2. GOOGLE LOGIN MODE — MASUK KE INDEX
  if (googleToken) {
    console.log("📌 GOOGLE LOGIN MODE. Token diterima");

    localStorage.setItem("token", googleToken);

    showAlert("Login berhasil!", "success");

    setTimeout(() => {
      window.location.href = "../index.html";
    }, 800);

    return;
  }
})();

// ============================================================
// ⭐ VERIFIKASI OTP GOOGLE REGISTER
// ============================================================
const verifyGoogleOtpBtn = document.getElementById("verifyGoogleOtpBtn");

if (verifyGoogleOtpBtn) {
  verifyGoogleOtpBtn.addEventListener("click", () => {
    const email = localStorage.getItem("pendingGoogleEmail");
    const otp = document.getElementById("otpInput").value;

    if (!otp) {
      showAlert("Masukkan kode OTP!", "error");
      return;
    }

    fetch("http://localhost:8080" + VERIFY_EMAIL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, otp: otp }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("📥 RESPONSE VERIFY:", data);

        if (data.error) {
          showAlert(data.error, "error");
          return;
        }

        // OTP VALID
        showAlert("Verifikasi berhasil! Silakan login.", "success");

        // Hapus mode register
        localStorage.removeItem("pendingGoogleEmail");
        localStorage.removeItem("googleRegisterMode");

        setTimeout(() => {
          window.location.href = "../login.html";
        }, 900);
      })
      .catch((err) => console.error(err));
  });
}
