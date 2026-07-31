import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Info } from 'lucide-react';

// Tooltip Props (SRP - Single Responsibility Principle)
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

// Tooltip Component
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2 right-0';
      case 'bottom':
        return 'top-full mt-2 right-0';
      case 'left':
        return 'right-full mr-2 top-1/2 -translate-y-1/2';
      case 'right':
        return 'left-full ml-2 top-1/2 -translate-y-1/2';
      default:
        return 'bottom-full mb-2 right-0';
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg ${getPositionStyles()}`}
            dir="rtl"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Help Icon Component with Tooltip
interface HelpTooltipProps {
  content: string;
  size?: number;
  className?: string;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  size = 16,
  className = '',
}) => {
  return (
    <Tooltip content={content}>
      <HelpCircle className={`h-${size} w-${size} text-gray-400 hover:text-blue-500 cursor-help transition-colors ${className}`} />
    </Tooltip>
  );
};

// Info Icon Component with Tooltip
interface InfoTooltipProps {
  content: string;
  size?: number;
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  size = 16,
  className = '',
}) => {
  return (
    <Tooltip content={content}>
      <Info className={`h-${size} w-${size} text-blue-400 hover:text-blue-600 cursor-help transition-colors ${className}`} />
    </Tooltip>
  );
};

// Field Help Text Component
interface FieldHelpProps {
  text: string;
  type?: 'info' | 'warning' | 'success';
}

export const FieldHelp: React.FC<FieldHelpProps> = ({ text, type = 'info' }) => {
  const getStyles = () => {
    switch (type) {
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className={`text-xs p-2 rounded border mt-1 ${getStyles()}`}
    >
      {text}
    </motion.div>
  );
};