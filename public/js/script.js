document.addEventListener("DOMContentLoaded", function () {
  // Navbar smooth scrolling
  document.querySelectorAll('nav a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();

      // Update active class
      document.querySelectorAll("nav a").forEach((a) => {
        a.classList.remove("active");
      });
      this.classList.add("active");

      // Scroll to target
      const targetId = this.getAttribute("href");
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        window.scrollTo({
          top: targetElement.offsetTop - 80,
          behavior: "smooth",
        });
      }
    });
  });

  // Step-by-step pyramid animation
  const pyramid = document.getElementById("pyramid");
  if (pyramid) {
    const levels = pyramid.querySelectorAll(".pyramid-level");

    // Observer for pyramid animation
    const pyramidObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animate levels one by one from bottom to top
            levels.forEach((level, index) => {
              setTimeout(() => {
                level.classList.add("visible");
                level.style.animation = `buildPyramid 0.5s ease-out forwards`;
              }, (levels.length - index) * 500);
            });

            // Stop observing after animation
            pyramidObserver.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    pyramidObserver.observe(pyramid);
  }

  // Observer for levels section animation
  const levelsSection = document.querySelector(".levels-section");
  if (levelsSection) {
    const levelCards = document.querySelectorAll(".level-card");

    const levelsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animate cards one by one with staggered delays
            levelCards.forEach((card, index) => {
              setTimeout(() => {
                if (index % 2 === 0) {
                  card.classList.add("animate-right");
                } else {
                  card.classList.add("animate-left");
                }
              }, index * 200); // 200ms delay between each card
            });

            // Stop observing after animation
            levelsObserver.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    levelsObserver.observe(levelsSection);
  }

  // Update active nav link on scroll
  const sections = document.querySelectorAll("section, footer");
  window.addEventListener("scroll", () => {
    // Fixed the extra character
    let current = "";

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (
        scrollY >= sectionTop - 100 &&
        scrollY < sectionTop + sectionHeight - 100
      ) {
        current = section.id;
      }
    });

    document.querySelectorAll("nav a").forEach((a) => {
      a.classList.remove("active");
      if (a.getAttribute("href") === `#${current}`) {
        a.classList.add("active");
      }
    });
  });

  // Quiz functionality
  const quizOptions = document.querySelectorAll(".quiz-option");
  const quizResult = document.getElementById("quizResult");
  const nextBtn = document.getElementById("nextQuestion");
  const quizQuestion = document.getElementById("quizQuestion");

  if (quizOptions.length > 0) {
    // Sample quiz questions
    const quizQuestions = [
      {
        question: "What was the main cause of World War I?",
        level: "remember",
      },
      {
        question:
          "How would you apply Newton's laws to explain why a rocket moves upward?",
        level: "apply",
      },
      {
        question:
          "Design a sustainable city for the year 2050 considering current environmental challenges.",
        level: "create",
      },
      {
        question:
          "Compare and contrast the economic systems of capitalism and socialism.",
        level: "analyze",
      },
      {
        question:
          "Do you think social media has had a net positive or negative impact on society? Justify your position.",
        level: "evaluate",
      },
    ];

    let currentQuestion = 0;
    let selectedOption = null;

    quizOptions.forEach((option) => {
      option.addEventListener("click", () => {
        // Remove previous selection
        quizOptions.forEach((opt) => opt.classList.remove("selected"));

        // Select this option
        option.classList.add("selected");
        selectedOption = option.dataset.level;

        // Check answer
        const correctLevel = quizQuestions[currentQuestion].level;
        if (selectedOption === correctLevel) {
          quizResult.textContent =
            "Correct! This question targets the '" +
            correctLevel +
            "' level of Bloom's Taxonomy.";
          quizResult.className = "quiz-result correct";
        } else {
          quizResult.textContent =
            "Not quite. This question targets the '" +
            correctLevel +
            "' level. The '" +
            selectedOption +
            "' level would involve different cognitive processes.";
          quizResult.className = "quiz-result incorrect";
        }

        // Show next button
        nextBtn.style.display = "block";
      });
    });

    nextBtn.addEventListener("click", () => {
      // Move to next question
      currentQuestion = (currentQuestion + 1) % quizQuestions.length;
      quizQuestion.textContent = quizQuestions[currentQuestion].question;

      // Reset UI
      quizOptions.forEach((opt) => opt.classList.remove("selected"));
      quizResult.className = "quiz-result";
      quizResult.textContent = "";
      nextBtn.style.display = "none";
      selectedOption = null;
    });
  }

  // Question analyzer functionality
  const analyzeBtn = document.getElementById("analyzeBtn");
  const questionInput = document.getElementById("questionInput");
  const analyzerResult = document.getElementById("analyzerResult");

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", () => {
      const question = questionInput.value.trim();

      if (!question) {
        analyzerResult.textContent = "Please enter a question to analyze.";
        analyzerResult.style.display = "block";
        return;
      }

      // Simple analysis based on keywords (in a real app this would use NLP)
      const level = analyzeQuestionLevel(question);
      const levelNames = {
        remember: "Remember",
        understand: "Understand",
        apply: "Apply",
        analyze: "Analyze",
        evaluate: "Evaluate",
        create: "Create",
      };

      analyzerResult.innerHTML = `
            <strong>Question:</strong> ${question}<br><br>
            <strong>Bloom's Level:</strong> ${levelNames[level]}<br><br>
            <strong>Explanation:</strong> This question requires students to ${level} knowledge. 
            ${getLevelDescription(level)}
          `;
      analyzerResult.style.display = "block";
    });
  }

  function analyzeQuestionLevel(question) {
    // This is a simplified version - a real implementation would use NLP
    const lowerQuestion = question.toLowerCase();

    if (
      lowerQuestion.includes("create") ||
      lowerQuestion.includes("design") ||
      lowerQuestion.includes("invent") ||
      lowerQuestion.includes("compose")
    ) {
      return "create";
    }

    if (
      lowerQuestion.includes("evaluate") ||
      lowerQuestion.includes("judge") ||
      lowerQuestion.includes("critique") ||
      lowerQuestion.includes("justify")
    ) {
      return "evaluate";
    }

    if (
      lowerQuestion.includes("analyze") ||
      lowerQuestion.includes("compare") ||
      lowerQuestion.includes("contrast") ||
      lowerQuestion.includes("categorize")
    ) {
      return "analyze";
    }

    if (
      lowerQuestion.includes("apply") ||
      lowerQuestion.includes("use") ||
      lowerQuestion.includes("demonstrate") ||
      lowerQuestion.includes("solve")
    ) {
      return "apply";
    }

    if (
      lowerQuestion.includes("explain") ||
      lowerQuestion.includes("interpret") ||
      lowerQuestion.includes("summarize") ||
      lowerQuestion.includes("paraphrase")
    ) {
      return "understand";
    }

    return "remember";
  }

  function getLevelDescription(level) {
    const descriptions = {
      remember: "Students need to recall facts, terms, or basic concepts.",
      understand:
        "Students demonstrate comprehension by explaining ideas or concepts.",
      apply: "Students use information in new situations to solve problems.",
      analyze:
        "Students draw connections among ideas and break information into parts.",
      evaluate:
        "Students justify a stand or decision and assess information critically.",
      create: "Students produce new or original work by combining elements.",
    };
    return descriptions[level];
  }

  // Hamburger menu functionality
  const hamburger = document.getElementById("hamburgerMenu");
  const mobileNav = document.getElementById("mobileNav");
  const overlay = document.getElementById("overlay");
  const closeMenu = document.getElementById("closeMenu");

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      mobileNav.classList.add("active");
      overlay.classList.add("active");
      closeMenu.style.display = "block";
      document.body.style.overflow = "hidden";
    });
  }

  if (closeMenu) {
    closeMenu.addEventListener("click", closeMobileMenu);
  }

  if (overlay) {
    overlay.addEventListener("click", closeMobileMenu);
  }

  function closeMobileMenu() {
    mobileNav.classList.remove("active");
    overlay.classList.remove("active");
    closeMenu.style.display = "none";
    document.body.style.overflow = "auto";
  }

  // Mobile navigation links
  const mobileLinks = document.querySelectorAll(".mobile-nav a");
  mobileLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMobileMenu();
    });
  });
});
