/**
 * MagangHub AI Document & PDF Auto-Filler (9Router)
 * Side Panel Controller - File Extraction, 9Router Communication & Review UI
 */

// Initialize PDF.js worker if available
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.js');
}

// State
let selectedFile = null;
let fileDataUrl = null;
let extractedPdfText = '';
let documentImageBase64 = null;
let isProcessing = false;

// DOM Elements
const tabBtnMain = document.getElementById('tabBtnMain');
const tabBtnSettings = document.getElementById('tabBtnSettings');
const tabMain = document.getElementById('tabMain');
const tabSettings = document.getElementById('tabSettings');

const statusPill = document.getElementById('statusPill');
const statusText = document.getElementById('statusText');

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const previewThumb = document.getElementById('previewThumb');
const previewName = document.getElementById('previewName');
const previewMeta = document.getElementById('previewMeta');
const btnRemoveFile = document.getElementById('btnRemoveFile');

const chkVisionMode = document.getElementById('chkVisionMode');
const chkAutoAttach = document.getElementById('chkAutoAttach');
const txtUserPrompt = document.getElementById('txtUserPrompt');

const btnProcess = document.getElementById('btnProcess');
const progressBox = document.getElementById('progressBox');
const progressText = document.getElementById('progressText');

const summarySection = document.getElementById('summarySection');
const sumDocTitle = document.getElementById('sumDocTitle');
const sumIssuer = document.getElementById('sumIssuer');
const sumScore = document.getElementById('sumScore');
const sumIssueDate = document.getElementById('sumIssueDate');
const sumExpiryDate = document.getElementById('sumExpiryDate');

const reviewSection = document.getElementById('reviewSection');
const reviewList = document.getElementById('reviewList');
const reviewCountBadge = document.getElementById('reviewCountBadge');

// Settings Elements
const cfgEndpoint = document.getElementById('cfgEndpoint');
const cfgApiKey = document.getElementById('cfgApiKey');
const cfgModel = document.getElementById('cfgModel');
const btnTestConn = document.getElementById('btnTestConn');
const btnSaveSettings = document.getElementById('btnSaveSettings');
const testConnResult = document.getElementById('testConnResult');

const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastMsg = document.getElementById('toastMsg');

/**
 * Toast helper
 */
function showToast(message, icon = 'ℹ️', duration = 3000) {
  toastIcon.textContent = icon;
  toastMsg.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

/**
 * Update progress banner
 */
function setProgress(active, message = '') {
  if (active) {
    progressBox.classList.add('active');
    progressText.textContent = message;
    btnProcess.disabled = true;
  } else {
    progressBox.classList.remove('active');
    btnProcess.disabled = !selectedFile;
  }
}

/**
 * Switch tabs
 */
function switchTab(tabId) {
  if (tabId === 'tabMain') {
    tabBtnMain.classList.add('active');
    tabBtnSettings.classList.remove('active');
    tabMain.classList.add('active');
    tabSettings.classList.remove('active');
  } else {
    tabBtnMain.classList.remove('active');
    tabBtnSettings.classList.add('active');
    tabMain.classList.remove('active');
    tabSettings.classList.add('active');
  }
}

tabBtnMain.addEventListener('click', () => switchTab('tabMain'));
tabBtnSettings.addEventListener('click', () => switchTab('tabSettings'));

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.local.get(
    {
      endpoint: 'http://localhost:20128/v1/chat/completions',
      apiKey: '',
      model: 'AdheRouter',
      visionEnabled: true,
      autoAttachFile: true
    },
    (cfg) => {
      cfgEndpoint.value = cfg.endpoint;
      cfgApiKey.value = cfg.apiKey;
      cfgModel.value = cfg.model;
      chkVisionMode.checked = cfg.visionEnabled;
      chkAutoAttach.checked = cfg.autoAttachFile;

      // Check connection on load
      check9RouterHealth();
    }
  );
}

/**
 * Save settings to storage
 */
btnSaveSettings.addEventListener('click', () => {
  const newConfig = {
    endpoint: cfgEndpoint.value.trim() || 'http://localhost:20128/v1/chat/completions',
    apiKey: cfgApiKey.value.trim(),
    model: cfgModel.value.trim() || 'auto',
    visionEnabled: chkVisionMode.checked,
    autoAttachFile: chkAutoAttach.checked
  };

  chrome.storage.local.set(newConfig, () => {
    showToast('Pengaturan berhasil disimpan!', '💾');
    check9RouterHealth();
  });
});

/**
 * Test 9Router Connection
 */
async function check9RouterHealth() {
  statusPill.className = 'status-pill';
  statusText.textContent = 'Memeriksa...';

  chrome.runtime.sendMessage({ action: 'TEST_9ROUTER' }, (res) => {
    if (res && res.success) {
      statusPill.className = 'status-pill online';
      statusText.textContent = `9Router Ready (${res.latencyMs}ms)`;
    } else {
      statusPill.className = 'status-pill offline';
      statusText.textContent = '9Router Offline';
    }
  });
}

