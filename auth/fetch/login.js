// ===============================
// GLOBAL CONFIG (biar bisa dipakai semua blok)
// ===============================
const apiBase = "http://localhost:8080";

const SEND_OTP_ENDPOINT = "/auth/send-otp";
const VERIFY_EMAIL_ENDPOINT = "/auth/verify-email";
const RESET_PASSWORD_ENDPOINT = "/jaksa/auth/reset-password-jaksa";
const LOGIN_ENDPOINT = "/auth/login";

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

// ===============================
// Helpers redirect
// ===============================
function safeRedirectTarget(raw) {
  if (!raw) return null;
  // hanya allow path internal
  if (raw.startsWith("/")) return raw;
  return null;
}

function getRedirectTargetFromUrlOrSession() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = safeRedirectTarget(params.get("redirect"));
    if (fromQuery) return fromQuery;

    const fromSession = safeRedirectTarget(sessionStorage.getItem("redirectAfterLogin"));
    if (fromSession) return fromSession;
  } catch (_) {}
  return null;
}

function clearRedirectSession() {
  try {
    sessionStorage.removeItem("redirectAfterLogin");
  } catch (_) {}
}

function extractRoleFromResponse(data, token) {
  let role =
    data.role ||
    data.user?.role ||
    data.data?.role ||
    (Array.isArray(data.roles) ? data.roles[0] : null);

  if (!role && token && token.split(".").length === 3) {
    try {
      const payloadStr = atob(token.split(".")[1]);
      const payload = JSON.parse(payloadStr);
      role = payload.role || payload.roles?.[0] || payload.authorities?.[0] || null;
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
  return "/index.html";
}

function finalizeLoginRedirect(role) {
  const redirectTarget = getRedirectTargetFromUrlOrSession();
  clearRedirectSession();

  const fallback = getRedirectByRole(role);
  window.location.href = redirectTarget || fallback;
}

// ===============================
// MAIN DOM READY
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  // ELEMEN LOGIN & RESET PASSWORD
  const loginForm = document.getElementById("loginForm");
  const loginFormContainer = document.getElementById("login-form-container");

  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const forgotContainer = document.getElementById("forgot-password-container");
  const backToLoginBtn = document.getElementById("back-to-login");

  const resetContainer = document.getElementById("reset-password-container");
  const resetPasswordForm = document.getElementById("resetPasswordForm");
  const backToForgotBtn = document.getElementById("back-to-forgot");

  const forgotForm = document.getElementById("forgotPasswordForm");
  const resetEmailInput = document.getElementById("resetEmail");

  // ============================
  // A. LOGIN MANUAL
  // ============================
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
          headers: { "Content-Type": "application/json" },
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

        const token = data.token || data.access_token || data.data?.token || null;
        if (token) localStorage.setItem("token", token);

        const role = extractRoleFromResponse(data, token);
        if (role) localStorage.setItem("role", role);

        showAlert("Login berhasil!", "success");

        setTimeout(() => finalizeLoginRedirect(role), 600);
      } catch (err) {
        console.error("❌ FETCH ERROR LOGIN:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================
  // B. LUPA PASSWORD (tetap)
  // ============================
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (loginFormContainer) loginFormContainer.style.display = "none";
      if (resetContainer) resetContainer.style.display = "none";
      if (forgotContainer) forgotContainer.style.display = "block";
    });
  }

  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      if (forgotContainer) forgotContainer.style.display = "none";
      if (resetContainer) resetContainer.style.display = "none";
      if (loginFormContainer) loginFormContainer.style.display = "block";
    });
  }

  if (backToForgotBtn) {
    backToForgotBtn.addEventListener("click", () => {
      if (resetContainer) resetContainer.style.display = "none";
      if (loginFormContainer) loginFormContainer.style.display = "none";
      if (forgotContainer) forgotContainer.style.display = "block";
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgotEmail")?.value.trim();

      if (!email) {
        showAlert("Email wajib diisi!", "warning");
        return;
      }

      try {
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

        if (!res.ok) {
          showAlert(data.error || data.message || "Gagal mengirim OTP!", "error");
          return;
        }

        if (resetEmailInput) resetEmailInput.value = email;

        if (forgotContainer) forgotContainer.style.display = "none";
        if (resetContainer) resetContainer.style.display = "block";

        showAlert("Kode OTP telah dikirim ke email kamu!", "success");
      } catch (err) {
        console.error("❌ FETCH ERROR SEND OTP:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

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

      // verify otp
      try {
        const verifyRes = await fetch(`${apiBase}${VERIFY_EMAIL_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        });

        const verifyText = await verifyRes.text();
        let verifyData = {};
        try {
          verifyData = JSON.parse(verifyText);
        } catch {
          verifyData = { error: verifyText };
        }

        if (!verifyRes.ok) {
          showAlert(verifyData.error || verifyData.message || "OTP salah!", "error");
          return;
        }
      } catch (err) {
        console.error("❌ VERIFY OTP ERROR:", err);
        showAlert("Gagal terhubung ke server saat verifikasi OTP.", "error");
        return;
      }

      // reset password
      try {
        const res = await fetch(`${apiBase}${RESET_PASSWORD_ENDPOINT}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, new_password: newPassword }),
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

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
        console.error("❌ RESET PASSWORD ERROR:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================
  // GOOGLE BUTTONS
  // ============================
  const googleRegisBtn = document.getElementById("googleRegisBtn");
  if (googleRegisBtn) {
    googleRegisBtn.addEventListener("click", () => {
      localStorage.setItem("googleRegisterMode", "yes");
      window.location.href = `${apiBase}/auth/google/login`;
    });
  }

  // ✅ tambahan: Google Login (bukan register)
  const googleLoginBtn = document.getElementById("googleLoginBtn");
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", () => {
      localStorage.removeItem("googleRegisterMode"); // login mode
      window.location.href = `${apiBase}/auth/google/login`;
    });
  }
});

// ===============================
// GOOGLE CALLBACK HANDLER
// ===============================
(function () {
  const params = new URLSearchParams(window.location.search);

  const googleEmail = params.get("email");
  const googleToken = params.get("token");
  const googleError = params.get("error");

  const isGoogleRegister = localStorage.getItem("googleRegisterMode") === "yes";

  if (googleError) {
    showAlert(googleError, "error");
    return;
  }

  // 1) GOOGLE REGISTER MODE -> kirim OTP, tampilkan OTP form
  if (isGoogleRegister && googleEmail && !googleToken) {
    fetch(`${apiBase}${SEND_OTP_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: googleEmail }),
    }).catch(() => {});

    const registerContainer = document.getElementById("register-form-container");
    const otpContainer = document.getElementById("otp-form-container");

    if (registerContainer) registerContainer.style.display = "none";
    if (otpContainer) otpContainer.style.display = "block";

    const otpEmailInput = document.getElementById("otpEmail");
    if (otpEmailInput) otpEmailInput.value = googleEmail;

    localStorage.setItem("pendingGoogleEmail", googleEmail);

    showAlert("Kode OTP telah dikirim ke email Anda!", "success");
    return;
  }

  // 2) GOOGLE LOGIN MODE -> simpan token, redirect balik
  if (googleToken) {
    localStorage.setItem("token", googleToken);

    // optional: coba ambil role dari token
    let role = null;
    try {
      if (googleToken.split(".").length === 3) {
        const payload = JSON.parse(atob(googleToken.split(".")[1]));
        role = payload.role || payload.roles?.[0] || null;
      }
    } catch (_) {}

    if (role) localStorage.setItem("role", role);

    showAlert("Login Google berhasil!", "success");

    setTimeout(() => finalizeLoginRedirect(role), 600);
  }
})();

// ===============================
// VERIFY OTP GOOGLE REGISTER (tetap ada)
// ===============================
const verifyGoogleOtpBtn = document.getElementById("verifyGoogleOtpBtn");

if (verifyGoogleOtpBtn) {
  verifyGoogleOtpBtn.addEventListener("click", () => {
    const email = localStorage.getItem("pendingGoogleEmail");
    const otp = document.getElementById("otpInput")?.value?.trim();

    if (!otp) {
      showAlert("Masukkan kode OTP!", "error");
      return;
    }

    fetch(`${apiBase}${VERIFY_EMAIL_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    })
      .then((res) => res.text())
      .then((text) => {
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }

        if (data.error) {
          showAlert(data.error, "error");
          return;
        }

        showAlert("Verifikasi berhasil! Silakan login.", "success");

        localStorage.removeItem("pendingGoogleEmail");
        localStorage.removeItem("googleRegisterMode");

        setTimeout(() => {
          window.location.href = "../login.html";
        }, 900);
      })
      .catch((err) => {
        console.error(err);
        showAlert("Gagal verifikasi OTP.", "error");
      });
  });
}
