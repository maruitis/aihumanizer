/* ─── DOM refs ─────────────────────────────────────────────────────────────── */
const inputText         = document.getElementById('inputText');
const outputText        = document.getElementById('outputText');
const inputWc           = document.getElementById('inputWc');
const outputWc          = document.getElementById('outputWc');
const humanizeBtn       = document.getElementById('humanizeBtn');
const humanizeBtnMobile = document.getElementById('humanizeBtnMobile');
const hbtnLabel         = document.getElementById('hbtnLabel');
const hbtnArrow         = document.getElementById('hbtnArrow');
const clearBtn          = document.getElementById('clearBtn');
const copyBtn           = document.getElementById('copyBtn');
const stylePills        = document.getElementById('stylePills');
const audienceSelect    = document.getElementById('audienceSelect');
const toast             = document.getElementById('toast');

/* ─── State ────────────────────────────────────────────────────────────────── */
let selectedStyle = 'passage';
let processing    = false;
let fullOutput    = '';
let toastTimer    = null;

/* ─── Word count ────────────────────────────────────────────────────────────── */
function wc(str) {
  const s = str.trim();
  return s === '' ? 0 : s.split(/\s+/).length;
}

inputText.addEventListener('input', () => {
  const n = wc(inputText.value);
  inputWc.textContent = `${n} word${n !== 1 ? 's' : ''}`;
});

/* ─── Style pills ───────────────────────────────────────────────────────────── */
stylePills.addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  selectedStyle = pill.dataset.style;
});

/* ─── Clear ─────────────────────────────────────────────────────────────────── */
clearBtn.addEventListener('click', () => {
  inputText.value = '';
  inputWc.textContent = '0 words';
  inputText.focus();
});

/* ─── Copy ──────────────────────────────────────────────────────────────────── */
copyBtn.addEventListener('click', () => {
  if (!fullOutput) return;
  navigator.clipboard.writeText(fullOutput)
    .then(() => showToast('Copied to clipboard', 'success'))
    .catch(() => showToast('Copy failed — try selecting manually', 'error'));
});

/* ─── Toast ─────────────────────────────────────────────────────────────────── */
function showToast(msg, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ─── Button state ──────────────────────────────────────────────────────────── */
function setProcessing(on) {
  processing = on;
  humanizeBtn.classList.toggle('processing', on);
  humanizeBtnMobile.disabled = on;

  if (on) {
    hbtnLabel.textContent = 'Working';
    hbtnArrow.innerHTML = '<span class="spinner"></span>';
  } else {
    hbtnLabel.textContent = 'Humanize';
    hbtnArrow.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6"/>
      </svg>`;
  }
}

/* ─── Humanize ──────────────────────────────────────────────────────────────── */
async function humanize() {
  const text = inputText.value.trim();
  if (!text) { showToast('Paste some text first', 'error'); return; }
  if (processing) return;

  setProcessing(true);
  fullOutput = '';
  copyBtn.disabled = true;

  outputText.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  outputText.appendChild(cursor);

  try {
    const res = await fetch('/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        style: selectedStyle,
        audience: audienceSelect.value
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      throw new Error(err.error || 'Request failed');
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (raw === '[DONE]') { cursor.remove(); break; }

        let parsed;
        try { parsed = JSON.parse(raw); } catch { continue; }

        if (parsed.error) throw new Error(parsed.error);

        if (parsed.text) {
          fullOutput += parsed.text;
          cursor.insertAdjacentText('beforebegin', parsed.text);
          outputText.scrollTop = outputText.scrollHeight;
          const n = wc(fullOutput);
          outputWc.textContent = `${n} word${n !== 1 ? 's' : ''}`;
        }
      }
    }

    if (fullOutput) copyBtn.disabled = false;

  } catch (err) {
    cursor.remove();
    outputText.innerHTML = `<span style="color:var(--red)">${escHtml(err.message)}</span>`;
    showToast(err.message, 'error');
  } finally {
    setProcessing(false);
  }
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ─── Bindings ──────────────────────────────────────────────────────────────── */
humanizeBtn.addEventListener('click', humanize);
humanizeBtnMobile.addEventListener('click', humanize);

inputText.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    humanize();
  }
});
