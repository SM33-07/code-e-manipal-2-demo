import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";

interface Props {
  teamName: string;
  hackathonName: string;
  submittedAt: string;
}

export default function SubmissionHeader({ teamName, hackathonName, submittedAt }: Props) {
  const date = new Date(submittedAt);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="glass-card p-6 md:p-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
        <Image
          src="/logo.png"
          alt="Code-e-Manipal Logo"
          width={48}
          height={24}
          className="object-contain bg-transparent"
        />
        <div className="flex-1">
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-1">
            {hackathonName}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text">
            Project Submission Summary
          </h1>
          <p className="text-foreground/70 mt-1">
            Team <span className="font-semibold text-primary">{teamName}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {format(date, "MMM d, yyyy")}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {format(date, "h:mm a")}
          </span>
        </div>
      </div>
    </motion.header>
  );
}
