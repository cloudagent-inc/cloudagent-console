import React from 'react';

export const Stepper = ({ steps, activeStep }) => (
  <div className="flex items-center mb-8">
    {steps.map((label, idx) => {
      const isActive = idx === activeStep;
      const isCompleted = idx < activeStep;
      return (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <div
              className={`
                flex items-center justify-center rounded-full w-9 h-9 font-bold 
                ${
                  isActive
                    ? 'bg-primary-200 text-black shadow-lg border-2 border-primary-600'
                    : isCompleted
                      ? 'bg-primary-400  border-2 border-primary-400 text-white'
                      : 'bg-primary-200 text-gray-500 border-primary-600'
                }
                transition-all
              `}
            >
              {idx + 1}
            </div>
            <div
              className={`
                text-xs mt-2 text-center w-24
                ${isActive ? 'font-semibold text-primary-700' : 'text-gray-500'}
              `}
            >
              {label}
            </div>
          </div>
          {idx < steps.length - 1 && (
            <div
              className={`
                flex-1 h-0.5 
                ${isCompleted ? 'bg-primary-600' : 'bg-gray-200'}
              `}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);
