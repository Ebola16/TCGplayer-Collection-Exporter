let parsedRows = [];
let currentSortCol = null;
let sortAsc = true;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportXlsxBtn = document.getElementById('exportXlsxBtn');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files && e.target.files.length) handleFile(e.target.files[0]);
});

function safeText(el) { return el ? (el.textContent || '').trim().replace(/\s+/g,' ') : ''; }
function parseIntSafe(s) { const n = parseInt((s||'').replace(/[^0-9\-]/g,''),10); return Number.isNaN(n) ? 0 : n; }
function parseFloatSafe(s) { const n = parseFloat((s||'').replace(/[^0-9.\-]/g,'')); return Number.isNaN(n) ? 0 : n; }
function formatPrice(n){ return '$' + Number(n || 0).toFixed(2); }

async function handleFile(file) {
  statusEl.textContent = `Reading ${file.name}…`;
  const raw = await file.text();
  parseHTML(raw);
}

function parseHTML(rawHtml) {
  parsedRows = [];
  outputEl.innerHTML = '';
  exportCsvBtn.disabled = true;
  exportXlsxBtn.disabled = true;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  let table = doc.querySelector('table.CollectionTable.tablesorter') ||
              doc.querySelector('#collectionResultsTable table') ||
              doc.querySelector('table.CollectionTable') ||
              doc.querySelector('table#tblCollection') ||
              doc.querySelector('table.collection');

  if (!table) {
    const re = /<tr[^>]*id=['"]StoreProductId_[^'"]+['"][^>]*>[\s\S]*?<\/tr>/gi;
    const matches = rawHtml.match(re);
    if (matches && matches.length) {
      const tmp = document.createElement('table');
      tmp.innerHTML = '<tbody>' + matches.join('') + '</tbody>';
      table = tmp;
    }
  }

  if (!table) {
    statusEl.innerHTML = '<strong style="color:#b91c1c">ERROR:</strong> Could not find TCGplayer collection table.';
    const snippet = rawHtml.slice(0, 4000).replace(/</g,'&lt;').replace(/>/g,'&gt;');
    outputEl.innerHTML = `<h4>Diagnostic snippet</h4><pre style="max-height:300px;overflow:auto;background:#f6f6f6;padding:8px">${snippet}</pre>`;
    return;
  }

  const tbody = table.querySelector('tbody') || table;
  const trs = Array.from(tbody.querySelectorAll('tr'));

  trs.forEach(tr => {
    const tds = Array.from(tr.querySelectorAll('td'));
    if (tds.length < 4) return;

    const haveRaw = safeText(tds[0]);
    const wantRaw = safeText(tds[1]);
    const tradeRaw= safeText(tds[2]);

    const nameCell = tds[3] || null;
    const linkEl = nameCell ? nameCell.querySelector('a') : null;
    const name = linkEl ? safeText(linkEl) : safeText(nameCell);
    const link = linkEl ? (linkEl.href || '') : '';

    const set = (tds[4] ? safeText(tds[4]) : '');

    const lowRaw  = (tds[5] ? safeText(tds[5]) : '');
    const midRaw  = (tds[6] ? safeText(tds[6]) : '');
    const highRaw = (tds[7] ? safeText(tds[7]) : '');

    parsedRows.push({
      Name: name,
      Link: link,
      Set: set,
      Have: parseIntSafe(haveRaw),
      Want: parseIntSafe(wantRaw),
      Trade: parseIntSafe(tradeRaw),
      Low: parseFloatSafe(lowRaw),
      LowRaw: lowRaw,
      Mid: parseFloatSafe(midRaw),
      MidRaw: midRaw,
      High: parseFloatSafe(highRaw),
      HighRaw: highRaw
    });
  });

  statusEl.textContent = `Parsed ${parsedRows.length} rows.`;
  if (parsedRows.length === 0) {
    outputEl.innerHTML = '<p>No product rows found.</p>';
    exportCsvBtn.disabled = true;
    exportXlsxBtn.disabled = true;
    return;
  }

  updateExportButtons();
  renderTable();
}

