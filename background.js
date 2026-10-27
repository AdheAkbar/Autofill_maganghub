/**
 * MagangHub AI Document & PDF Auto-Filler (9Router)
 * Background Service Worker - 9Router Gateway Orchestrator & Multimodal Bridge
 */

// Configure side panel behavior on action click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
      console.warn('[Background] Failed to set sidePanel behavior:', err);
    });
  }
  console.log('[MagangHub Auto-Filler] Extension installed.');
});

// Fallback click listener for browsers where setPanelBehavior is not available
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => {
      console.warn('[Background] Failed to open sidePanel:', err);
    });
  }
});

// Default 9Router Configuration (Pre-configured for local 9Router instance)
const DEFAULT_CONFIG = {
  endpoint: 'http://localhost:20128/v1/chat/completions',
  apiKey: '',
  model: 'AdheRouter',
  visionEnabled: true,
  autoAttachFile: true
};

/**
 * Retrieve saved settings from chrome.storage.local
 */
async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
      resolve(items);
    });
  });
}

/**
 * System Prompt for 9Router Document-to-Form Mapping
 */
const SYSTEM_PROMPT = `Anda adalah AI Document-to-Form Mapper tingkat lanjut yang bertugas membaca dokumen (Sertifikat Kompetensi, CV, Ijazah, Transkrip, atau Dokumen Magang) dan mengisi formulir web MagangHub / SIAPkerja Kemnaker secara presisi.

INPUT YANG ANDA TERIMA:
1. Teks dan/atau Gambar visual dari dokumen PDF/Image yang diunggah pengguna.
2. Instruksi tambahan dari pengguna (User Prompt).
3. Daftar struktur field formulir (domFields) dari halaman web aktif, masing-masing dilengkapi fieldId, groupLabel (judul bagian induk), fieldLabel (label/placeholder input), helperText (petunjuk di bawah input), fieldType, dan options (daftar pilihan dropdown jika ada).

ATURAN PEMETAAN KRUSIAL:
1. PERHATIKAN GROUP LABEL (JANGAN TERTUKAR ANTAR TANGGAL):
   - Formulir sering memiliki dua bagian tanggal dengan sub-input yang sama-sama bernama "Bulan" dan "Tahun", misalnya:
     * Group "Tanggal dikeluarkan" -> terdiri dari sub-field "Bulan" dan "Tahun".
     * Group "Tanggal berakhir" -> terdiri dari sub-field "Bulan" dan "Tahun".
   - Pastikan tanggal terbit sertifikat masuk ke fieldId yang memiliki groupLabel: "Tanggal dikeluarkan", dan masa berlaku/kedaluwarsa masuk ke groupLabel: "Tanggal berakhir".
   - Jika di dalam sertifikat TIDAK tertulis tanggal kedaluwarsa/berakhir, WAJIB isi "value": "" (kosongkan) untuk "Bulan" dan "Tahun" pada grup "Tanggal berakhir".

2. PATUHI ATURAN FORMAT PADA PLACEHOLDER & HELPER TEXT:
   - Pada kolom "Nilai", placeholder berbunyi "Tambahkan , apabila desimal". Jika terdapat skor/nilai desimal pada sertifikat (contoh: 87.5 atau 3.85), ubah titik menjadi koma (contoh: "87,5" atau "3,85"). Jika tidak ada nilai/skor pada sertifikat, isi dengan "".
   - Pada kolom "Bulan", gunakan format nama bulan Bahasa Indonesia ("Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember") atau sesuaikan persis dengan daftar options yang tersedia pada field tersebut.
   - Pada kolom "Tahun", gunakan format angka 4 digit (misal: "2025").

3. PENCOCOKAN DROPDOWN LEMBAGA SERTIFIKASI:
   - Untuk kolom "Lembaga sertifikasi", identifikasi nama instansi/organisasi penerbit sertifikat dari dokumen (misal: BNSP, Kementerian Ketenagakerjaan, Google, Coursera, Dicoding, Microsoft, Lembaga Sertifikasi Profesi, dll.).
   - Jika field menyediakan daftar options, pilih nilai dari options yang paling mendekati. Jika tidak ada di daftar options, kembalikan nama resmi lembaga penerbit agar ekstensi dapat mengetikkannya ke dalam combobox pencarian.

4. TINGKAT KEYAKINAN (CONFIDENCE SCORE) UNTUK KOREKSI PENGGUNA:
   - Berikan "confidence": "high" jika data tertulis jelas di sertifikat.
   - Berikan "confidence": "review_needed" beserta "note" singkat jika data merupakan hasil inferensi atau jika nama lembaga perlu disesuaikan dengan daftar dropdown sistem.

KEMBALIKAN HANYA JSON MURNI DENGAN FORMAT BERIKUT TANPA TEKS LAIN:
{
  "documentSummary": {
    "certificateName": "...",
    "issuer": "...",
    "score": "...",
    "issueMonth": "...",
    "issueYear": "...",
    "expiryMonth": "...",
    "expiryYear": "..."
  },
  "filledFields": [
    {
      "fieldId": "...",
      "groupLabel": "...",
      "fieldLabel": "...",
      "value": "...",
      "confidence": "high",
      "note": "Alasan singkat pemilihan nilai untuk memudahkan pengecekan pengguna"
    }
  ]
}`;

