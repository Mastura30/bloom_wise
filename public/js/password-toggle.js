document.addEventListener("DOMContentLoaded", function () {
  // Password toggle functionality
  function setupPasswordToggle() {
    const toggleButtons = document.querySelectorAll(".toggle-password");

    toggleButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const input = this.previousElementSibling;
        if (input.type === "password") {
          input.type = "text";
          this.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
          input.type = "password";
          this.innerHTML = '<i class="fas fa-eye"></i>';
        }
      });
    });
  }

  setupPasswordToggle();
});