function renderTable() {
  const enableLinks = document.getElementById('enableLinks').checked;
  const headers = ['Name','Set','Have','Want','Trade','Low','Mid','High'];

  let html = '<table><thead><tr>';
  headers.forEach(h => html += `<th onclick="onSort('${h}')">${h}</th>`);
  html += '</tr></thead><tbody>';

  parsedRows.forEach(r => {
    const nameCell = enableLinks && r.Link ? `<a class="cardlink" href="${r.Link}" target="_blank">${escapeHtml(r.Name)}</a>` : escapeHtml(r.Name);
    html += '<tr>';
    html += `<td>${nameCell}</td>`;
    html += `<td>${escapeHtml(r.Set)}</td>`;
    html += `<td>${r.Have}</td>`;
    html += `<td>${r.Want}</td>`;
    html += `<td>${r.Trade}</td>`;
    html += `<td>${formatPrice(r.Low)}</td>`;
    html += `<td>${formatPrice(r.Mid)}</td>`;
    html += `<td>${formatPrice(r.High)}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  outputEl.innerHTML = html;
}

function onSort(col) {
  if (currentSortCol === col) sortAsc = !sortAsc;
  else { currentSortCol = col; sortAsc = true; }

  parsedRows.sort((a,b) => {
    let ax = a[col], bx = b[col];
    if (typeof ax === 'number' && typeof bx === 'number') return sortAsc ? ax - bx : bx - ax;
    ax = (ax === undefined || ax === null) ? '' : String(ax).toLowerCase();
    bx = (bx === undefined || bx === null) ? '' : String(bx).toLowerCase();
    return sortAsc ? ax.localeCompare(bx) : bx.localeCompare(ax);
  });
  renderTable();
}

function updateExportButtons() {
  const hasRows = parsedRows.length > 0;
  exportCsvBtn.disabled = !hasRows;
  exportXlsxBtn.disabled = !hasRows;
}

exportCsvBtn.addEventListener('click', () => {
  if (!parsedRows.length) return alert('No parsed rows to export.');

  const enableLinks = document.getElementById('enableLinks').checked;
  const headers = ['Name','Set','Have','Want','Trade','Low','Mid','High'];

  const csvRows = [];
  csvRows.push(headers.join(',')); // Header

  parsedRows.forEach(r => {
    const nameCell = enableLinks && r.Link ? `"${r.Name} (${r.Link})"` : `"${r.Name}"`;
    const row = [
      nameCell,
      `"${r.Set}"`,
      r.Have,
      r.Want,
      r.Trade,
      r.Low,
      r.Mid,
      r.High
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'tcgplayer_collection.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

exportXlsxBtn.addEventListener('click', () => {
  if (!parsedRows.length) return alert('No parsed rows to export.');

  const enableLinks = document.getElementById('enableLinks').checked;
  const header = ['Name','Set','Have','Want','Trade','Low','Mid','High'];
  const aoa = [header];

  parsedRows.forEach(r => {
    const nameCell = enableLinks && r.Link
      ? { f: `HYPERLINK(\"${r.Link.replace(/\"/g,'""')}\", \"${r.Name.replace(/\"/g,'""')}\")` }
      : r.Name;

    aoa.push([
      nameCell,
      r.Set,
      r.Have,
      r.Want,
      r.Trade,
      r.Low,
      r.Mid,
      r.High
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colWidths = header.map((h, cIdx) => {
    const maxLen = aoa.reduce((max, row) => {
      const cell = row[cIdx];
      let text = '';
      if (!cell) text = '';
      else if (typeof cell === 'object' && cell.f) {
        const m = cell.f.match(/HYPERLINK\([^,]+,\s*\"(.+)\"\)/i);
        text = m ? m[1] : cell.f;
      } else text = String(cell);
      return Math.max(max, text.length);
    }, h.length);
    return { wch: Math.max(3, maxLen + 1) };
  });
  ws['!cols'] = colWidths;

  const colIndex = {};
  header.forEach((h, i) => colIndex[h] = i);

  for (let r = 1; r < aoa.length; r++) {
    const src = parsedRows[r-1];
    [['Low','LowRaw'], ['Mid','MidRaw'], ['High','HighRaw']].forEach(([colName, rawField]) => {
      const c = colIndex[colName];
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) return;
      const rawVal = (src[rawField] || '').toString().trim();
      if (rawVal.startsWith('$') || /^\$\s*\d/.test(rawVal)) {
        if (typeof cell.v === 'number') {
          cell.t = 'n'; cell.z = '"$"#,##0.00';
        } else {
          const coerced = parseFloat(String(cell.v).replace(/[^0-9.\-]/g,''));	
          if (!Number.isNaN(coerced)) {
            cell.v = coerced; cell.t = 'n'; cell.z = '"$"#,##0.00';
          }
        }
      }
    });
    ['Have','Want','Trade'].forEach(colName => {
      const c = colIndex[colName];
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) return;
      const srcVal = parsedRows[r-1][colName];
      if (typeof srcVal === 'number') {
        cell.v = srcVal; cell.t = 'n';
      } else {
        const coerced = parseInt(String(cell.v).replace(/[^0-9\-]/g,''),10);
        if (!Number.isNaN(coerced)) { cell.v = coerced; cell.t = 'n'; }
      }
    });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TCG Collection');
  XLSX.writeFile(wb, 'tcgplayer_collection.xlsx');
});

function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
