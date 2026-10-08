import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCta({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return <section className="rounded-3xl border border-primary/30 bg-primary p-7 text-primary-foreground shadow-md sm:p-10">
    <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-foreground/75">Code-e-Manipal 2.0</p><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{title}</h2><p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">{description}</p></div><Link href={href} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{action}<ArrowRight size={15} /></Link></div>
  </section>;
}
