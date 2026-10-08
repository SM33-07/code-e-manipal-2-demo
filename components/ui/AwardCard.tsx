import Image from "next/image";
import Link from "next/link";

export function AwardCard({ href, image, title, team, description, placement, label, featured = false }: { href: string; image: string; title: string; team: string; description: string; placement: string; label: string; featured?: boolean }) {
  return <Link href={href} className={`group block overflow-hidden rounded-2xl border bg-card shadow-sm card-hover-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${featured ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
      <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, 380px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      <span className="absolute left-3 top-3 rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-card-foreground shadow-sm">{placement}</span>
    </div>
    <div className="p-6"><p className="text-xs font-bold uppercase tracking-wider text-secondary">{label} · {team}</p><h3 className="mt-2 text-lg font-bold text-foreground group-hover:text-primary">{title}</h3><p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{description}</p><span className="mt-5 inline-block text-xs font-bold text-primary">Explore project →</span></div>
  </Link>;
}