/**
 * Clean and parse JSON response from LLM
 */
function parseLlmJson(rawText) {
  if (!rawText) throw new Error('Respon dari 9Router kosong.');

  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // Try parsing JSON
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt extracting first JSON object
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Gagal mem-parsing format JSON dari 9Router: ${err.message}`);
  }
}

/**
 * Call 9Router OpenAI-compatible Endpoint with Vision & Fallback
 */
async function call9RouterApi({ extractedPdfText, documentImageBase64, userPrompt, domFields }) {
  const config = await getConfig();
  const endpoint = config.endpoint || DEFAULT_CONFIG.endpoint;
  const apiKey = config.apiKey || '';
  const model = config.model || DEFAULT_CONFIG.model;

  // Build the user content
  const promptDetails = userPrompt ? `\n\nINSTRUKSI TAMBAHAN PENGGUNA:\n${userPrompt}` : '';
  const fieldsContext = `\n\nSTRUKTUR FIELD FORMULIR HALAMAN WEB SAAT INI (domFields):\n${JSON.stringify(domFields, null, 2)}`;
  const textContext = extractedPdfText
    ? `\n\nTEKS DOKUMEN YANG DIEKSTRAK DARI PDF:\n"""\n${extractedPdfText.substring(0, 12000)}\n"""`
    : '';

  const userTextPrompt = `Silakan baca dokumen terlampir dan isi struktur formulir berikut sesuai aturan.${promptDetails}${textContext}${fieldsContext}`;

  // Check if we should attempt Vision Multimodal
  const canUseVision = config.visionEnabled && documentImageBase64;

  let requestBody;
  let headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Helper to make fetch request
  async function makeRequest(bodyPayload) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error && parsed.error.message) {
          errMsg = parsed.error.message;
        }
      } catch (e) {
        if (errText) errMsg += ` - ${errText.substring(0, 200)}`;
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return parseLlmJson(content);
  }

  // Attempt 1: Multimodal (Text + Vision Image)
  if (canUseVision) {
    console.log('[Background] Attempting multimodal request with Vision to 9Router...');
    const visionUserContent = [
      {
        type: 'text',
        text: userTextPrompt
      },
      {
        type: 'image_url',
        image_url: {
          url: documentImageBase64
        }
      }
    ];

    requestBody = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: visionUserContent }
      ],
      stream: false,
      temperature: 0.1
    };

    try {
      return await makeRequest(requestBody);
    } catch (visionError) {
      console.warn('[Background] Vision request failed, falling back to text-only mode:', visionError.message);
      // Fallback if model doesn't support images or 400 error
    }
  }

  // Attempt 2: Text-Only Request
  console.log('[Background] Sending text-only request to 9Router...');
  requestBody = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userTextPrompt }
    ],
    stream: false,
    temperature: 0.1
  };

  return await makeRequest(requestBody);
}

/**
 * Test 9Router Connection
 */
async function test9RouterConnection() {
  const config = await getConfig();
  const startTime = Date.now();
  let base = config.endpoint || DEFAULT_CONFIG.endpoint;

  // Convert chat/completions endpoint to /models if possible, or send a ping chat completion
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

    let modelsUrl = base.replace(/\/chat\/completions\/?$/, '/models');
    let response = await fetch(modelsUrl, { method: 'GET', headers });

    if (response.ok) {
      const data = await response.json();
      const latencyMs = Date.now() - startTime;
      const modelList = data.data ? data.data.map((m) => m.id) : [];
      return { success: true, latencyMs, models: modelList };
    }

    // Fallback: ping completions endpoint with simple prompt
    const pingResponse = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model || 'auto',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });

    const latencyMs = Date.now() - startTime;
    if (pingResponse.ok) {
      return { success: true, latencyMs, models: [] };
    } else {
      const errText = await pingResponse.text();
      return { success: false, error: `HTTP ${pingResponse.status}: ${errText.substring(0, 150)}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Global Message Hub
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;

  if (action === 'CALL_9ROUTER') {
    call9RouterApi(request.payload)
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep sendResponse open for async
  }

  if (action === 'TEST_9ROUTER') {
    test9RouterConnection()
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
