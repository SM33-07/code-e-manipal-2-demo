import { BookOpenCheck, CircleHelp, FileCheck2, ShieldCheck } from "lucide-react";
import Link from "next/link";

const guidance = [
  { icon: ShieldCheck, title: "Account access", text: "Use your provisioned credentials. Your portal access and actions are tied to your assigned role." },
  { icon: FileCheck2, title: "Submission workflow", text: "Save drafts while collaborating. Before finalizing, check each required field, external link, and uploaded asset—finalized submissions are locked." },
  { icon: BookOpenCheck, title: "Event conduct", text: "Follow announcements and published event instructions. The current event phase controls which actions are available." },
];

export default function GuidelinesPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-6 py-5">
      <header className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 text-primary">
          <BookOpenCheck className="size-5" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-[0.18em]">Participant help</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground">Rules & guidelines</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">A clear guide to using the portal during the event. Official event notices always take precedence.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        {guidance.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Icon className="size-5 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-semibold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
          </article>
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex items-start gap-3"><CircleHelp className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden="true" /><p className="text-sm text-muted-foreground">Need help with a team or submission? Check event announcements first, then contact the official support channel shared by organisers.</p></div>
        <Link href="/dashboard" className="shrink-0 rounded-lg border border-border bg-accent/50 px-4 py-2 text-center text-sm font-semibold text-foreground hover:bg-accent transition-colors">Back to dashboard</Link>
      </div>
    </section>
  );
}