btnTestConn.addEventListener('click', () => {
  btnTestConn.disabled = true;
  testConnResult.style.display = 'block';
  testConnResult.style.color = '#2563eb';
  testConnResult.textContent = 'Menghubungi 9Router...';

  // Temporarily update storage for test
  chrome.storage.local.set(
    {
      endpoint: cfgEndpoint.value.trim(),
      apiKey: cfgApiKey.value.trim(),
      model: cfgModel.value.trim()
    },
    () => {
      chrome.runtime.sendMessage({ action: 'TEST_9ROUTER' }, (res) => {
        btnTestConn.disabled = false;
        if (res && res.success) {
          testConnResult.style.color = '#10b981';
          const modelInfo = res.models && res.models.length > 0 ? ` (${res.models.length} model terdeteksi)` : '';
          testConnResult.textContent = `✓ Berhasil terhubung ke 9Router! Latensi: ${res.latencyMs} ms${modelInfo}`;
          check9RouterHealth();
        } else {
          testConnResult.style.color = '#ef4444';
          testConnResult.textContent = `✗ Gagal terhubung: ${res?.error || 'Pastikan 9Router berjalan di port 20128.'}`;
          check9RouterHealth();
        }
      });
    }
  );
});

/**
 * Format bytes to readable size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

/**
 * File handling & PDF processing
 */
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileSelected(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelected(e.target.files[0]);
  }
});

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation();
  selectedFile = null;
  fileDataUrl = null;
  extractedPdfText = '';
  documentImageBase64 = null;
  fileInput.value = '';
  filePreview.classList.remove('active');
  dropzone.style.display = 'block';
  btnProcess.disabled = true;
});

/**
 * Process selected file: Extract text & render canvas for Vision
 */
async function handleFileSelected(file) {
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran file maksimal 5MB!', '⚠️');
    return;
  }

  const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|png|jpg|jpeg)$/i)) {
    showToast('Format file harus PDF, PNG, atau JPG!', '⚠️');
    return;
  }

  selectedFile = file;
  previewName.textContent = file.name;
  previewMeta.textContent = formatFileSize(file.size);
  dropzone.style.display = 'none';
  filePreview.classList.add('active');

  setProgress(true, 'Membaca dan memproses file dokumen...');

  const reader = new FileReader();

  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    reader.onload = async (ev) => {
      fileDataUrl = ev.target.result;
      try {
        await processPdfFile(fileDataUrl);
        setProgress(false);
        btnProcess.disabled = false;
        showToast('PDF berhasil dipindai!', '✅');
      } catch (err) {
        console.error('PDF parsing error:', err);
        setProgress(false);
        showToast(`Gagal membaca PDF: ${err.message}`, '⚠️');
      }
    };
    reader.readAsDataURL(file);
  } else {
    // Image file
    reader.onload = (ev) => {
      fileDataUrl = ev.target.result;
      documentImageBase64 = fileDataUrl;
      extractedPdfText = '';
      previewThumb.innerHTML = `<img src="${fileDataUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">`;
      setProgress(false);
      btnProcess.disabled = false;
      showToast('Gambar berhasil dimuat!', '✅');
    };
    reader.readAsDataURL(file);
  }
}

/**
 * Extract text and render page 1 of PDF to Base64 image
 */
async function processPdfFile(dataUrl) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js library tidak tersedia.');
  }

  // Convert dataURL to Uint8Array
  const base64Data = dataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const loadingTask = window.pdfjsLib.getDocument({ data: bytes.buffer });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  previewMeta.textContent = `${formatFileSize(selectedFile.size)} • ${numPages} Halaman`;

  // 1. Extract text from all pages (up to 5 pages)
  let fullText = '';
  const pagesToScan = Math.min(numPages, 5);
  for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += `--- Halaman ${pageNum} ---\n${pageText}\n\n`;
  }
  extractedPdfText = fullText.trim();

  // 2. Render Page 1 to in-memory Canvas for Vision OCR
  const page1 = await pdf.getPage(1);
  const viewport = page1.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page1.render({ canvasContext: ctx, viewport }).promise;
  documentImageBase64 = canvas.toDataURL('image/png');

  // Set thumbnail
  previewThumb.innerHTML = `<img src="${documentImageBase64}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">`;
}

/**
 * Ensure content script is injected in active tab
 */
async function ensureContentScriptInjected(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'MH_SCAN_DOM' });
    if (res && res.success) return true;
  } catch (err) {
    // Content script not yet injected, inject dynamically
    console.log('[SidePanel] Injecting content script into tab...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css']
    });
    // Wait a brief moment for execution
    await new Promise((r) => setTimeout(r, 200));
    return true;
  }
  return true;
}

/**
 * Primary Process Action: Scan DOM -> Call 9Router -> Apply Values
 */
