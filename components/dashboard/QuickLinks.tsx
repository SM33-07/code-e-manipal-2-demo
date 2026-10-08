'use client';

import React from 'react';
import {
  FileText,
  BookOpen,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  Sparkles,
  Shield,
} from 'lucide-react';

interface QuickLinkItem {
  title: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  external?: boolean;
}

const RESOURCES: QuickLinkItem[] = [
  {
    title: 'Event Timeline',
    desc: 'Track phases, milestones, and published deadlines',
    href: '/timeline',
    icon: Shield,
  },
  {
    title: 'Submission Specs',
    desc: 'Max 3 screenshots (5MB) & 1 Presentation PDF (15MB)',
    href: '/submit',
    icon: FileText,
  },
  {
    title: 'Rules & Guidelines',
    desc: 'Portal workflow, submission requirements, and support',
    href: '/guidelines',
    icon: BookOpen,
  },
  {
    title: 'Problem Statements',
    desc: 'Review published tracks and challenge briefs',
    href: '/problem-statements',
    icon: MessageSquare,
  },
  {
    title: 'Participant FAQ',
    desc: 'Answers to login, teams, submission, and rubric queries',
    href: '/faq',
    icon: HelpCircle,
  },
];

export function QuickLinks() {
  return (
    <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Participant Resources
        </h3>
        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
          Quick Access
        </span>
      </div>

      <div className="space-y-2.5">
        {RESOURCES.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.title}
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 hover:bg-secondary/80 border border-border/40 hover:border-primary/30 transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1">
                    {item.desc}
                  </span>
                </div>
              </div>

              {item.external ? (
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}
