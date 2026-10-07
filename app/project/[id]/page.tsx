"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"

import {
  ArrowLeft,
  Code2,
  Lightbulb,
  BookOpen,
  Github,
  Globe,
  Star
} from "lucide-react"
import dynamic from "next/dynamic"

import AppShell from "@/components/ui/AppShell"
import GlassCard from "@/components/ui/GlassCard"

import { useAuth } from "@/components/AuthProvider"

const JudgeScorePanel = dynamic(
  () => import("@/components/JudgeScorePanel"),
  { ssr: false }
);

export default function ProjectDetail() {
  const params = useParams()
  const router = useRouter()
  const { user, role } = useAuth()
  const id = params.id as string

  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProject()
  }, [])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/submissions/${id}`)
      const json = await res.json()
      setProject(json.data)
    } catch (err) {
      console.error("Failed to load project", err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <h1 className="text-foreground text-xl font-medium">Loading project details...</h1>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <h1 className="text-foreground text-2xl font-bold">Project not found</h1>
      </div>
    )
  }

  return (
    <AppShell>
      <div className="min-h-screen relative overflow-hidden">
        <div className="relative z-10">
          <div className="container mx-auto px-4 py-8">
            <motion.button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary mb-6 transition-colors font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </motion.button>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <GlassCard className="p-6 border border-border bg-card">
                  <h1 className="text-3xl text-foreground font-bold tracking-tight">
                    {project.title}
                  </h1>
                  <p className="text-primary font-medium mt-2">
                    by {project.teams?.name ?? "Unknown Team"}
                  </p>
                </GlassCard>

                {project.demo_video_url && (
                  <GlassCard className="p-6 border border-border bg-card">
                    <h2 className="text-foreground text-xl font-semibold mb-4">Demo Video</h2>
                    <video
                      src={project.demo_video_url}
                      controls
                      autoPlay
                      loop
                      className="rounded-lg w-full max-h-[480px] bg-black"
                    />
                  </GlassCard>
                )}

                <GlassCard className="p-6 border border-border bg-card">
                  <h2 className="text-foreground text-xl font-semibold flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-secondary" />
                    Project Overview
                  </h2>
                  <p className="text-muted-foreground mt-3 leading-relaxed">
                    {project.description ?? project.summary}
                  </p>
                </GlassCard>

                {project.technical_challenges && (
                  <GlassCard className="p-6 border border-border bg-card">
                    <h2 className="text-foreground text-xl font-semibold flex items-center gap-2">
                      <Code2 className="w-5 h-5 text-secondary" />
                      Technical Implementation
                    </h2>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                      {project.technical_challenges}
                    </p>
                  </GlassCard>
                )}

                {project.lessons_learned && (
                  <GlassCard className="p-6 border border-border bg-card">
                    <h2 className="text-foreground text-xl font-semibold flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-secondary" />
                      Reflection
                    </h2>
                    <p className="text-muted-foreground mt-3 leading-relaxed">
                      {project.lessons_learned}
                    </p>
                  </GlassCard>
                )}
              </div>

              <div className="space-y-6">
                <GlassCard className="p-6 border border-border bg-card">
                  <h3 className="text-foreground text-lg font-semibold mb-3 flex items-center gap-2">
                    <Star className="text-secondary w-5 h-5" />
                    Project Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      <span className="text-foreground font-medium">Category:</span> {project.category}
                    </p>
                    <p className="text-muted-foreground">
                      <span className="text-foreground font-medium">Status:</span> {project.status}
                    </p>
                    {project.technologies && project.technologies.length > 0 && (
                      <p className="text-muted-foreground">
                        <span className="text-foreground font-medium">Tech:</span> {project.technologies.join(", ")}
                      </p>
                    )}
                  </div>
                </GlassCard>

                {(project.github_url || project.demo_url || project.docs_url) && (
                  <GlassCard className="p-6 border border-border bg-card space-y-4">
                    {project.github_url && (
                      <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline font-medium text-sm">
                        <Github className="w-4 h-4" /> GitHub Repository
                      </a>
                    )}
                    {project.demo_url && (
                      <a href={project.demo_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline font-medium text-sm">
                        <Globe className="w-4 h-4" /> Live Demo
                      </a>
                    )}
                    {project.docs_url && (
                      <a href={project.docs_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline font-medium text-sm">
                        <BookOpen className="w-4 h-4" /> Documentation
                      </a>
                    )}
                  </GlassCard>
                )}

                {role === "judge" && (
                  <JudgeScorePanel projectId={id} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
