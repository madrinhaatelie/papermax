/**
 * PAPER MAX - Sanitization and Formatting Utilities
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCurrency(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateBR(dateInput) {
  if (!dateInput) return '';
  // If already in DD/MM/AAAA or DD/MM/AA
  if (typeof dateInput === 'string' && /^\d{2}\/\d{2}\/\d{2,4}$/.test(dateInput)) {
    return dateInput;
  }
  // If ISO YYYY-MM-DD
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    const parts = dateInput.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateShortBR(dateInput) {
  const full = formatDateBR(dateInput);
  const parts = full.split('/');
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
  }
  return full;
}

export function formatDateWithHoursBR(dateInput) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatDateTimeParts(dateInput) {
  if (!dateInput) return { date: '—', time: '—' };
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return { date: '—', time: '—' };
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}`
  };
}

export function formatDurationText(startedAt, completedAt) {
  if (!startedAt) return null;
  const dStart = new Date(startedAt);
  const dEnd = completedAt ? new Date(completedAt) : new Date();
  if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) return null;
  
  const diffMs = dEnd.getTime() - dStart.getTime();
  if (diffMs < 0) return null;
  
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${Math.max(1, mins)}min`;
}

export function parseDateBRToISO(brDate) {
  if (!brDate) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(brDate)) return brDate;
  const parts = brDate.split('/');
  if (parts.length === 3) {
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}
