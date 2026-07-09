import { cn } from "@/lib/utils";

/** Shared props for neon-outline vehicle silhouettes. */
interface SilhouetteProps {
  className?: string;
  accentColor: string;
}

/**
 * Lamborghini Temerario — low mid-engine supercar profile.
 * Accent: orange/copper for LB63x.
 */
export function TemerarioSilhouette({ className, accentColor }: SilhouetteProps) {
  return (
    <svg
      viewBox="0 0 320 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <filter id="temerario-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#temerario-glow)"
      >
        {/* Ground shadow line */}
        <path d="M20 78 Q160 82 300 78" opacity="0.3" />
        {/* Body outline — aggressive nose, low roofline */}
        <path d="M28 72 L42 68 L58 52 L78 44 L110 40 L145 38 L175 40 L200 44 L225 50 L248 58 L268 66 L285 72" />
        {/* Cabin / windshield */}
        <path d="M115 40 L130 28 L165 26 L195 30 L210 40" opacity="0.7" />
        {/* Side intake */}
        <path d="M155 52 L175 48 L180 58 L160 62 Z" opacity="0.5" />
        {/* Rear haunch */}
        <path d="M230 50 L255 46 L265 58 L240 62 Z" opacity="0.5" />
        {/* Wheels */}
        <circle cx="95" cy="72" r="14" />
        <circle cx="95" cy="72" r="7" opacity="0.4" />
        <circle cx="235" cy="72" r="14" />
        <circle cx="235" cy="72" r="7" opacity="0.4" />
        {/* Front splitter hint */}
        <path d="M28 72 L32 76 L40 74" opacity="0.6" />
        {/* Rear diffuser */}
        <path d="M275 70 L290 74 L300 72" opacity="0.6" />
      </g>
    </svg>
  );
}

/**
 * Lamborghini Revuelto — angular wedge hybrid supercar profile.
 * Accent: cyan/blue for LB74x (center position).
 */
export function RevueltoSilhouette({ className, accentColor }: SilhouetteProps) {
  return (
    <svg
      viewBox="0 0 320 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <filter id="revuelto-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#revuelto-glow)"
      >
        <path d="M20 78 Q160 82 300 78" opacity="0.3" />
        {/* Angular wedge body */}
        <path d="M25 74 L48 66 L72 48 L100 38 L140 34 L180 36 L215 42 L245 50 L270 60 L290 70 L300 74" />
        {/* Sharp windshield / cabin */}
        <path d="M105 38 L125 22 L170 20 L205 26 L220 38" opacity="0.7" />
        {/* Y-shaped side graphic (Revuelto signature) */}
        <path d="M160 44 L175 56 L190 44" opacity="0.6" />
        <path d="M175 56 L175 64" opacity="0.4" />
        {/* Hexagonal wheel arches */}
        <path d="M82 58 L108 54 L112 68 L86 72 Z" opacity="0.4" />
        <path d="M218 54 L244 50 L248 64 L222 68 Z" opacity="0.4" />
        {/* Wheels */}
        <circle cx="98" cy="72" r="15" />
        <circle cx="98" cy="72" r="7" opacity="0.4" />
        <circle cx="238" cy="72" r="15" />
        <circle cx="238" cy="72" r="7" opacity="0.4" />
        {/* Active aero wing hint */}
        <path d="M255 48 L275 42 L280 50" opacity="0.5" />
      </g>
    </svg>
  );
}

/**
 * Lamborghini Urus — high-riding SUV profile.
 * Accent: yellow for LB636.
 */
export function UrusSilhouette({ className, accentColor }: SilhouetteProps) {
  return (
    <svg
      viewBox="0 0 320 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
      aria-hidden
    >
      <defs>
        <filter id="urus-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        stroke={accentColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#urus-glow)"
      >
        <path d="M20 78 Q160 82 300 78" opacity="0.3" />
        {/* Tall SUV body */}
        <path d="M30 72 L50 68 L65 50 L85 42 L120 38 L200 38 L235 42 L260 50 L275 62 L290 72" />
        {/* Roofline / D-pillar */}
        <path d="M90 42 L105 24 L155 20 L210 22 L240 38" opacity="0.7" />
        {/* Window line */}
        <path d="M108 38 L115 28 L200 28 L230 38" opacity="0.4" />
        {/* Hexagonal Urus side vents */}
        <path d="M175 48 L195 44 L200 56 L180 60 Z" opacity="0.5" />
        {/* Wheels — larger SUV proportions */}
        <circle cx="105" cy="72" r="16" />
        <circle cx="105" cy="72" r="8" opacity="0.4" />
        <circle cx="245" cy="72" r="16" />
        <circle cx="245" cy="72" r="8" opacity="0.4" />
        {/* Roof rails hint */}
        <path d="M115 24 L205 22" opacity="0.3" strokeDasharray="4 3" />
        {/* Rear spoiler */}
        <path d="M265 50 L280 46 L285 54" opacity="0.5" />
      </g>
    </svg>
  );
}
