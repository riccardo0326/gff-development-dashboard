"use client";

import Image from "next/image";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Visual config for each Lamborghini vehicle project card. */
export const PROJECT_CARDS = [
  {
    id: "LB63x",
    model: "Temerario",
    image: "/temerario-removebg-preview.png",
    accent: "#e87d3e",
    accentGlow: "rgba(232, 125, 62, 0.35)",
    labelGlow: "0 0 12px rgba(232, 125, 62, 0.6), 0 0 24px rgba(232, 125, 62, 0.25)",
    /** Stagger delay for entrance animation (ms). */
    delay: 0,
    /** Slide direction: left card enters from the left. */
    from: "left" as const,
  },
  {
    id: "LB74x",
    model: "Revuelto",
    image: "/revuelto-removebg-preview.png",
    accent: "#22d3ee",
    accentGlow: "rgba(34, 211, 238, 0.35)",
    labelGlow: "0 0 12px rgba(34, 211, 238, 0.6), 0 0 24px rgba(34, 211, 238, 0.25)",
    delay: 180,
    from: "center" as const,
  },
  {
    id: "LB636",
    model: "Urus",
    image: "/urus-removebg-preview.png",
    accent: "#fbbf24",
    accentGlow: "rgba(251, 191, 36, 0.35)",
    labelGlow: "0 0 12px rgba(251, 191, 36, 0.6), 0 0 24px rgba(251, 191, 36, 0.25)",
    delay: 360,
    from: "right" as const,
  },
] as const;

function ProjectCard({
  id,
  model,
  image,
  accent,
  accentGlow,
  labelGlow,
  delay,
  from,
  onSelect,
}: (typeof PROJECT_CARDS)[number] & { onSelect?: () => void }) {
  const slideClass =
    from === "left"
      ? "vehicle-banner-enter-left"
      : from === "right"
        ? "vehicle-banner-enter-right"
        : "vehicle-banner-enter-center";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex flex-1 flex-col items-center overflow-hidden rounded-lg text-left",
        "border border-white/5 bg-white/[0.02]",
        "cursor-pointer transition-colors duration-300 hover:border-white/10 hover:bg-white/[0.04]",
        "focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none",
        slideClass,
      )}
      style={{
        animationDelay: `${delay}ms`,
        // Accent ambient glow behind the silhouette
        boxShadow: `inset 0 -40px 60px -20px ${accentGlow}`,
      }}
    >
      {/* Subtle top accent line */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
      />

      {/* Vehicle image area */}
      <div className="relative flex h-24 w-full items-center justify-center px-4 pt-4 sm:h-28 md:h-32">
        <div
          className="vehicle-banner-silhouette relative h-full w-full max-w-[280px] opacity-90 transition-opacity duration-300 group-hover:opacity-100"
          style={{ animationDelay: `${delay + 80}ms` }}
        >
          <Image
            src={image}
            alt={`Lamborghini ${model}`}
            fill
            className="object-contain object-center"
            sizes="(max-width: 640px) 100vw, 280px"
            priority
          />
        </div>
      </div>

      {/* Project label */}
      <div className="flex flex-col items-center gap-0.5 pb-4 pt-1">
        <span
          className="text-sm font-semibold tracking-[0.2em] sm:text-base"
          style={{ color: accent, textShadow: labelGlow }}
        >
          {id}
        </span>
        <span className="text-muted text-[10px] uppercase tracking-widest sm:text-xs">
          {model}
        </span>
      </div>
    </button>
  );
}

/**
 * Full-width horizontal banner showcasing the three Lamborghini
 * vehicle projects with PNG imagery and staggered
 * entrance animations.
 */
export function VehicleProjectBanner({
  className,
  onSelectProject,
}: {
  className?: string;
  onSelectProject?: (projectId: (typeof PROJECT_CARDS)[number]["id"]) => void;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-3 sm:p-4",
        className,
      )}
    >
      {/* Ambient background gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(59,130,246,0.08), transparent)",
        }}
      />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:gap-4">
        {PROJECT_CARDS.map((project) => (
          <ProjectCard
            key={project.id}
            {...project}
            onSelect={() => onSelectProject?.(project.id)}
          />
        ))}
      </div>
    </Card>
  );
}
