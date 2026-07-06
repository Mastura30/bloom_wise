document.addEventListener("DOMContentLoaded", function () {
  // Password toggle functionality
  function setupPasswordToggle() {
    const passwordField = document.getElementById("password");
    const toggleButton = document.querySelector(".toggle-password");

    if (passwordField && toggleButton) {
      toggleButton.addEventListener("click", () => {
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

  setupPasswordToggle();
});
