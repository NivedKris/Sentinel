import React from 'react';
import './LogoLoop.css';

export interface LogoItem {
  src: string;
  alt: string;
  href?: string;
  title?: string;
}

export interface LogoLoopProps {
  logos: LogoItem[];
  speed?: number; // px/sec
  direction?: 'left' | 'right';
  logoHeight?: number;
  gap?: number;
  pauseOnHover?: boolean;
  scaleOnHover?: boolean;
  fadeOut?: boolean;
  fadeOutColor?: string;
  ariaLabel?: string;
}

export default function LogoLoop({
  logos,
  speed = 80,
  direction = 'left',
  logoHeight = 40,
  gap = 48,
  pauseOnHover = false,
  scaleOnHover = false,
  fadeOut = false,
  fadeOutColor = '#0a0a0a',
  ariaLabel = 'Technology partners'
}: LogoLoopProps) {
  // Duplicate logos once to create a seamless infinite loop
  const duplicatedLogos = [...logos, ...logos];

  // Calculate loop duration based on speed
  const duration = `${(logos.length * 150) / speed}s`;

  const containerStyle: React.CSSProperties = {
    ['--logo-height' as any]: `${logoHeight}px`,
    ['--gap' as any]: `${gap}px`,
    ['--duration' as any]: duration,
    ['--fade-color' as any]: fadeOutColor,
  };

  const wrapperClass = [
    'logo-loop-container',
    direction === 'right' && 'direction-right',
    pauseOnHover && 'pause-on-hover',
    fadeOut && 'fade-out-edges',
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={wrapperClass} 
      style={containerStyle}
      aria-label={ariaLabel}
      role="region"
    >
      <div className="logo-loop-track">
        {duplicatedLogos.map((logo, index) => {
          const content = (
            <img 
              src={logo.src} 
              alt={logo.alt} 
              className={`logo-loop-img ${scaleOnHover ? 'scale-on-hover' : ''}`}
              style={{ height: logoHeight }}
            />
          );

          if (logo.href) {
            return (
              <a 
                key={index} 
                href={logo.href} 
                target="_blank" 
                rel="noopener noreferrer" 
                title={logo.title || logo.alt}
                className="logo-loop-item-link"
              >
                {content}
              </a>
            );
          }

          return (
            <div key={index} className="logo-loop-item" title={logo.title || logo.alt}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
