import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store';

function Button({ 
  children, 
  variant = 'primary',  // primary, secondary, tertiary, danger, ghost, success
  size = 'md', // sm, md, lg
  isFullWidth = false,
  isLoading = false,
  disabled = false,
  icon = null,
  iconPosition = 'left',
  onClick, 
  type = 'button',
  className = '',
  ...props 
}) {
  const darkMode = useStore(state => state.darkMode);
  
  // Base styles with enhanced transitions
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed interactive-spring";
  
  // Modern variant styles with content-focused colors
  const variantClasses = {
    primary: {
      light: "bg-gradient-crimson hover:shadow-glow-crimson text-white shadow-md focus:ring-crimson-500 focus:ring-offset-surface-light border border-transparent font-semibold",
      dark: "bg-gradient-crimson hover:shadow-glow-crimson text-white shadow-lg focus:ring-crimson-400 focus:ring-offset-surface-dark border border-transparent font-semibold",
    },
    secondary: {
      light: "bg-surface-light-warm hover:bg-content-50 active:bg-content-100 text-content-700 focus:ring-content-500 border border-content-200 shadow-sm hover:shadow-md hover:border-content-300",
      dark: "bg-surface-dark-warm hover:bg-content-900 active:bg-content-800 text-content-300 focus:ring-content-400 border border-content-700 shadow-sm hover:shadow-md hover:border-content-600",
    },
    tertiary: {
      light: "bg-surface-light hover:bg-surface-light-warm active:bg-content-50 text-content-700 focus:ring-content-500 border border-content-300 shadow-sm hover:shadow-md hover:border-content-200",
      dark: "bg-surface-dark hover:bg-surface-dark-warm active:bg-content-900 text-content-300 focus:ring-content-400 border border-content-700 shadow-sm hover:shadow-md hover:border-content-600",
    },
    danger: {
      light: "bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 text-white shadow-md focus:ring-error-500 border border-transparent hover:shadow-glow-crimson",
      dark: "bg-gradient-to-r from-error-600 to-error-700 hover:from-error-700 hover:to-error-800 text-white shadow-lg focus:ring-error-500 border border-transparent hover:shadow-glow-crimson",
    },
    ghost: {
      light: "bg-transparent hover:bg-content-50 active:bg-content-100 text-content-600 hover:text-content-700 focus:ring-content-500 border border-transparent",
      dark: "bg-transparent hover:bg-content-900 active:bg-content-800 text-content-400 hover:text-content-300 focus:ring-content-400 border border-transparent",
    },
    success: {
      light: "bg-gradient-to-r from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 text-white shadow-md focus:ring-success-500 border border-transparent hover:shadow-glow-accent",
      dark: "bg-gradient-to-r from-success-600 to-success-700 hover:from-success-700 hover:to-success-800 text-white shadow-lg focus:ring-success-500 border border-transparent hover:shadow-glow-accent",
    }
  };
  
  // Enhanced size styles
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm gap-1.5 min-h-[32px]",
    md: "px-4 py-2.5 text-sm gap-2 min-h-[40px]",
    lg: "px-6 py-3 text-base gap-2.5 min-h-[48px]"
  };
  
  // Width
  const widthClass = isFullWidth ? "w-full" : "";
  
  // Disabled & Loading state
  const isDisabled = disabled || isLoading;
  
  // Make sure the variant exists, fallback to primary if not
  const validVariant = variantClasses[variant] ? variant : 'primary';
  
  const selectedVariant = darkMode 
    ? variantClasses[validVariant].dark 
    : variantClasses[validVariant].light;
  
  return (
    <motion.button
      type={type}
      className={`
        ${baseClasses}
        ${selectedVariant}
        ${sizeClasses[size] || sizeClasses.md}
        ${widthClass}
        ${className}
      `}
      disabled={isDisabled}
      onClick={onClick}
      whileHover={!isDisabled ? { scale: 1.02, y: -1 } : {}}
      whileTap={!isDisabled ? { scale: 0.98, y: 0 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      {...props}
    >
      {isLoading && (
        <motion.svg 
          className="h-4 w-4 text-current"
          fill="none" 
          viewBox="0 0 24 24"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </motion.svg>
      )}
      
      {!isLoading && icon && iconPosition === 'left' && (
        <span className="shrink-0">{icon}</span>
      )}
      
      <span className={isLoading ? 'opacity-75' : ''}>{children}</span>
      
      {!isLoading && icon && iconPosition === 'right' && (
        <span className="shrink-0">{icon}</span>
      )}
    </motion.button>
  );
}

export default Button; 