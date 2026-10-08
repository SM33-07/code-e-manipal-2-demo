"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Grid, List as ListIcon, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { projects, categories } from "@/data/projects";

export default function ProjectGrid() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [visibleCount, setVisibleCount] = useState(15);

  const processedProjects = useMemo(() => {
    let list = [...projects];

    if (searchTerm.trim() !== "") {
      const query = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.shortIdea.toLowerCase().includes(query) ||
          p.teamName.toLowerCase().includes(query) ||
          p.technologies.some((t) => t.toLowerCase().includes(query))
      );
    }

    if (activeFilter === "Newest") {
      list = list.sort((a, b) => b.id.localeCompare(a.id));
    } else if (activeFilter !== "All") {
      list = list.filter((p) => p.category === activeFilter);
    }

    return list;
  }, [searchTerm, activeFilter]);

  const activeBatchProjects = useMemo(() => {
    return processedProjects.slice(0, visibleCount);
  }, [processedProjects, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 15);
  };

  const handleFilterSelect = (filter: string) => {
    setActiveFilter(filter);
    setVisibleCount(15);
  };

  const quickFilters = ["All", "Newest", ...categories];

  if (!mounted) return null;

  return (
    <section className="py-12 relative z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* ROW 1: THE CONTROL CENTER */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-5 pb-4 border-b border-border">
          {/* Spotlight Search */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search projects by title, team, or tech stack..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(15);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl outline-none transition-all border border-border bg-card text-foreground text-xs placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          {/* Grid / List Toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-card text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid Mode"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-card text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="List Mode"
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>

        {/* ROW 2: THE QUICK FILTER BAR */}
        <div className="w-full overflow-x-auto scrollbar-none mb-8">
          <div className="flex gap-2 min-w-max pb-1">
            {quickFilters.map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <button
                  key={filter}
                  onClick={() => handleFilterSelect(filter)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN BODY: RESPONSIVE GRID / LIST */}
        {activeBatchProjects.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm font-medium text-muted-foreground">
              No projects found matching the criteria.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          /* GRID MODE */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {activeBatchProjects.map((project) => (
              <motion.div
                key={project.id}
                layoutId={`project-container-${project.id}`}
                onClick={() => setSelectedProject(project)}
                className="cursor-pointer group flex flex-col items-center"
              >
                <div className="w-full aspect-square rounded-2xl overflow-hidden relative border border-border bg-card shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:border-primary/50">
                  <Image
                    src={project.videoThumbnail}
                    alt={project.title}
                    fill
                    loading="lazy"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <span className="text-xs font-semibold mt-2 text-center line-clamp-1 max-w-full px-1 text-foreground group-hover:text-primary transition-colors">
                  {project.title}
                </span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">
                  {project.teamName}
                </span>
              </motion.div>
            ))}
          </div>
        ) : (
          /* LIST MODE */
          <div className="flex flex-col gap-3 max-w-4xl mx-auto">
            {activeBatchProjects.map((project) => (
              <motion.div
                key={project.id}
                layoutId={`project-container-${project.id}`}
                className="flex items-center gap-4 p-3.5 rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/40 group"
              >
                <div 
                  onClick={() => setSelectedProject(project)}
                  className="w-20 h-20 md:w-24 md:h-24 shrink-0 relative rounded-xl overflow-hidden border border-border cursor-pointer bg-muted"
                >
                  <Image
                    src={project.videoThumbnail}
                    alt={project.title}
                    fill
                    loading="lazy"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 
                    onClick={() => setSelectedProject(project)}
                    className="text-sm md:text-base font-bold text-foreground cursor-pointer line-clamp-1 group-hover:text-primary transition-colors m-0"
                  >
                    {project.title}
                  </h3>
                  <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider block mt-0.5">
                    {project.teamName} · {project.category}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed m-0">
                    {project.shortIdea}
                  </p>
                </div>

                <button
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="shrink-0 p-2.5 rounded-xl border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer"
                  title="View details"
                >
                  <ExternalLink size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {processedProjects.length > visibleCount && (
          <div className="flex justify-center mt-10">
            <button
              onClick={handleLoadMore}
              className="px-6 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs font-bold uppercase tracking-wider hover:bg-muted transition-all shadow-sm"
            >
              Load More Projects
            </button>
          </div>
        )}

        {/* LIGHTBOX PREVIEW MODAL */}
        <AnimatePresence>
          {selectedProject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedProject(null)}
                className="absolute inset-0 bg-black/75"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl z-10 flex flex-col md:flex-row"
              >
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute right-3.5 top-3.5 z-20 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>

                <div className="relative w-full md:w-1/2 aspect-video md:aspect-auto md:h-80 overflow-hidden bg-black/10">
                  <Image
                    src={selectedProject.videoThumbnail}
                    alt={selectedProject.title}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
                      {selectedProject.category}
                    </span>

                    <h2 className="text-lg md:text-xl font-bold text-foreground leading-snug m-0">
                      {selectedProject.title}
                    </h2>

                    <span className="text-xs font-semibold text-secondary uppercase tracking-wider mt-1 block">
                      {selectedProject.teamName}
                    </span>

                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed max-h-28 overflow-y-auto pr-1">
                      {selectedProject.shortIdea}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selectedProject.technologies.map((t: string) => (
                        <span 
                          key={t} 
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedProject(null);
                      router.push(`/project/${selectedProject.id}`);
                    }}
                    className="w-full py-2.5 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-sm hover:opacity-95 transition-all mt-6 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    View Project Case Study
                    <ExternalLink size={13} />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
}
