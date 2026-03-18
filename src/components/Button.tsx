import React from 'react';
import { cn } from '../lib/utils';

export const Button = ({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success',
  size?: 'sm' | 'md' | 'lg'
}) => {
  const variants = {
    primary: 'bg-zinc-900 text-white hover:bg-black shadow-sm',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-transparent hover:bg-zinc-100 text-zinc-600',
    outline: 'border border-zinc-200 bg-transparent hover:bg-zinc-50 text-zinc-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-8 py-4 text-base font-bold'
  };
  return (
    <button 
      className={cn(
        'inline-flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )} 
      {...props} 
    />
  );
};