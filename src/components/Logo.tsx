/**
 * RUTHEX logo component.
 *
 * Renders `/logo.png` from the public dir at the requested size. On the dashboard
 * sidebar (dark background) we invert the gold mark by adding the `onDark`
 * class — a small touch-up that makes the logo legible on the green panel.
 */
interface LogoProps {
  size?: number;       // px height
  onDark?: boolean;    // present against RUTHEX Green sidebar
  showWordmark?: boolean;
  className?: string;
}

export function Logo({ size = 36, onDark = false, showWordmark = false, className = '' }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/logo.png"
        alt="RUTHEX Lending Institution"
        width={size}
        height={size}
        className={onDark ? 'logo-on-dark' : ''}
        style={{ height: size, width: 'auto' }}
      />
      {showWordmark && (
        <span className={`font-bold tracking-tight ${onDark ? 'text-white' : 'text-ink'}`} style={{ fontSize: size * 0.55 }}>
          RUTHEX
        </span>
      )}
    </span>
  );
}
