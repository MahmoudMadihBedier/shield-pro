import React from 'react';
import { motion } from 'framer-motion';

// Card Animation Component (SRP - Single Responsibility Principle)
interface CardAnimationProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

export const CardAnimation: React.FC<CardAnimationProps> = ({
  children,
  className = '',
  delay = 0,
  hover = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={hover ? { y: -4, boxShadow: '0 12px 24px rgba(0,0,0,0.1)' } : {}}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// List Item Animation Component
interface ListItemAnimationProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
}

export const ListItemAnimation: React.FC<ListItemAnimationProps> = ({
  children,
  className = '',
  index = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// Button Animation Component
interface ButtonAnimationProps {
  children: React.ReactNode;
  className?: string;
  whileTap?: { scale: number };
}

export const ButtonAnimation: React.FC<ButtonAnimationProps> = ({
  children,
  className = '',
  whileTap = { scale: 0.95 },
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={whileTap}
      className={className}
    >
      {children}
    </motion.button>
  );
};

// Modal Animation Component
interface ModalAnimationProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}

export const ModalAnimation: React.FC<ModalAnimationProps> = ({
  children,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

// Tab Content Animation Component
interface TabContentAnimationProps {
  children: React.ReactNode;
  className?: string;
}

export const TabContentAnimation: React.FC<TabContentAnimationProps> = ({
  children,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
};