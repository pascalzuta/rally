// Rally brand atoms — logo mark (the "R" glyph from the real brand SVG)
// and the wordmark. Extracted and simplified from brand/rally-logo.svg.

function RallyMark({ size = 32, color = '#231f20' }) {
  return (
    <svg width={size} height={size * (30 / 35)} viewBox="-1 10 35 30" aria-label="Rally">
      <path
        fill={color}
        transform="matrix(1,0,0,-1,16.67598,32.51674)"
        d="M0 0-.646-3.04C-.984-4.63-1.965-6.115-3.02-7.372H5.64C8.402-7.372 11.117-5.133 11.704-2.371L13.143 4.401H5.336C2.906 4.401 .517 2.43 0 0M-1.103 12.623-.449 15.698C-.015 17.742-1.05 19.465-2.837 19.957-3.168 20.048-3.527 20.074-3.889 20.074H-6.317C-9.079 20.074-11.794 17.835-12.381 15.073L-16.089-2.371C-16.676-5.133-14.913-7.372-12.151-7.372H-9.772C-8.49-7.372-7.126-6.862-6.086-5.886-5.269-5.119-4.663-4.126-4.432-3.04L-3.786 0C-3.247 2.537-1.603 4.809 .534 6.311-.965 7.814-1.642 10.086-1.103 12.623M11.474 20.074H2.786C3.321 18.807 3.679 17.306 3.337 15.698L2.683 12.623C2.166 10.192 3.718 8.222 6.149 8.222H13.956L15.412 15.073C15.999 17.835 14.236 20.074 11.474 20.074"
      />
    </svg>
  );
}

// Rally wordmark — "Rally" in the same typeface treatment as the brand PDF.
// Rendered as tuned text for simplicity (brand's Logotype V02C is a custom
// face we don't have; SF Pro Display Bold with tight tracking is a faithful
// match and keeps the file light).
function RallyWordmark({ size = 22, color = '#231f20' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: size * 0.28,
      fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
      fontWeight: 800, fontSize: size, letterSpacing: -0.02 * size,
      color, lineHeight: 1,
    }}>
      <RallyMark size={size * 1.15} color={color} />
      <span style={{ marginTop: size * 0.04 }}>Rally</span>
    </div>
  );
}

// Placeholder avatar — a colored square with monogram, per "placeholders
// are better than bad attempts" guidance.
function Avatar({ name, size = 40, hue = 220 }) {
  const initials = (name || '??').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `oklch(0.58 0.17 ${hue})`,
      color: `oklch(0.98 0.02 ${hue})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, system-ui, sans-serif',
      fontWeight: 700, fontSize: size * 0.38, letterSpacing: -0.5,
      flexShrink: 0,
      boxShadow: `inset 0 -${Math.max(2, size * 0.04)}px 0 oklch(0.42 0.15 ${hue})`,
    }}>
      {initials}
    </div>
  );
}

Object.assign(window, { RallyMark, RallyWordmark, Avatar });
