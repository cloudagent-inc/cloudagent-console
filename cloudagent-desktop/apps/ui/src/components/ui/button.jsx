import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowLeft } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-[8px] font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-cta-gradient text-white hover:bg-cta-gradient/90',
        outline:
          'border border-gray-200 text-primary-800 hover:bg-primary-50 hover:border-primary-250 hover:text-primary-500',
        ghost: 'text-primary-600 hover:bg-primary-100',
        link: 'relative text-primary-400 before:absolute before:bottom-0 before:left-0 before:h-[2px] before:w-full before:origin-left before:scale-x-0 before:bg-primary-400 before:transition-transform before:duration-300 hover:before:scale-x-100',
      },
      size: {
        default:
          'h-[44px] py-[12px] px-[32px] text-[16px] line-height-[19.36px]',
        sm: 'h-[32px] py-[8px] px-[16px] text-[14px] ',
        md: 'h-[40px] py-[10px] px-[24px] text-[15px] leading-[18px]',
        lg: 'h-[56px] py-[16px] px-[48px] text-[20px] ',
      },
    },
    compoundVariants: [
      {
        variant: 'link',
        size: 'default',
        className: 'p-0 h-auto',
      },
      {
        variant: 'link',
        size: 'sm',
        className: 'p-0 h-auto',
      },
      {
        variant: 'link',
        size: 'lg',
        className: 'p-0 h-auto',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {leftIcon && <ArrowLeft className="mr-2 h-4 w-4" />}
        {children}
        {rightIcon && <ArrowRight className="ml-2 h-4 w-4" />}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
