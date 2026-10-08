"use client";

import Slider from "react-slick";
import { projects } from "@/data/projects";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Video } from "lucide-react";

import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

interface VideoCarouselProps {
  videoUrl?: string;
  title?: string;
}

function PrevArrow(props: any) {
  const { onClick } = props;
  return (
    <button
      onClick={onClick}
      className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-30 w-11 h-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:opacity-95 active:scale-95 group focus:outline-none cursor-pointer"
      aria-label="Previous slide"
    >
      <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
    </button>
  );
}

function NextArrow(props: any) {
  const { onClick } = props;
  return (
    <button
      onClick={onClick}
      className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-30 w-11 h-11 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:opacity-95 active:scale-95 group focus:outline-none cursor-pointer"
      aria-label="Next slide"
    >
      <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

export default function VideoCarousel({ videoUrl, title }: VideoCarouselProps) {
  const router = useRouter();

  const settings = {
    dots: true,
    infinite: true,
    speed: 600,
    slidesToShow: 1,
    centerMode: true,
    centerPadding: "24%",
    autoplay: true,
    autoplaySpeed: 4500,
    pauseOnHover: true,
    prevArrow: <PrevArrow />,
    nextArrow: <NextArrow />,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          centerPadding: "15%",
        },
      },
      {
        breakpoint: 640,
        settings: {
          centerPadding: "8%",
        },
      },
    ],
  };

  return (
    <section className="py-14 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wider uppercase mb-2">
            <Video className="w-3.5 h-3.5 text-secondary" />
            Demonstration Recordings
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight m-0">
            Project Video Walkthroughs
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-0">
            Explore live demonstration recordings and architecture presentations.
          </p>
        </div>

        <div className="video-carousel-container py-2 relative">
          <Slider {...settings}>
            {projects.map((project) => (
              <div key={project.id} className="px-3 focus:outline-none">
                <div
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="cursor-pointer rounded-2xl overflow-hidden transition-all duration-300 group bg-card border border-border shadow-sm hover:shadow-xl"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <Image
                      src={project.videoThumbnail}
                      alt={project.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 800px"
                      priority
                    />

                    {/* Gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 sm:p-6 flex flex-col justify-end">
                      <h3 className="text-white text-base sm:text-lg font-bold line-clamp-1 m-0">
                        {project.title}
                      </h3>
                      <p className="text-white/80 text-xs font-medium uppercase tracking-wider mt-1 mb-0">
                        {project.teamName} · {project.category}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </section>
  );
}
