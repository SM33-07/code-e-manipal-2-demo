import Image from "next/image";
import { ExternalLink } from "lucide-react";

// ─── Partner Data Model ───────────────────────────────────────────────────────
export interface Partner {
  /** Display name — also used as fallback alt text */
  name: string;
  /** Absolute path from /public or remote URL */
  logo: string;
  /** Optional external website URL */
  website?: string;
  /** Accessible link label */
  ariaLabel?: string;
  /** Short descriptor shown below the logo */
  descriptor?: string;
  /** True → render logo on a light neutral tile so white-bg logos read on dark mode */
  requiresLightTile?: boolean;
  /** True → this partner gets the featured hero treatment */
  featured?: boolean;
  /** Override tile background (CSS color or var) */
  tileBg?: string;
}

// ─── Official Partner List — single source of truth ─────────────────────────
export const OFFICIAL_PARTNERS: Partner[] = [
  {
    name: "The Hosteller",
    logo: "/images/partners/the-hosteller-20261007.png",
    website: "https://www.thehosteller.com/",
    ariaLabel: "Visit The Hosteller",
    descriptor: "Official Stay Partner",
    featured: true,
  },
  {
    name: "Unstop",
    logo: "/images/partners/unstop-20261007.png",
    website: "https://unstop.com/",
    ariaLabel: "Visit Unstop",
    descriptor: "Official Registration Platform",
    requiresLightTile: true,
  },
  {
    name: "E-Cell MUJ",
    logo: "/images/partners/ecell-20261007.png",
    descriptor: "Entrepreneurship Cell · MUJ",
    requiresLightTile: true,
  },
  {
    name: "VickyBytes",
    logo: "/images/partners/vickybytes-20261007.png",
    descriptor: "Official Tech Partner",
    requiresLightTile: true,
  },
  {
    name: "HackerRank",
    logo: "/images/partners/hackerrank-20261007.png",
    website: "https://www.hackerrank.com/",
    ariaLabel: "Visit HackerRank",
    descriptor: "Official Coding Partner",
    requiresLightTile: true,
  },
];

// ─── Logo Tile (supporting partners) ─────────────────────────────────────────
function LogoTile({ partner }: { partner: Partner }) {
  const tileClass = partner.requiresLightTile
    ? "flex items-center justify-center rounded-xl p-4 bg-[#F8F5F0] dark:bg-[#EFECE6]"
    : "flex items-center justify-center rounded-xl p-4";
  const tileStyle = partner.tileBg ? { backgroundColor: partner.tileBg } : undefined;

  return (
    <div className={tileClass} style={tileStyle}>
      <Image
        src={partner.logo}
        alt={partner.name}
        width={180}
        height={72}
        className="h-14 w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.04] sm:h-16"
        loading="lazy"
      />
    </div>
  );
}

// ─── Featured Tile (The Hosteller) ───────────────────────────────────────────
function FeaturedTile({ partner }: { partner: Partner }) {
  return (
    <div className="featured-partner-panel relative flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
      <div className="featured-partner-logo-plate flex items-center justify-center rounded-2xl bg-[#F4EBDD] p-5 sm:p-6 sm:justify-start">
        <Image
          src={partner.logo}
          alt={partner.name}
          width={360}
          height={120}
          className="h-16 w-auto object-contain sm:h-20"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col gap-1 text-center sm:items-end sm:text-right">
        <span className="inline-flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#F4EBDD] sm:justify-end">
          <span aria-hidden="true" className="h-px w-5 bg-[#B08A45]" />
          Featured Partner
        </span>
        {partner.descriptor && (
          <span className="text-xs font-semibold text-[#F4EBDD]">{partner.descriptor}</span>
        )}
        {partner.website && (
          <span className="mt-1 inline-flex items-center justify-center gap-1 text-[11px] font-bold text-[#F4EBDD]/80 transition-colors sm:justify-end group-hover:text-[#F4EBDD]">
            <ExternalLink className="featured-partner-external-icon" size={11} aria-hidden="true" />
            thehosteller.com
          </span>
        )}
      </div>
    </div>
  );
}

// ─── SponsorPartners ─────────────────────────────────────────────────────────
export function SponsorPartners({
  partners = OFFICIAL_PARTNERS,
  className = "",
}: {
  partners?: Partner[];
  className?: string;
}) {
  const featured = partners.find((p) => p.featured);
  const supporting = partners.filter((p) => !p.featured);

  return (
    <section
      aria-labelledby="partners-heading"
      className={`border-y border-border bg-surface-elevated/95 p-5 sm:border sm:p-8 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-secondary">
            Partners &amp; Sponsors
          </p>
          <h2
            id="partners-heading"
            className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl"
          >
            Organized with purpose.
          </h2>
        </div>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Verified organizations and platforms backing Code‑e‑Manipal 2.0.
        </p>
      </div>

      {/* Featured partner */}
      {featured && (
        <div className="mt-7">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Featured Partner
          </p>
          {featured.website ? (
            <a
              href={featured.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={featured.ariaLabel ?? `Visit ${featured.name}`}
              className="featured-partner-link group block overflow-hidden rounded-2xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FeaturedTile partner={featured} />
            </a>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <FeaturedTile partner={featured} />
            </div>
          )}
        </div>
      )}

      {/* Supporting partners */}
      {supporting.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Supporting Partners
          </p>
          <div className="grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {supporting.map((partner) => {
              const tileClass =
                "group block bg-card p-5 transition-[background-color] duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
              const content = (
                <div className="flex flex-col gap-3">
                  <LogoTile partner={partner} />
                  <div>
                    <p className="text-sm font-bold text-foreground leading-snug">
                      {partner.name}
                    </p>
                    {partner.descriptor && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {partner.descriptor}
                      </p>
                    )}
                  </div>
                  {partner.website && (
                    <ExternalLink
                      size={13}
                      className="text-muted-foreground/50 group-hover:text-secondary transition-colors"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );

              return partner.website ? (
                <a
                  key={partner.name}
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={tileClass}
                  aria-label={partner.ariaLabel ?? `Visit ${partner.name}`}
                >
                  {content}
                </a>
              ) : (
                <div key={partner.name} className={tileClass}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
