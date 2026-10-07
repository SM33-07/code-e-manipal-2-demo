"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { Users, FileText, Scale, Trophy } from "lucide-react"

type Phase = "Registration" | "Submission" | "Judging" | "Results"

const phases = [
  { name: "Registration", icon: Users, color: "from-blue-500 to-cyan-500", route: "/dashboard" },
  { name: "Submission", icon: FileText, color: "from-cyan-500 to-teal-500", route: "/submit" },
  { name: "Judging", icon: Scale, color: "from-teal-500 to-green-500", route: "/judge" },
  { name: "Results", icon: Trophy, color: "from-green-500 to-yellow-500", route: "/admin/results" },
]

export function LifecycleManagement() {

  const router = useRouter()
  const [activePhase, setActivePhase] = useState<Phase>("Submission")

  const handlePhaseClick = (phase: Phase, route: string) => {
    setActivePhase(phase)
    router.push(route)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">

      <h2 className="text-xl text-white mb-4">
        Lifecycle Management
      </h2>

      <div className="grid md:grid-cols-4 gap-4">

        {phases.map((phase) => {

          const Icon = phase.icon

          return (
            <motion.button
              key={phase.name}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePhaseClick(phase.name as Phase, phase.route)}
              className={`p-4 rounded-lg border border-white/10 text-white transition-all ${
                activePhase === phase.name
                  ? "bg-gradient-to-r " + phase.color
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              <Icon className="mx-auto mb-2" />
              {phase.name}
            </motion.button>
          )
        })}

      </div>
    </div>
  )
}
