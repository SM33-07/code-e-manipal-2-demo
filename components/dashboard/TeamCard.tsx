'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, Copy, Check, ShieldCheck, ArrowRight, UserPlus, User } from 'lucide-react';

interface TeamMember {
  userId: string;
  role: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    inviteCode: string;
    track: string;
    leaderName?: string | null;
    members: TeamMember[];
  } | null;
}

export function TeamCard({ team }: TeamCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!team?.inviteCode) return;
    navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!team) {
    return (
      <div className="bg-card border border-dashed border-border/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full min-h-[300px] transition-all hover:border-primary/50">
        <div>
          <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">
            No Team Linked
          </h3>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            You are currently participating as an unaffiliated individual. Join an existing team with an invite code or create your own team to unlock project submissions.
          </p>
        </div>

        <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-stretch gap-2.5">
          <Link
            href="/team?action=create"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 transition-opacity"
          >
            <UserPlus className="w-4 h-4" />
            Create Team
          </Link>
          <Link
            href="/team?action=join"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm border border-border/50 transition-colors"
          >
            Join Team
          </Link>
        </div>
      </div>
    );
  }

  const memberCount = team.members?.length || 1;
  const maxMembers = 4;

  return (
    <div className="bg-card border border-border/70 rounded-2xl p-6 shadow-sm flex flex-col justify-between h-full min-h-[300px] transition-all hover:shadow-md">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {team.track || 'Track: General'}
              </span>
              <span className="text-xs text-muted-foreground">
                {memberCount}/{maxMembers} Members
              </span>
            </div>
            <h3 className="text-xl font-bold text-foreground tracking-tight">
              {team.name}
            </h3>
          </div>

          <Link
            href="/team"
            className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 group transition-colors"
          >
            Manage
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Invite Code Box */}
        <div className="mb-5 p-3 rounded-xl bg-secondary/60 border border-border/40 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Team Invite Code
            </span>
            <span className="font-mono text-sm font-bold text-foreground tracking-wider">
              {team.inviteCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="size-8 rounded-lg bg-card hover:bg-card/90 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Copy invite code"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Members Roster */}
        <div>
          <span className="text-xs font-semibold text-muted-foreground block mb-2.5">
            Team Members
          </span>
          <div className="space-y-2">
            {team.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/20 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-xs border border-primary/20">
                    {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground truncate max-w-[140px] sm:max-w-[180px]">
                      {member.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px] sm:max-w-[180px]">
                      {member.email}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    member.role === 'leader'
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'bg-muted/40 text-muted-foreground'
                  }`}
                >
                  {member.role === 'leader' ? 'Leader' : 'Member'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Roster Verified
        </span>
        <Link href="/team" className="font-medium hover:underline text-foreground">
          View full roster →
        </Link>
      </div>
    </div>
  );
}
