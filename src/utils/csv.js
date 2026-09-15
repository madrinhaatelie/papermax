/**
 * PAPER MAX - CSV Import / Export & Validation Utilities
 */

export function parseCSV(csvText) {
  if (!csvText || !csvText.trim()) return { headers: [], rows: [] };
  // Remove BOM if present (e.g. from Excel UTF-8 export)
  const cleanCsv = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText;
  const lines = cleanCsv.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Detect delimiter: semicolon or comma
  const firstLine = lines[0];
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';

  // Parse header
  const headers = splitCSVLine(firstLine, delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;
    const values = splitCSVLine(rawLine, delimiter);
    const rowObj = { _line: i + 1 };
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(rowObj);
  }
  return { headers, rows };
}

function splitCSVLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function generateCSV(headers, rows) {
  const delimiter = ';';
  
  // Suporte tanto para array de strings ['Col1', 'Col2'] quanto array de objetos [{ key: 'col1', label: 'Col1' }]
  const headerLabels = headers.map(h => typeof h === 'object' && h !== null ? (h.label || h.key || '') : String(h));
  const headerKeys = headers.map(h => typeof h === 'object' && h !== null ? (h.key || h.label || '') : String(h));

  const headerLine = headerLabels.map(lbl => `"${String(lbl).replace(/"/g, '""')}"`).join(delimiter);
  
  const rowLines = rows.map(row => {
    return headerKeys.map((k, idx) => {
      const labelKey = headerLabels[idx];
      let val = '';
      if (row[k] !== undefined && row[k] !== null) {
        val = String(row[k]);
      } else if (labelKey && row[labelKey] !== undefined && row[labelKey] !== null) {
        val = String(row[labelKey]);
      }
      return `"${val.replace(/"/g, '""')}"`;
    }).join(delimiter);
  });

  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n'); // Include BOM for Excel
}


export function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const downloadCSVFile = downloadCSV;
