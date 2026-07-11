import React, { useRef } from 'react';
import type { ReactNode, MouseEventHandler } from 'react';
import { motion, useInView } from 'motion/react';

interface AnimatedItemProps {
  children: ReactNode;
  delay?: number;
  index: number;
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps any children with a stagger-fade-in animation when scrolled into view.
 * Extracted from the ReactBits AnimatedList component.
 */
const AnimatedItem: React.FC<AnimatedItemProps> = ({
  children,
  delay = 0,
  index,
  onMouseEnter,
  onClick,
  className,
  style,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.85, opacity: 0, y: 10 }}
      animate={inView ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.85, opacity: 0, y: 10 }}
      transition={{ duration: 0.25, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedItem;
