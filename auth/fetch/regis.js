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
  const registerForm = document.getElementById("registerForm");
  const otpForm = document.getElementById("otpForm");

  const registerContainer = document.getElementById("register-form-container");
  const otpContainer = document.getElementById("otp-form-container");
  const backToRegisterBtn = document.getElementById("back-to-register");

  const apiBase = "http://localhost:8080";

  // ============================================
  //  LANGKAH 1: REGISTER (PERMINTAAN OTP)
  // ============================================
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("regUsername")?.value.trim();
      const email = document.getElementById("regEmail")?.value.trim();
      const password = document.getElementById("regPassword")?.value;
      const confirmPassword = document.getElementById("regConfirmPassword")?.value;

      if (!username || !email || !password || !confirmPassword) {
        showAlert("Semua field wajib diisi!", "warning");
        return;
      }

      if (password !== confirmPassword) {
        showAlert("Password tidak cocok!", "error");
        return;
      }

      if (password.length < 8) {
        showAlert("Password minimal 8 karakter!", "warning");
        return;
      }

      console.log("📤 SENDING REGISTER PAYLOAD:", {
        username,
        email,
        password,
        confirm_password: confirmPassword,
      });

      try {
        const res = await fetch(`${apiBase}/auth/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            email,
            password,
            confirm_password: confirmPassword,
          }),
        });

        const text = await res.text();
        console.log("📥 RAW RESPONSE REGISTER:", text);

        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }

        console.log("📥 PARSED RESPONSE REGISTER:", data);

        if (!res.ok) {
          showAlert(data.error || data.message || "Gagal mendaftar!", "error");
          return;
        }

        // SIMPAN EMAIL UNTUK OTP
        document.getElementById("otpEmail").value = email;

        registerContainer.style.display = "none";
        otpContainer.style.display = "block";

        showAlert("Kode OTP telah dikirim ke email Anda!", "success");

      } catch (err) {
        console.error("❌ FETCH ERROR REGISTER:", err);
        showAlert("Gagal terhubung ke server.", "error");
      }
    });
  }

  // ============================================
  //  LANGKAH 2: VERIFIKASI OTP (PERBARUI FORMAT)
  // ============================================
if (otpForm) {
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("otpEmail")?.value.trim();
    const otp = document.getElementById("otpCode")?.value.trim();

    if (!email || !otp) {
      showAlert("Email dan kode OTP wajib diisi!", "warning");
      return;
    }

    console.log("📤 SENDING OTP VERIFY:", { email, otp });

    // Gunakan JSON.stringify
    const payload = { email, otp };

    try {
      const res = await fetch(`${apiBase}/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      console.log("📥 RAW RESPONSE VERIFY:", text);

      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }

      console.log("📥 PARSED RESPONSE VERIFY:", data);

      if (!res.ok) {
        showAlert(data.error || data.message || "OTP salah!", "error");
        return;
      }

      Swal.fire({
        icon: "success",
        title: "Verifikasi Berhasil!",
        text: "Akun Anda telah aktif. Silakan login.",
        timer: 2500,
        showConfirmButton: false,
      }).then(() => {
        window.location.href = "login.html"; // redirect ke login
      });

    } catch (err) {
      console.error("❌ FETCH ERROR VERIFY:", err);
      showAlert("Gagal terhubung ke server.", "error");
    }
  });
}
  // ============================================
  //  KEMBALI KE REGISTER
  // ============================================
  if (backToRegisterBtn) {
    backToRegisterBtn.addEventListener("click", () => {
      otpContainer.style.display = "none";
      registerContainer.style.display = "block";
      document.getElementById("otpCode").value = "";
    });
  }
});
