function normalizePhone(input = '') {
  let digits = String(input).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 9) digits = '998' + digits;
  if (digits.startsWith('0') && digits.length === 10) digits = '998' + digits.slice(1);
  return '+' + digits;
}

function isValidPhone(phone) {
  return /^\+\d{10,15}$/.test(phone || '');
}

module.exports = { normalizePhone, isValidPhone };
