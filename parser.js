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

    const set = tds[4] ? safeText(tds[4]) : '';

    const lowRaw  = tds[5] ? safeText(tds[5]) : '';
    const midRaw  = tds[6] ? safeText(tds[6]) : '';
    const highRaw = tds[7] ? safeText(tds[7]) : '';

    parsedRows.push({
      Name: name,
      Link: link,
      Set: set,
      Have: parseIntSafe(haveRaw),
      Want: parseIntSafe(wantRaw),
      Trade: parseIntSafe(tradeRaw),
      Low: parseFloatSafe(lowRaw),
      Mid: parseFloatSafe(midRaw),
      High: parseFloatSafe(highRaw)
    });
  });

  statusEl.textContent = `Parsed ${parsedRows.length} rows.`;

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
    const nameCell = enableLinks && r.Link
      ? `<a class="cardlink" href="${r.Link}" target="_blank">${escapeHtml(r.Name)}</a>`
      : escapeHtml(r.Name);

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
    return String(ax ?? '').localeCompare(String(bx ?? ''));
  });

  renderTable();
}

function updateExportButtons() {
  const hasRows = parsedRows.length > 0;
  exportCsvBtn.disabled = !hasRows;
  exportXlsxBtn.disabled = !hasRows;
}

exportCsvBtn.addEventListener('click', () => {
  if (!parsedRows.length) return;

  const headers = ['Name','Set','Have','Want','Trade','Low','Mid','High'];

  const csv = [
    headers.join(','),
    ...parsedRows.map(r => [
      `"${r.Name}"`,
      `"${r.Set}"`,
      r.Have,
      r.Want,
      r.Trade,
      r.Low,
      r.Mid,
      r.High
    ].join(','))
  ].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'tcgplayer_collection.csv';
  a.click();

  URL.revokeObjectURL(url);
});

exportXlsxBtn.addEventListener('click', async () => {
  if (!parsedRows.length) return;

  const enableLinks = document.getElementById('enableLinks').checked;
  const headers = ['Name','Set','Have','Want','Trade','Low','Mid','High'];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('TCG Collection');

  worksheet.addRow(headers);
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  parsedRows.forEach(r => {
    const row = worksheet.addRow([
      r.Name,
      r.Set,
      r.Have,
      r.Want,
      r.Trade,
      r.Low,
      r.Mid,
      r.High
    ]);

    if (enableLinks && r.Link) {
      const cell = row.getCell(1);
      cell.value = { text: r.Name, hyperlink: r.Link };
      cell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }

    [6,7,8].forEach(col => {
      const cell = row.getCell(col);
      const num = Number(cell.value);

      if (!Number.isNaN(num)) {
        cell.value = num;
      }

      cell.numFmt = '"$"#,##0.00';
    });
  });

  const columns = headers.map(header => {
    let max = header.length;

    parsedRows.forEach(r => {
      const val = String(r[header] ?? '');
      if (val.length > max) max = val.length;
    });

    let width = max + 2;

    if (header === 'Name') width = Math.min(width, 60);
    if (header === 'Set') width = Math.min(width, 45);
    if (['Have','Want','Trade'].includes(header)) width = 10;
    if (['Low','Mid','High'].includes(header)) width = 14;

    return { key: header, width };
  });

  worksheet.columns = columns;

  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tcgplayer_collection.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}