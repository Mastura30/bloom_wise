// Password toggle functionality for both password fields
document.addEventListener("DOMContentLoaded", function () {
  // Function to setup password toggle
  function setupPasswordToggle(passwordId, toggleId) {
    const passwordField = document.getElementById(passwordId);
    const toggleButton = document.getElementById(toggleId);

    if (passwordField && toggleButton) {
      toggleButton.addEventListener("click", function () {
        if (passwordField.type === "password") {
          passwordField.type = "text";
          toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
          passwordField.type = "password";
          toggleButton.innerHTML = '<i class="fas fa-eye"></i>';
        }
      });
    }
  }

  // Setup toggles for both password fields
  setupPasswordToggle("password", "togglePassword");
  setupPasswordToggle("confirmPassword", "toggleConfirmPassword");

  // Form validation
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (!name || !email || !password || !confirmPassword) {
        e.preventDefault();
        alert("Please fill in all required fields");
        return false;
      }

      if (password.length < 6) {
        e.preventDefault();
        alert("Password must be at least 6 characters");
        return false;
      }

      if (password !== confirmPassword) {
        e.preventDefault();
        alert("Passwords do not match");
        return false;
      }
    });
  }
});
