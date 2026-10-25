/**
 * iOS Safari marks navigator.vibrate as readonly. Phaser writes it during
 * import and the whole game dies — boot stays at 0%.
 */
try {
  const proto = Navigator.prototype as Navigator & { vibrate?: unknown };
  const current = typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : () => false;
  Object.defineProperty(proto, 'vibrate', {
    configurable: true,
    writable: true,
    enumerable: true,
    value: current,
  });
} catch {
  /* assignment still patched in vite.config for the Phaser source */
}
