/* BloomWise – Multi-format Upload + Camera OCR + Bloom Analysis
   - PDF text extraction (pdf.js)
   - DOCX & PPTX extraction (JSZip + XML parse)
   - Image OCR (Tesseract.js) + camera capture
   - Manual analyzer, chart, table, CSV export, saved classes
*/

const $ = (q) => document.querySelector(q);
const els = {
  grade: $("#grade"),
  subject: $("#subject"),
  topic: $("#topic"),
  saveClassBtn: $("#saveClassBtn"),
  questionInput: $("#questionInput"),
  analyzeBtn: $("#analyzeBtn"),
  addAnotherBtn: $("#addAnotherBtn"),
  analysisResult: $("#analysisResult"),
  fileInput: $("#fileInput"),
  extractBtn: $("#extractBtn"),
  cameraToggle: $("#cameraToggle"),
  captureBtn: $("#captureBtn"),
  cameraStream: $("#cameraStream"),
  captureCanvas: $("#captureCanvas"),
  ocrStatus: $("#ocrStatus"),
  ocrOutput: $("#ocrOutput"),
  analyzeExtractedBtn: $("#analyzeExtractedBtn"),
  resultsTable: document.querySelector("#resultsTable tbody"),
  clearResultsBtn: $("#clearResultsBtn"),
  downloadCSVBtn: $("#downloadCSVBtn"),
  welcomeName: $("#welcomeName"),
  classesContainer: $("#classesContainer"),
  classDistributionChart: $("#classDistributionChart"),
  subjectDistributionChart: $("#subjectDistributionChart"),
};

// Get user ID from hidden field
const userId = document.getElementById("userId").value;

let mediaStream = null;
let results = [];
let coverageChart = null;

/* ---------------- API Functions ---------------- */
// Load user data from server
async function loadUserData() {
  try {
    const response = await fetch("/api/user-data");
    const data = await response.json();

    // Load analysis results
    results = data.analysisResults || [];
    renderResultsTable();
    updateChart();
  } catch (error) {
    console.error("Failed to load user data:", error);
  }
}

// Save class to server
async function saveClassToServer(grade, subject, topic) {
  try {
    const response = await fetch("/api/save-class", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ grade, subject, topic }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Failed to save class:", error);
    return false;
  }
}

// Save result to server
async function saveResultToServer(text, level, suggestion) {
  try {
    const response = await fetch("/api/save-result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, level, suggestion }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Failed to save result:", error);
    return false;
  }
}

// Clear all results from server
async function clearResultsFromServer() {
  try {
    const response = await fetch("/api/clear-results", {
      method: "POST",
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Failed to clear results:", error);
    return false;
  }
}

// Load classes from server
async function loadClasses() {
  try {
    const response = await fetch("/api/classes");
    if (!response.ok) throw new Error("Failed to load classes");
    const classes = await response.json();
    renderClasses(classes);
    updateClassCharts(classes);
  } catch (error) {
    console.error("Failed to load classes:", error);
    els.classesContainer.innerHTML =
      '<div class="no-classes">Failed to load classes</div>';
  }
}

// Render classes in the UI
function renderClasses(classes) {
  if (classes.length === 0) {
    els.classesContainer.innerHTML =
      '<div class="no-classes">No classes saved yet. Add your first class above!</div>';
    return;
  }

  els.classesContainer.innerHTML = classes
    .map(
      (cls) => `
    <div class="class-card">
      <button class="delete-class" data-id="${cls._id}">
        <i class="fas fa-trash"></i>
      </button>
      <h3>${escapeHTML(cls.topic)}</h3>
      <p><strong>Grade:</strong> ${escapeHTML(cls.grade)}</p>
      <p><strong>Subject:</strong> ${escapeHTML(cls.subject)}</p>
      <p class="muted">Added on ${new Date(cls.ts).toLocaleDateString()}</p>
    </div>
  `
    )
    .join("");

  // Add event listeners to delete buttons
  document.querySelectorAll(".delete-class").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const classId = btn.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this class?")) {
        await deleteClass(classId);
      }
    });
  });
}

