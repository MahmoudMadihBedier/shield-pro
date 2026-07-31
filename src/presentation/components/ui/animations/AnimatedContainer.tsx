import React from 'react';
import { motion, MotionProps } from 'framer-motion';

// Animation Variants (SRP - Single Responsibility Principle)
export const AnimationVariants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slideIn: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  },
  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  slideDown: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
  scaleOut: {
    hidden: { opacity: 1, scale: 1 },
    visible: { opacity: 0, scale: 0.9 },
  },
};

// Animation Transitions
export const AnimationTransitions = {
  default: { duration: 0.3, ease: 'easeOut' },
  fast: { duration: 0.15, ease: 'easeOut' },
  slow: { duration: 0.5, ease: 'easeOut' },
  bouncy: { type: 'spring', stiffness: 300, damping: 20 },
};

// Animated Container Props
interface AnimatedContainerProps extends MotionProps {
  children: React.ReactNode;
  variant?: keyof typeof AnimationVariants;
  transition?: any;
  className?: string;
  delay?: number;
}

// Animated Container Component (SRP - Single Responsibility Principle)
export const AnimatedContainer: React.FC<AnimatedContainerProps> = ({
  children,
  variant = 'fadeIn',
  transition = AnimationTransitions.default,
  className = '',
  delay = 0,
  ...motionProps
}) => {
  const selectedVariant = AnimationVariants[variant];
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={selectedVariant}
      transition={{ ...transition, delay }}
      className={className}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
};

// Stagger Animation Container
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className = '',
  staggerDelay = 0.1,
}) => {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Stagger Item Component
export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
  variants?: any;
}> = ({ children, className = '', variants = AnimationVariants.slideUp }) => {
  return (
    <motion.div variants={variants} className={className}>
      {children}
    </motion.div>
  );
};