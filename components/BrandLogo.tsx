import Image from 'next/image'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'

export type BrandLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<
  BrandLogoSize,
  { className: string; width: number; height: number; src: string }
> = {
  xs: { className: 'h-6 w-6', width: 32, height: 32, src: BRAND.icons.favicon32 },
  sm: { className: 'h-9 w-9', width: 192, height: 192, src: BRAND.icons.chrome192 },
  md: { className: 'h-11 w-11', width: 192, height: 192, src: BRAND.icons.chrome192 },
  lg: { className: 'h-16 w-16', width: 512, height: 512, src: BRAND.logo },
  xl: { className: 'h-24 w-24 sm:h-28 sm:w-28', width: 512, height: 512, src: BRAND.logo },
}

type BrandLogoProps = {
  size?: BrandLogoSize
  className?: string
  priority?: boolean
}

export function BrandLogo({ size = 'md', className = '', priority = false }: BrandLogoProps) {
  const cfg = SIZE_MAP[size]
  return (
    <Image
      src={cfg.src}
      alt={BRAND.name}
      width={cfg.width}
      height={cfg.height}
      priority={priority}
      className={`${cfg.className} shrink-0 object-contain ${className}`.trim()}
    />
  )
}

type BrandMarkProps = {
  size?: BrandLogoSize
  showTitle?: boolean
  subtitle?: string
  href?: string
  className?: string
  titleClassName?: string
  onDark?: boolean
}

/** Logo + libellés (barre latérale, en-têtes). */
export function BrandMark({
  size = 'md',
  showTitle = true,
  subtitle = BRAND.tagline,
  href,
  className = '',
  titleClassName = '',
  onDark = true,
}: BrandMarkProps) {
  const titleColor = onDark ? 'text-white' : 'text-ink-900'
  const subtitleColor = onDark ? 'text-primary-300/90' : 'text-ink-500'

  const content = (
    <div className={`flex min-w-0 items-center gap-2.5 sm:gap-3 ${className}`.trim()} role="group" aria-label={BRAND.name}>
      <BrandLogo size={size} priority={size === 'lg' || size === 'xl'} />
      {showTitle ? (
        <div className="min-w-0">
          <p
            className={`font-display truncate font-bold tracking-tight ${titleColor} ${
              size === 'sm' ? 'text-sm' : size === 'lg' || size === 'xl' ? 'text-lg' : 'text-base'
            } ${titleClassName}`.trim()}
          >
            {BRAND.shortName}
          </p>
          {subtitle ? (
            <p
              className={`truncate text-[10px] font-semibold uppercase tracking-widest sm:text-[11px] ${subtitleColor}`}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="rounded-xl outline-offset-2 hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-400">
        {content}
      </Link>
    )
  }

  return content
}
