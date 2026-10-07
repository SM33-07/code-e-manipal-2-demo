import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { EVENT_IDENTITY } from "@/lib/event/eventConstants";

const exploreLinks = [
  { label: "Home", href: "/" },
  { label: "Timeline", href: "/timeline" },
  { label: "Problem Statements", href: "/problem-statements" },
  { label: "Results", href: "/results" },
  { label: "FAQ", href: "/faq" },
];

const organisers = [
  {
    name: "Yash Sahai",
    email: "yashsrivastava3745@gmail.com",
    phone: "+91 8707877673",
  },
  {
    name: "Abhinav Aryan",
    email: "abhinav.ong@gmail.com",
    phone: "+91 9031190278",
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer bg-jali-pattern relative z-10 mt-12 overflow-hidden border-t border-border text-foreground">
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-x-10 gap-y-12 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.82fr)_minmax(0,0.82fr)] lg:gap-x-12 lg:gap-y-16 lg:px-8 lg:py-20">
        <section aria-label="Code-e-Manipal identity" className="lg:col-start-1 lg:row-start-1">
          <div data-footer-reveal="1">
            <BrandLogo size="sm" />
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
              Code-e-Manipal 2.0
            </p>
          </div>
          <h2
            data-footer-reveal="2"
            className="mt-5 max-w-2xl font-serif text-[clamp(2.125rem,4vw,4rem)] font-normal leading-[1.05] tracking-[-0.035em] text-foreground"
          >
            Where ideas <span className="text-primary">become</span>{" "}
            <span className="text-secondary">impact.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            A {EVENT_IDENTITY.durationHours}-hour engineering sprint at Manipal
            University Jaipur.
          </p>
        </section>

        <nav
          aria-label="Explore"
          data-footer-reveal="3"
          className="lg:col-start-2 lg:row-start-1"
        >
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
            Explore
          </h3>
          <ul className="mt-5 grid gap-3">
            {exploreLinks.map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:translate-x-1 hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>{label}</span>
                  <ArrowRight
                    aria-hidden="true"
                    size={14}
                    className="text-secondary opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section
          aria-labelledby="footer-connect"
          data-footer-reveal="4"
          className="lg:col-start-3 lg:row-start-1"
        >
          <h3
            id="footer-connect"
            className="text-xs font-bold uppercase tracking-[0.18em] text-secondary"
          >
            Connect
          </h3>
          <div className="mt-5 grid gap-3">
            <a
              href="https://www.instagram.com/code_e_manipal/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-fit items-center gap-3 rounded-md text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground hover:underline hover:decoration-primary hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Instagram
                aria-hidden="true"
                size={17}
                className="text-primary transition-transform duration-200 group-hover:-translate-y-0.5"
              />
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Instagram
                </span>
                <span className="mt-0.5 block font-semibold">@code_e_manipal</span>
              </span>
              <ArrowUpRight aria-hidden="true" size={13} className="self-start opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="https://www.linkedin.com/in/learnit-department-of-information-technology-739019182"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-fit items-center gap-3 rounded-md text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground hover:underline hover:decoration-primary hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Linkedin
                aria-hidden="true"
                size={17}
                className="text-primary transition-transform duration-200 group-hover:-translate-y-0.5"
              />
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  LinkedIn
                </span>
                <span className="mt-0.5 block font-semibold">LearnIT · MUJ</span>
              </span>
              <ArrowUpRight aria-hidden="true" size={13} className="self-start opacity-60 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </section>

        <section
          aria-labelledby="footer-organisers"
          data-footer-reveal="5"
          className="border-t border-border pt-8 lg:col-span-2 lg:col-start-1 lg:row-start-2"
        >
          <div className="grid gap-5 sm:grid-cols-[minmax(9rem,0.55fr)_minmax(0,1.45fr)] sm:gap-8">
            <div>
              <h3
                id="footer-organisers"
                className="text-xs font-bold uppercase tracking-[0.18em] text-secondary"
              >
                Contact the organisers
              </h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Questions about the sprint? Reach out to the team.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {organisers.map((person) => (
                <li key={person.email}>
                  <article className="group h-full rounded-2xl border border-border bg-surface-elevated/75 p-4 transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-secondary/50 hover:bg-surface-elevated hover:shadow-md">
                    <h4 className="text-sm font-bold text-foreground">{person.name}</h4>
                    <a
                      href={`mailto:${person.email}`}
                      className="mt-3 flex w-fit items-center gap-2 break-all text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Mail aria-hidden="true" size={13} className="shrink-0 text-secondary" />
                      {person.email}
                    </a>
                    <a
                      href={`tel:${person.phone.replace(/\s/g, "")}`}
                      className="mt-2 flex w-fit items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Phone aria-hidden="true" size={13} className="shrink-0 text-secondary" />
                      {person.phone}
                    </a>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="footer-address"
          data-footer-reveal="6"
          className="border-t border-border pt-8 lg:col-start-3 lg:row-start-2"
        >
          <h3
            id="footer-address"
            className="text-xs font-bold uppercase tracking-[0.18em] text-secondary"
          >
            Find us
          </h3>
          <div className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
            <MapPin aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-primary" />
            <p>
              <span className="font-semibold text-foreground">Manipal University Jaipur</span>
              <br />
              Dehmi Kalan, Rajasthan
            </p>
          </div>
        </section>
      </div>

      <div
        data-footer-reveal="7"
        className="relative border-t border-border bg-surface-elevated/70"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-[11px] text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>© 2026 Code-e-Manipal 2.0</p>
          <p className="font-semibold tracking-wide">LearnIT · MUJ</p>
          <p>Manipal University Jaipur · Dehmi Kalan, Rajasthan</p>
        </div>
      </div>
    </footer>
  );
}