btnProcess.addEventListener('click', async () => {
  if (!selectedFile) {
    showToast('Pilih dokumen terlebih dahulu!', '⚠️');
    return;
  }

  isProcessing = true;
  reviewSection.style.display = 'none';
  summarySection.style.display = 'none';

  try {
    // 1. Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error('Tidak dapat mendeteksi tab web yang sedang aktif.');
    }

    // 2. Scan DOM
    setProgress(true, '🔍 Memindai struktur formulir di halaman web...');
    await ensureContentScriptInjected(tab.id);

    const scanResult = await chrome.tabs.sendMessage(tab.id, { action: 'MH_SCAN_DOM' });
    if (!scanResult || !scanResult.fields || scanResult.fields.length === 0) {
      throw new Error('Tidak ditemukan kolom formulir yang dapat diisi pada halaman ini.');
    }

    console.log(`[SidePanel] Ditemukan ${scanResult.fields.length} kolom form.`);

    // 3. Call 9Router AI
    setProgress(true, '🧠 Mengirim ke 9Router AI Gateway...');
    const payload = {
      extractedPdfText,
      documentImageBase64: chkVisionMode.checked ? documentImageBase64 : null,
      userPrompt: txtUserPrompt.value.trim(),
      domFields: scanResult.fields
    };

    const aiResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'CALL_9ROUTER', payload }, resolve);
    });

    if (!aiResponse || !aiResponse.success) {
      throw new Error(aiResponse?.error || 'Gagal menerima respon pemetaan dari 9Router.');
    }

    const { documentSummary, filledFields } = aiResponse.data;

    // 4. Inject values to web form
    setProgress(true, '✍️ Mengisi field formulir & melampirkan file...');
    const uploadedFileData = chkAutoAttach.checked
      ? {
          base64: fileDataUrl,
          name: selectedFile.name,
          type: selectedFile.type
        }
      : null;

    const injectResult = await chrome.tabs.sendMessage(tab.id, {
      action: 'MH_APPLY_VALUES',
      mappedFields: filledFields,
      uploadedFileData
    });

    const appliedCount = injectResult?.appliedCount || filledFields.length;

    // 5. Render UI Document Summary
    renderDocumentSummary(documentSummary);

    // 6. Render Review List
    renderReviewList(filledFields, tab.id);

    setProgress(false);
    showToast(`Berhasil mengisi ${appliedCount} kolom form!`, '🎉');
  } catch (err) {
    console.error('[SidePanel] Error in process:', err);
    setProgress(false);
    showToast(err.message, '❌', 5000);
  } finally {
    isProcessing = false;
  }
});

/**
 * Render Document Summary Card
 */
function renderDocumentSummary(summary) {
  if (!summary) return;
  sumDocTitle.textContent = summary.certificateName || summary.title || '-';
  sumIssuer.textContent = summary.issuer || '-';
  sumScore.textContent = summary.score || '-';

  const issueStr = [summary.issueMonth, summary.issueYear].filter(Boolean).join(' ');
  sumIssueDate.textContent = issueStr || summary.issueDate || '-';

  const expiryStr = [summary.expiryMonth, summary.expiryYear].filter(Boolean).join(' ');
  sumExpiryDate.textContent = expiryStr || summary.expiryDate || 'Seumur Hidup / Tidak Ada';

  summarySection.style.display = 'block';
}

/**
 * Render Review Fields List
 */
function renderReviewList(fields, tabId) {
  reviewList.innerHTML = '';
  if (!fields || fields.length === 0) {
    reviewSection.style.display = 'none';
    return;
  }

  reviewCountBadge.textContent = `${fields.length} Kolom Diisi`;

  fields.forEach((item) => {
    const isHigh = item.confidence === 'high';
    const row = document.createElement('div');
    row.className = 'review-item';

    const groupHtml = item.groupLabel
      ? `<span class="review-group-tag">${escapeHtml(item.groupLabel)}</span>`
      : '';

    row.innerHTML = `
      <div>
        ${groupHtml}
        <div class="review-item-header">
          <span class="review-field-title">${escapeHtml(item.fieldLabel || 'Kolom')}</span>
          <span class="badge-tag ${isHigh ? 'badge-high' : 'badge-review'}">
            ${isHigh ? '✓ Yakin' : '⚠️ Perlu Dicek'}
          </span>
        </div>
      </div>
      <div class="review-value-box">${escapeHtml(item.value || '(Kosong)')}</div>
      <div class="review-item-footer">
        <span class="review-note">${escapeHtml(item.note || '')}</span>
        <button class="btn-focus" data-field-id="${item.fieldId}">🔍 Fokus ke Kolom</button>
      </div>
    `;

    // Click to focus field in web page
    const btnFocus = row.querySelector('.btn-focus');
    btnFocus.addEventListener('click', () => {
      chrome.tabs.sendMessage(tabId, {
        action: 'MH_FOCUS_FIELD',
        fieldId: item.fieldId
      });
    });

    reviewList.appendChild(row);
  });

  reviewSection.style.display = 'block';
}

/**
 * XSS escape helper
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
});
