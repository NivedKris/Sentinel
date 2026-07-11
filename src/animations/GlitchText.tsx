import type { FC, CSSProperties } from 'react';
import './GlitchText.css';

interface GlitchTextProps {
  children: string;
  speed?: number;
  enableShadows?: boolean;
  enableOnHover?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface CustomCSSProperties extends CSSProperties {
  '--after-duration': string;
  '--before-duration': string;
  '--after-shadow': string;
  '--before-shadow': string;
}

const GlitchText: FC<GlitchTextProps> = ({
  children,
  speed = 0.5,
  enableShadows = true,
  enableOnHover = false,
  className = '',
  style,
}) => {
  const inlineStyles: CustomCSSProperties = {
    '--after-duration': `${speed * 3}s`,
    '--before-duration': `${speed * 2}s`,
    '--after-shadow': enableShadows ? '-5px 0 rgba(255,0,85,0.7)' : 'none',
    '--before-shadow': enableShadows ? '5px 0 rgba(0,210,255,0.65)' : 'none',
  };

  return (
    <div
      style={{ ...inlineStyles, ...style }}
      data-text={children}
      className={`glitch-text${enableOnHover ? ' glitch-text--hover-only' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export default GlitchText;
