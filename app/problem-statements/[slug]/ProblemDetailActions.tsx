"use client";

import React, { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { toast } from 'sonner';

export function ProblemDetailActions({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.success(`Copied ${id} to clipboard`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast.success("Challenge link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopyId}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:border-border/80 transition-all shadow-sm"
        title="Copy Problem ID"
      >
        {copiedId ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
        <span>{copiedId ? "Copied ID" : `Copy ${id}`}</span>
      </button>

      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:border-border/80 transition-all shadow-sm"
        title="Copy Challenge Link"
      >
        {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Share2 size={13} />}
        <span>{copiedLink ? "Link Copied" : "Share"}</span>
      </button>
    </div>
  );
}
