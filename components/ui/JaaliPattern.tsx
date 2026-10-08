import React from 'react';

interface JaaliPatternProps {
  className?: string;
  opacity?: number;
  variant?: 'grid' | 'lattice' | 'arch';
}

export const JaaliPattern: React.FC<JaaliPatternProps> = ({
  className = '',
  opacity = 0.04,
  variant = 'lattice',
}) => {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="jaali-lattice"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M20 0 L40 20 L20 40 L0 20 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            <circle cx="20" cy="20" r="3" fill="none" stroke="currentColor" strokeWidth="0.6" />
            <path
              d="M0 0 L10 10 M30 30 L40 40 M40 0 L30 10 M10 30 L0 40"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#jaali-lattice)" />
      </svg>
    </div>
  );
};

export default JaaliPattern;
