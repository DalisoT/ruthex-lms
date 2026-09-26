/**
 * RUTHEX logo component.
 *
 * The PNG itself is a transparent green R mark — fine on dark backgrounds but
 * visually thin against white. We wrap the image in a coloured badge so the
 * mark is always prominent:
 *
 *   - `onDark={false}` (default)  -> soft-cream square + green border + drop
 *     shadow. The green R reads sharply against the cream panel.
 *   - `onDark={true}` (sidebar)    -> white panel + faint gold border, so the
 *     mark lifts off the RUTHEX Green sidebar.
 *
 * `variant` lets callers override the panel colour for hero sections
 * (e.g. `variant="green"` for a solid green badge with white mark).
 */
interface LogoProps {
  size?: number;           // px height of the badge square
  onDark?: boolean;        // present against RUTHEX Green sidebar
  variant?: 'default' | 'green' | 'gold' | 'outline';
  showWordmark?: boolean;
  className?: string;
}

export function Logo({
  size = 44,
  onDark = false,
  variant = 'default',
  showWordmark = false,
  className = '',
}: LogoProps) {
  // Padding around the image so the R mark has breathing room inside the badge.
  const pad = Math.max(4, Math.round(size * 0.14));
  const imgSize = size - pad * 2;

  // Pick the panel style. `default` resolves to either the light or dark
  // variant depending on `onDark`, but `variant` overrides it.
  let panel = '';
  if (variant === 'green') panel = 'logo-panel logo-panel--green';
  else if (variant === 'gold') panel = 'logo-panel logo-panel--gold';
  else if (variant === 'outline') panel = 'logo-panel logo-panel--outline';
  else if (onDark) panel = 'logo-panel logo-panel--on-dark';
  else panel = 'logo-panel logo-panel--default';

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className={panel}
        style={{ width: size, height: size, padding: pad }}
        aria-hidden="true"
      >
        <img
          src="/logo.png"
          alt="RUTHEX Lending Institution"
          width={imgSize}
          height={imgSize}
          className={onDark && variant === 'default' ? 'logo-on-dark' : ''}
          style={{ height: imgSize, width: imgSize }}
          draggable={false}
        />
      </span>
      {showWordmark && (
        <span
          className={`font-bold tracking-tight ${onDark ? 'text-white' : 'text-ink'}`}
          style={{ fontSize: size * 0.5, lineHeight: 1 }}
        >
          RUTHEX
        </span>
      )}
    </span>
  );
}
