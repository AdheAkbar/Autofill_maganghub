/**
 * MagangHub AI Document & PDF Auto-Filler (9Router)
 * Content Script - Hierarchical DOM Scanner, Custom Dropdown Matcher & Form Injector
 */

(() => {
  // Prevent duplicate initialization
  if (window.__MAGANGHUB_AI_AUTOFILLER_LOADED__) return;
  window.__MAGANGHUB_AI_AUTOFILLER_LOADED__ = true;

  console.log('[MagangHub Auto-Filler] Content script initialized.');

  // Indonesian month dictionary for smart matching
  const ID_MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  /**
   * Helper to normalize text (trim & lowercase)
   */
  function normalize(str) {
    return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Find nearest hierarchical group label (e.g. "Tanggal dikeluarkan", "Tanggal berakhir", "Lembaga sertifikasi")
   */
  function findGroupLabel(el) {
    let current = el;
    let depth = 0;

    // Check upwards through ancestors
    while (current && current !== document.body && depth < 8) {
      depth++;

      // Check fieldset legend
      if (current.tagName === 'FIELDSET') {
        const legend = current.querySelector('legend');
        if (legend && legend.innerText.trim()) {
          return legend.innerText.trim();
        }
      }

      // Check for preceding sibling headers or labels in the container
      let sibling = current.previousElementSibling;
      while (sibling) {
        const tag = sibling.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag) || tag === 'label' || sibling.classList.contains('group-title') || sibling.classList.contains('font-bold') || sibling.classList.contains('font-semibold')) {
          const txt = sibling.innerText.trim();
          if (txt && txt.length < 100) return txt;
        }
        sibling = sibling.previousElementSibling;
      }

      // Check if current container has an explicit title/label child before the inputs
      const titleEl = current.querySelector('.section-title, .form-group-title, .label-header, h3, h4, h5, .font-bold, .font-semibold');
      if (titleEl && !titleEl.contains(el) && titleEl.innerText.trim()) {
        const txt = titleEl.innerText.trim();
        if (txt.length < 100 && !txt.includes('\n')) return txt;
      }

      current = current.parentElement;
    }

    return '';
  }

  /**
   * Find direct field label or placeholder
   */
  function findFieldLabel(el) {
    // 1. Label with for="id"
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label && label.innerText.trim()) return label.innerText.trim();
    }

    // 2. Parent label element
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.innerText.trim()) {
      return parentLabel.innerText.replace(el.value || '', '').trim();
    }

    // 3. Aria-label or aria-labelledby
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const lblEl = document.getElementById(labelledby);
      if (lblEl && lblEl.innerText.trim()) return lblEl.innerText.trim();
    }

    // 4. Closest previous sibling label or span
    let prev = el.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'LABEL' || prev.classList.contains('form-label') || prev.classList.contains('text-sm')) {
        const txt = prev.innerText.trim();
        if (txt && txt.length < 80) return txt;
      }
      prev = prev.previousElementSibling;
    }

    // 5. Placeholder
    if (el.placeholder && el.placeholder.trim()) {
      return el.placeholder.trim();
    }

    return el.name || el.id || '';
  }

  /**
   * Find helper or instruction text near the field
   */
  function findHelperText(el) {
    let container = el.parentElement;
    for (let i = 0; i < 3 && container; i++) {
      const helperEl = container.querySelector(
        '.helper-text, .form-text, .text-muted, .text-xs, .text-sm.text-gray-500, small, [class*="helper"], [class*="hint"], [class*="info"]'
      );
      if (helperEl && helperEl !== el && !helperEl.contains(el)) {
        const txt = helperEl.innerText.trim();
        if (txt && txt.length < 200) return txt;
      }
      container = container.parentElement;
    }

    // Search for text starting with ⓘ or Format or Tambahkan or Masukkan
    const parent = el.closest('.form-group, .field, div, section');
    if (parent) {
      const allTexts = Array.from(parent.querySelectorAll('p, span, small, div'));
      for (const t of allTexts) {
        const raw = t.innerText.trim();
        if (
          raw.startsWith('ⓘ') ||
          raw.startsWith('*') ||
          raw.toLowerCase().includes('apabila desimal') ||
          raw.toLowerCase().includes('format') ||
          raw.toLowerCase().includes('maks') ||
          raw.toLowerCase().includes('menunjukkan kapan') ||
          raw.toLowerCase().includes('masa berlaku')
        ) {
          return raw;
        }
      }
    }

    return '';
  }

  /**
   * Scan page DOM and return structured list of fields
   */
  function scanPageForms() {
    const scannedFields = [];
    let fieldCounter = 0;

    // Selector for all candidate interactive form inputs
    const candidates = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select, [role="combobox"], [role="listbox"], .multiselect, .v-select, .el-select, .react-select'
    );

    candidates.forEach((el) => {
      // Skip invisible elements (unless it's a styled file input)
      if (el.type !== 'file') {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          // If it's inside a custom combobox or vue-select, check if parent is visible
          const parentVisible = el.parentElement && window.getComputedStyle(el.parentElement).display !== 'none';
          if (!parentVisible) return;
        }
      }

      fieldCounter++;
      let fieldId = el.getAttribute('data-mh-id');
      if (!fieldId) {
        fieldId = `mh_field_${fieldCounter}`;
        el.setAttribute('data-mh-id', fieldId);
      }

      const tagName = el.tagName.toLowerCase();
      let fieldType = 'text';

      if (tagName === 'textarea') {
        fieldType = 'textarea';
      } else if (tagName === 'select') {
        fieldType = 'select';
      } else if (el.type === 'file') {
        fieldType = 'file';
      } else if (el.type === 'number') {
        fieldType = 'number';
      } else if (el.getAttribute('role') === 'combobox' || el.classList.contains('multiselect') || el.classList.contains('v-select')) {
        fieldType = 'custom-dropdown';
      } else if (el.type) {
        fieldType = el.type;
      }

      const groupLabel = findGroupLabel(el);
      const fieldLabel = findFieldLabel(el);
      const helperText = findHelperText(el);
      const placeholder = el.placeholder || el.getAttribute('placeholder') || '';

      // Collect options if select or combobox
      const options = [];
      if (tagName === 'select') {
        Array.from(el.options).forEach((opt, idx) => {
          if (idx < 60) {
            const txt = (opt.text || opt.value || '').trim();
            if (txt && !options.includes(txt)) options.push(txt);
          }
        });
      } else if (fieldType === 'custom-dropdown' || el.getAttribute('role') === 'combobox') {
        const listbox = document.querySelector(`[role="listbox"], .dropdown-menu, .select-options, ul[id*="list"]`);
        if (listbox) {
          const optEls = listbox.querySelectorAll('[role="option"], li, .dropdown-item');
          optEls.forEach((o, idx) => {
            if (idx < 50) {
              const txt = o.innerText.trim();
              if (txt && !options.includes(txt)) options.push(txt);
            }
          });
        }
      }

      scannedFields.push({
        fieldId,
        groupLabel,
        fieldLabel,
        helperText,
        placeholder,
        fieldType,
        options,
        currentValue: el.value || '',
        accept: el.accept || ''
      });
    });

    console.log(`[MagangHub Auto-Filler] Scanned ${scannedFields.length} interactive fields.`);
    return scannedFields;
  }

  /**
   * Dispatch full suite of React/Vue-compatible events
   */
  function triggerReactiveEvents(el) {
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  /**
   * Set text/number value using React prototype setter
   */
  function setNativeValue(element, value) {
    const prototype = element.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    triggerReactiveEvents(element);
  }

  /**
   * Set select element value by smart matching
   */
  function setSelectValue(selectEl, rawValue) {
    const target = normalize(rawValue);
    let matchedOption = null;

    // 1. Exact match on value or text
    for (const opt of selectEl.options) {
      const optVal = normalize(opt.value);
      const optText = normalize(opt.text);
      if (optVal === target || optText === target) {
        matchedOption = opt;
        break;
      }
    }

    // 2. Indonesian Month matching (e.g. "Oktober" <-> "10", "10" <-> "Oktober")
    if (!matchedOption) {
      let targetMonthIdx = -1;
      // Check if target is a month name
      ID_MONTHS.forEach((m, idx) => {
        if (target.includes(normalize(m)) || normalize(m).includes(target)) {
          targetMonthIdx = idx + 1; // 1 to 12
        }
      });
      // Or target is a number "1" - "12"
      const num = parseInt(target, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        targetMonthIdx = num;
      }

      if (targetMonthIdx !== -1) {
        const monthName = ID_MONTHS[targetMonthIdx - 1].toLowerCase();
        const monthNumStr = String(targetMonthIdx);
        const monthPadStr = String(targetMonthIdx).padStart(2, '0');

        for (const opt of selectEl.options) {
          const optVal = normalize(opt.value);
          const optText = normalize(opt.text);
          if (
            optText.includes(monthName) ||
            optVal === monthNumStr ||
            optVal === monthPadStr ||
            optText === monthNumStr ||
            optText === monthPadStr
          ) {
            matchedOption = opt;
            break;
          }
        }
      }
    }

    // 3. Partial / substring match
    if (!matchedOption) {
      for (const opt of selectEl.options) {
        const optText = normalize(opt.text);
        if (optText && (optText.includes(target) || target.includes(optText))) {
          matchedOption = opt;
          break;
        }
      }
    }

    if (matchedOption) {
      selectEl.value = matchedOption.value;
      selectEl.dispatchEvent(new Event('focus', { bubbles: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      selectEl.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
    return false;
  }

  /**
   * Handle Custom Combobox / Searchable Dropdown (e.g. "Pilih lembaga sertifikasi")
   */
  async function setCustomComboboxValue(comboboxEl, value) {
    if (!value) return false;

    // Trigger click on the combobox trigger element
    comboboxEl.focus();
    comboboxEl.click();
    comboboxEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // Wait 150ms for dropdown to open
    await new Promise((r) => setTimeout(r, 150));

    // Check if an input field appeared inside or near for searching
    const searchInput = comboboxEl.querySelector('input') || document.querySelector('.dropdown-menu input, .select-search input, [role="combobox"] input');
    if (searchInput) {
      setNativeValue(searchInput, value);
      await new Promise((r) => setTimeout(r, 150));
    }

    // Look for matching option in the popover / listbox
    const listbox = document.querySelector('[role="listbox"], .dropdown-menu, .v-select-list, .multiselect__content');
    if (listbox) {
      const options = Array.from(listbox.querySelectorAll('[role="option"], li, .dropdown-item, span'));
      const targetNorm = normalize(value);
      let bestMatch = null;

      for (const opt of options) {
        const text = normalize(opt.innerText);
        if (text === targetNorm) {
          bestMatch = opt;
          break;
        }
        if (text.includes(targetNorm) || targetNorm.includes(text)) {
          bestMatch = opt;
        }
      }

      if (bestMatch) {
        bestMatch.click();
        bestMatch.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        return true;
      }
    }

    // If no listbox option clicked, try setting native input directly if comboboxEl is an input
    if (comboboxEl.tagName === 'INPUT') {
      setNativeValue(comboboxEl, value);
      return true;
    }

    return false;
  }

  /**
   * Inject uploaded file into <input type="file"> via DataTransfer API
   */
  function injectFileUpload(fileInput, fileData) {
    try {
      const { base64, name, type } = fileData;
      if (!base64 || !name) return false;

      // Extract binary data from Data URL
      const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
      const byteCharacters = atob(base64Data);
      const byteArrays = [];

      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }

      const mimeType = type || 'application/pdf';
      const blob = new Blob(byteArrays, { type: mimeType });
      const file = new File([blob], name, { type: mimeType, lastModified: Date.now() });

      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Assign to input.files
      fileInput.files = dataTransfer.files;

      // Trigger change and input events
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Also trigger drop event on surrounding dropzone if present
      const dropzone = fileInput.closest('.dropzone, [data-dropzone], .upload-area, .file-drop-area, div.border-dashed') || fileInput.parentElement;
      if (dropzone) {
        dropzone.classList.add('mh-dropzone-attached');
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        });
        dropzone.dispatchEvent(dropEvent);

        // Update UI preview text if dropzone has text element
        const dropText = dropzone.querySelector('p, span, .text-xs, .text-sm');
        if (dropText) {
          dropText.innerText = `✓ Terlampir: ${name}`;
        }
      }

      console.log(`[MagangHub Auto-Filler] File "${name}" attached successfully.`);
      return true;
    } catch (err) {
      console.error('[MagangHub Auto-Filler] Error attaching file:', err);
      return false;
    }
  }

  /**
   * Apply confidence highlight and badge to element
   */
  function applyConfidenceBadge(element, fieldItem) {
    const { confidence, note, value } = fieldItem;
    element.classList.remove('mh-high-confidence', 'mh-review-needed');
    element.classList.add('mh-field-filled');

    const isHigh = confidence === 'high';
    element.classList.add(isHigh ? 'mh-high-confidence' : 'mh-review-needed');

    // Remove existing badge if present
    const existingBadge = element.parentElement?.querySelector(`.mh-badge[data-for="${fieldItem.fieldId}"]`);
    if (existingBadge) existingBadge.remove();

    // Create badge
    const badge = document.createElement('div');
    badge.className = `mh-badge ${isHigh ? 'mh-badge-high' : 'mh-badge-review'}`;
    badge.setAttribute('data-for', fieldItem.fieldId);
    badge.innerHTML = `
      <span>${isHigh ? '✓ 9Router' : '⚠️ Perlu Cek'}</span>
      ${note ? `<span class="mh-badge-note">(${note})</span>` : ''}
    `;
    badge.title = note || `Diisi otomatis oleh 9Router: "${value}"`;

    // Insert after input element
    if (element.nextSibling) {
      element.parentNode.insertBefore(badge, element.nextSibling);
    } else {
      element.parentNode.appendChild(badge);
    }
  }

  /**
   * Focus and highlight a field with smooth scroll and pulse animation
   */
  function focusField(fieldId) {
    const el = document.querySelector(`[data-mh-id="${fieldId}"]`);
    if (!el) {
      console.warn(`[MagangHub Auto-Filler] Element with ID ${fieldId} not found.`);
      return false;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('mh-focus-pulse');
    void el.offsetWidth; // Force DOM reflow
    el.classList.add('mh-focus-pulse');

    setTimeout(() => {
      try {
        el.focus();
      } catch (e) {
        // Ignored
      }
    }, 300);

    setTimeout(() => {
      el.classList.remove('mh-focus-pulse');
    }, 2800);

    return true;
  }

  /**
   * Apply all mapped values from 9Router to the page
   */
  async function applyFormValues(mappedFields, uploadedFileData) {
    let appliedCount = 0;

    for (const item of mappedFields) {
      const { fieldId, value, groupLabel, fieldLabel } = item;
      let el = document.querySelector(`[data-mh-id="${fieldId}"]`);

      // Fallback search if fieldId is missing
      if (!el && (groupLabel || fieldLabel)) {
        const allCandidates = document.querySelectorAll('[data-mh-id]');
        for (const cand of allCandidates) {
          const cGroup = findGroupLabel(cand);
          const cLabel = findFieldLabel(cand);
          if (
            normalize(cGroup) === normalize(groupLabel) &&
            normalize(cLabel) === normalize(fieldLabel)
          ) {
            el = cand;
            break;
          }
        }
      }

      if (!el) continue;

      const tagName = el.tagName.toLowerCase();
      const type = (el.type || '').toLowerCase();

      // If value is explicitly empty or null, leave it blank or clear
      const valToSet = (value === null || value === undefined) ? '' : String(value);

      if (type === 'file') {
        if (uploadedFileData) {
          const ok = injectFileUpload(el, uploadedFileData);
          if (ok) {
            applyConfidenceBadge(el, item);
            appliedCount++;
          }
        }
      } else if (tagName === 'select') {
        if (valToSet !== '') {
          setSelectValue(el, valToSet);
          applyConfidenceBadge(el, item);
          appliedCount++;
        }
      } else if (el.getAttribute('role') === 'combobox' || el.classList.contains('multiselect') || el.classList.contains('v-select')) {
        if (valToSet !== '') {
          await setCustomComboboxValue(el, valToSet);
          applyConfidenceBadge(el, item);
          appliedCount++;
        }
      } else {
        // Standard input / textarea
        setNativeValue(el, valToSet);
        if (valToSet !== '') {
          applyConfidenceBadge(el, item);
          appliedCount++;
        }
      }
    }

    // Also check if there's any unfilled file input and we have uploadedFileData
    if (uploadedFileData) {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((fi) => {
        if (!fi.files || fi.files.length === 0) {
          injectFileUpload(fi, uploadedFileData);
        }
      });
    }

    return appliedCount;
  }

  // Listen to messages from background / sidepanel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action } = request;

    if (action === 'MH_SCAN_DOM') {
      const fields = scanPageForms();
      sendResponse({ success: true, fields });
      return true;
    }

    if (action === 'MH_APPLY_VALUES') {
      applyFormValues(request.mappedFields, request.uploadedFileData).then((count) => {
        sendResponse({ success: true, appliedCount: count });
      });
      return true;
    }

    if (action === 'MH_FOCUS_FIELD') {
      const ok = focusField(request.fieldId);
      sendResponse({ success: ok });
      return true;
    }
  });
})();