// Delete a class
async function deleteClass(classId) {
  try {
    const response = await fetch(`/api/class/${classId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      loadClasses(); // Reload the classes
    } else {
      alert("Failed to delete class");
    }
  } catch (error) {
    console.error("Delete error:", error);
    alert("Failed to delete class");
  }
}

// Initialize class distribution charts
function initClassCharts() {
  window.classDistributionChart = new Chart(els.classDistributionChart, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Classes by Grade",
          data: [],
          backgroundColor: "#7fded9ff",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });

  window.subjectDistributionChart = new Chart(els.subjectDistributionChart, {
    type: "pie",
    data: {
      labels: [],
      datasets: [
        {
          label: "Classes by Subject",
          data: [],
          backgroundColor: [
            "#b091ceff",
            "#7b53a3ff",
            "#7878a5ff",
            "#75b38fff",
            "#62d2d4ff",
            "#dfe087ff",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

// Update class distribution charts
function updateClassCharts(classes) {
  // Group by grade
  const gradeCounts = {};
  const subjectCounts = {};

  classes.forEach((cls) => {
    gradeCounts[cls.grade] = (gradeCounts[cls.grade] || 0) + 1;
    subjectCounts[cls.subject] = (subjectCounts[cls.subject] || 0) + 1;
  });

  // Update grade distribution chart
  window.classDistributionChart.data.labels = Object.keys(gradeCounts);
  window.classDistributionChart.data.datasets[0].data =
    Object.values(gradeCounts);
  window.classDistributionChart.update();

  // Update subject distribution chart
  window.subjectDistributionChart.data.labels = Object.keys(subjectCounts);
  window.subjectDistributionChart.data.datasets[0].data =
    Object.values(subjectCounts);
  window.subjectDistributionChart.update();
}

// Update the save class function to reload classes after saving
els.saveClassBtn.addEventListener("click", async () => {
  const grade = els.grade.value,
    subject = els.subject.value,
    topic = els.topic.value.trim();
  if (!grade || !subject || !topic) {
    alert("Please choose grade, subject, and topic.");
    return;
  }

  // Save to server ONLY
  const success = await saveClassToServer(grade, subject, topic);
  if (success) {
    loadClasses(); // Reload the classes from server
    els.topic.value = "";
  } else {
    alert("Failed to save class. Please try again.");
  }
});

// Initialize classes and class charts on page load
document.addEventListener("DOMContentLoaded", function () {
  initChart();
  initClassCharts();
  loadUserData();
  loadClasses(); // Load classes on page load

  // Add click event listener to logout link
  document
    .querySelector('a[href="/logout"]')
    .addEventListener("click", function (e) {
      if (!confirm("Are you sure you want to log out?")) {
        e.preventDefault();
      }
    });
});

/* ---------------- Chart ---------------- */
function initChart() {
  const ctx = document.getElementById("coverageChart");
  coverageChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: [
        "Remember",
        "Understand",
        "Apply",
        "Analyze",
        "Evaluate",
        "Create",
      ],
      datasets: [
        {
          label: "Coverage",
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: [
            "#5600ac", // Remember
            "#800080", // Understand
            "#0000cd", // Apply
            "#1e90ff", // Analyze
            "#028d8f", // Evaluate
            "#04eafb", // Create
          ],
          borderWidth: 1,
        },
      ],
    },
    options: { plugins: { legend: { position: "bottom" } } },
  });
}

function updateChart() {
  const levels = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
  ];
  const counts = levels.map((l) => results.filter((r) => r.level === l).length);
  coverageChart.data.datasets[0].data = counts;
  coverageChart.update();
}

/* ---------------- Manual Analyzer ---------------- */
els.analyzeBtn.addEventListener("click", async () => {
  const text = els.questionInput.value.trim();
  if (!text) return;
  const out = classifyQuestion(text);
  showSingleAnalysis(out);

  // Save to server
  const success = await saveResultToServer(text, out.level, out.suggestion);
  if (success) {
    // Update local data
    addResultRow(text, out.level, out.suggestion);
    updateChart();
  } else {
    alert("Failed to save result. Please try again.");
  }
});

els.addAnotherBtn.addEventListener("click", () => {
  els.analysisResult.classList.add("hidden");
  els.questionInput.value = "";
  els.questionInput.focus();
});

function showSingleAnalysis(res) {
  els.analysisResult.classList.remove("hidden");
  els.analysisResult.innerHTML = `
    <div><strong>Level:</strong> <span class="level level-${res.level}">${res.level}</span></div>
    <div class="muted">${res.reason}</div>
    <div class="muted"><strong>Tip:</strong> ${res.suggestion}</div>`;
}

/* ---------------- Results Table ---------------- */
function addResultRow(text, level, suggestion) {
  const id = results.length + 1;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${id}</td>
    <td>${escapeHTML(text)}</td>
    <td><span class="level level-${level}">${level}</span></td>
    <td>${escapeHTML(suggestion)}</td>`;
  els.resultsTable.appendChild(tr);
  results.push({ id, text, level, suggestion });
}

function renderResultsTable() {
  els.resultsTable.innerHTML = "";
  results.forEach((result) => {
    addResultRow(result.text, result.level, result.suggestion);
  });
}

els.clearResultsBtn.addEventListener("click", async () => {
  if (!confirm("Clear all results and chart?")) return;

  // Clear from server
  const success = await clearResultsFromServer();
  if (success) {
    // Clear local data
    results = [];
    els.resultsTable.innerHTML = "";
    updateChart();
  } else {
    alert("Failed to clear results. Please try again.");
  }
});

els.downloadCSVBtn.addEventListener("click", () => {
  if (results.length === 0) {
    alert("No results to download.");
    return;
  }
  const header = ["No", "Question", "Bloom Level", "Suggestion"];
  const rows = results.map((r) => [
    r.id,
    r.text.replace(/\n/g, " "),
    r.level,
    r.suggestion.replace(/\n/g, " "),
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bloomwise_results.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ---------------- Upload: Extract Text ---------------- */
els.extractBtn.addEventListener("click", async () => {
  const f = els.fileInput.files?.[0];
  if (!f) {
    alert("Please choose a file first.");
    return;
  }
  try {
    const ext = fileExt(f.name);
    els.ocrStatus.textContent = `Extracting from ${ext.toUpperCase()}…`;
    let text = "";
    if (ext === "pdf") text = await extractFromPDF(f);
    else if (ext === "docx") text = await extractFromDOCX(f);
    else if (ext === "pptx") text = await extractFromPPTX(f);
    else if (ext === "txt") text = await f.text();
    else if (isImageExt(ext)) text = await ocrImageFile(f);
    else text = "Unsupported file type. Please upload PDF/DOCX/PPTX/TXT/Image.";

    els.ocrOutput.value = (text || "").trim();
    els.ocrStatus.textContent = text ? "Text extracted ✔" : "No text found.";
  } catch (e) {
    console.error(e);
    els.ocrStatus.textContent =
      "Extraction failed. Try a clearer file or different format.";
  }
});

/* ---------------- Camera + OCR ---------------- */
els.cameraToggle.addEventListener("click", async () => {
  if (mediaStream) {
    stopCamera();
    els.cameraToggle.textContent = "Start Camera";
    return;
  }

  try {
    // Request camera access with proper error handling
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    els.cameraStream.srcObject = mediaStream;
    els.cameraToggle.textContent = "Stop Camera";
    els.captureBtn.disabled = false;
  } catch (e) {
    console.error("Camera error:", e);

    // Provide specific error messages based on the error
    if (e.name === "NotAllowedError") {
      alert(
        "Camera permission denied. Please allow camera access in your browser settings."
      );
    } else if (
      e.name === "NotFoundError" ||
      e.name === "OverconstrainedError"
    ) {
      alert("No camera found or camera not available.");
    } else {
      alert(
        "Camera not available or permission denied. Please check your camera settings."
      );
    }

    els.cameraToggle.textContent = "Start Camera";
  }
});

els.captureBtn.addEventListener("click", async () => {
  if (!mediaStream) {
    alert("Start the camera first.");
    return;
  }

  const video = els.cameraStream,
    canvas = els.captureCanvas,
    ctx = canvas.getContext("2d");
  const w = video.videoWidth || 1280,
    h = video.videoHeight || 720;
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  canvas.classList.remove("hidden");

  els.ocrStatus.textContent = "Running OCR…";
  try {
    const worker = await Tesseract.createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(canvas);
    await worker.terminate();
    els.ocrOutput.value = text.trim();
    els.ocrStatus.textContent = "Text extracted ✔";
  } catch (err) {
    console.error(err);
    els.ocrStatus.textContent = "OCR failed. Try better lighting.";
  }
});

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  els.cameraStream.srcObject = null;
  els.captureBtn.disabled = true;
}

/* ---------------- Analyze Extracted ---------------- */
els.analyzeExtractedBtn.addEventListener("click", async () => {
  const raw = els.ocrOutput.value.trim();
  if (!raw) {
    alert("No text to analyze.");
    return;
  }
  const questions = splitIntoQuestions(raw);
  if (questions.length === 0) {
    alert("Could not detect questions. Add line breaks or question marks.");
    return;
  }

  for (const q of questions) {
    const res = classifyQuestion(q);

    // Save to server
    const success = await saveResultToServer(q, res.level, res.suggestion);
    if (success) {
      // Update local data
      addResultRow(q, res.level, res.suggestion);
    }
  }

  updateChart();
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
});

/* ---------------- File parsers ---------------- */
function fileExt(name) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function isImageExt(ext) {
  return ["jpg", "jpeg", "png", "webp", "bmp", "gif"].includes(ext);
}

/* PDF (pdf.js v4, loaded as module earlier) */
async function extractFromPDF(file) {
  try {
    const arrayBuf = await file.arrayBuffer();
    const pdfjs = await import(
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs"
    );
    const loadingTask = pdfjs.getDocument({ data: arrayBuf });
    const pdf = await loadingTask.promise;
    let fullText = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const strings = content.items.map((it) => it.str);
      fullText += strings.join(" ") + "\n";
    }
    return sanitizeSpaces(fullText);
  } catch (error) {
    console.error("PDF extraction error:", error);
    return "Failed to extract text from PDF. The file might be corrupted or password protected.";
  }
}

/* DOCX (zip -> word/document.xml -> <w:t>) */
async function extractFromDOCX(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) throw new Error("Invalid DOCX (document.xml not found)");
    const xml = await docXmlFile.async("text");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const nodes = Array.from(doc.getElementsByTagName("w:t"));
    const text = nodes.map((n) => n.textContent).join(" ");
    return sanitizeSpaces(text);
  } catch (error) {
    console.error("DOCX extraction error:", error);
    return "Failed to extract text from DOCX file.";
  }
}

/* PPTX (zip -> ppt/slides/slide*.xml -> <a:t>) */
async function extractFromPPTX(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    const files = Object.keys(zip.files).filter((p) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(p)
    );
    if (files.length === 0) throw new Error("No slides found in PPTX");
    let out = "";
    for (const path of files.sort()) {
      const xml = await zip.file(path).async("text");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const nodes = Array.from(doc.getElementsByTagName("a:t"));
      const txt = nodes.map((n) => n.textContent).join(" ");
      out += txt + "\n";
    }
    return sanitizeSpaces(out);
  } catch (error) {
    console.error("PPTX extraction error:", error);
    return "Failed to extract text from PPTX file.";
  }
}

/* Image OCR (file) */
async function ocrImageFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const worker = await Tesseract.createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(url);
    await worker.terminate();
    return sanitizeSpaces(text);
  } catch (error) {
    console.error("Image OCR error:", error);
    return "Failed to extract text from image. Please try a clearer image.";
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------------- Text helpers ---------------- */
function sanitizeSpaces(t) {
  return (t || "")
    .replace(/\s+/g, " ")
    .replace(/\s\.\s/g, ". ")
    .trim();
}

function splitIntoQuestions(text) {
  // Split by numbered lists, newlines, or ? punctuation
  const parts = text
    .split(/\n+|(?<=\?)\s+|(?<=\.)\s{2,}/g)
    .map((s) => s.replace(/^\s*\(?\d+[\).:-]?\s*/, "").trim())
    .filter(Boolean);
  // Merge short fragments with next
  const merged = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length < 6 && i < parts.length - 1) {
      merged.push(parts[i] + " " + parts[++i]);
    } else merged.push(parts[i]);
  }
  // Keep lines that look like questions/tasks
  return merged.filter((s) =>
    /[?]|^(define|list|describe|explain|compare|contrast|justify|design|create|evaluate|analy[sz]e|apply|use|show|solve)\b/i.test(
      s
    )
  );
}

function escapeHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function csvEscape(s) {
  if (s == null) return "";
  const needs = /[",\n]/.test(s);
  return needs ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ---------------- Bloom classifier (heuristic) ---------------- */
const bloomMap = {
  Remember: [
    " define ",
    " list ",
    " name ",
    " label ",
    " recall ",
    " identify ",
    " state ",
    " match ",
    " choose ",
    " select ",
    " tell ",
    " when ",
    " where ",
    " who ",
    " what is ",
  ],
  Understand: [
    " explain ",
    " summarize ",
    " describe ",
    " classify ",
    " paraphrase ",
    " outline ",
    " interpret ",
    " give example ",
    " why ",
    " how does ",
    " compare in your own words ",
  ],
  Apply: [
    " use ",
    " illustrate ",
    " demonstrate ",
    " solve ",
    " show ",
    " calculate ",
    " apply ",
    " perform ",
    " implement ",
    " compute ",
  ],
  Analyze: [
    " compare ",
    " contrast ",
    " differentiat",
    " analy",
    " examine ",
    " categorize ",
    " break down ",
    " cause ",
    " effect ",
    " relationship ",
  ],
  Evaluate: [
    " justify ",
    " critique ",
    " argue ",
    " assess ",
    " evaluate ",
    " defend ",
    " appraise ",
    " prioritize ",
    " which is better ",
    " judge ",
  ],
  Create: [
    " design ",
    " compose ",
    " invent ",
    " develop ",
    " construct ",
    " plan ",
    " produce ",
    " propose ",
    " formulate ",
    " create ",
  ],
};

const levelOrder = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

function classifyQuestion(q) {
  const text = ` ${q.toLowerCase()} `.replace(/\s+/g, " ");
  const hits = [];
  for (const [level, keys] of Object.entries(bloomMap)) {
    if (keys.some((k) => text.includes(k))) hits.push(level);
  }
  let level = hits.length
    ? hits
        .sort((a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b))
        .slice(-1)[0]
    : "Understand";
  if (/^\s*(what is|define|name|list|state)\b/i.test(q)) level = "Remember";
  const suggestion = suggestUpgrade(level);
  const reason = `Detected keywords suggest <em>${level}</em> cognitive demand.`;
  return { level, suggestion, reason };
}

function suggestUpgrade(level) {
  switch (level) {
    case "Remember":
      return "Ask for explanation or example to reach Understand.";
    case "Understand":
      return "Add application context to reach Apply.";
    case "Apply":
      return "Ask to compare or find patterns to reach Analyze.";
    case "Analyze":
      return "Ask for judgment/criteria to reach Evaluate.";
    case "Evaluate":
      return "Ask to design or propose to reach Create.";
    case "Create":
      return "Great! Consider constraints or peer review for rigor.";
    default:
      return "Refine the task with clearer verbs and criteria.";
  }
}

/* ---------------- Logout Confirmation ---------------- */
function confirmLogout() {
  return confirm("Are you sure you want to log out?");
}

/* ---------------- Initialize ---------------- */
document.addEventListener("DOMContentLoaded", function () {
  initChart();
  loadUserData();

  // Add click event listener to logout link
  document
    .querySelector('a[href="/logout"]')
    .addEventListener("click", function (e) {
      if (!confirm("Are you sure you want to log out?")) {
        e.preventDefault();
      }
    });

  // Disable capture button initially
  els.captureBtn.disabled = true;
});
