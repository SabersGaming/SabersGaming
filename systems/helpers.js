'use strict';
// ============================================================
// HELPERS — Pure utility functions. No state writes. No DOM.
// ============================================================

function formatNum(n) {
  if (n === undefined || n === null) return '0';
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1000000000) return (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n / 1000000000).toFixed(2).replace(/\.?0+$/, '') + 'B';
}

function formatTime(seconds) {
  seconds = Math.ceil(seconds);
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'm ' + (s > 0 ? s + 's' : '');
}

function roll(chance) {
  return Math.random() < chance;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
