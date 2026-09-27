// Decorative background: soft squares and rectangles drifting slowly from bottom to top.
// Purely visual (aria-hidden, no pointer events) and disabled for prefers-reduced-motion.

interface Shape {
  left: number // % of viewport width
  w: number // px
  h: number // px
  duration: number // s for one full rise
  delay: number // s (negative = already mid-way on load)
  rotate: number // deg of drift rotation
  tone: 'brand' | 'accent' | 'neutral'
}

// Fixed layout so the background looks the same on every load (no random reflow).
const SHAPES: Shape[] = [
  { left: 4, w: 120, h: 120, duration: 38, delay: -4, rotate: 18, tone: 'brand' },
  { left: 14, w: 180, h: 110, duration: 46, delay: -22, rotate: -12, tone: 'accent' },
  { left: 27, w: 90, h: 90, duration: 34, delay: -12, rotate: 24, tone: 'neutral' },
  { left: 38, w: 150, h: 150, duration: 52, delay: -35, rotate: -20, tone: 'brand' },
  { left: 52, w: 200, h: 120, duration: 48, delay: -8, rotate: 10, tone: 'neutral' },
  { left: 63, w: 110, h: 110, duration: 36, delay: -28, rotate: -16, tone: 'accent' },
  { left: 74, w: 160, h: 100, duration: 44, delay: -16, rotate: 14, tone: 'brand' },
  { left: 85, w: 130, h: 130, duration: 40, delay: -30, rotate: -22, tone: 'neutral' },
  { left: 92, w: 96, h: 150, duration: 50, delay: -2, rotate: 8, tone: 'accent' },
  { left: 45, w: 100, h: 70, duration: 42, delay: -40, rotate: -8, tone: 'accent' },
]

export default function FloatingShapes() {
  return (
    <div className="floating-shapes" aria-hidden>
      {SHAPES.map((s, i) => (
        <span
          key={i}
          className={`shape shape-${s.tone}`}
          style={
            {
              left: `${s.left}%`,
              width: s.w,
              height: s.h,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
              '--rot': `${s.rotate}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
