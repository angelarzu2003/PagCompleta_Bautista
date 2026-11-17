import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: number;
  title: string;
  shortTitle?: string;
  description?: string;
}

interface StepperProps {
  steps: StepItem[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      {/* Stepper Horizontal en Desktop */}
      <div className="hidden lg:flex items-center justify-between relative">
        <div className="absolute top-5 left-6 right-6 h-0.5 bg-slate-200 -z-0" />
        {steps.map(step => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <button
              type="button"
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              disabled={!onStepClick}
              className={`relative z-10 flex flex-col items-center group focus:outline-none ${
                onStepClick ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-200 ${
                  isCompleted
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-secondary text-white ring-4 ring-secondary/20 shadow-sm'
                    : 'bg-white border-2 border-slate-300 text-slate-500 group-hover:border-slate-400'
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5 stroke-[2.5]" /> : step.id}
              </div>
              <div className="mt-2 text-center">
                <span
                  className={`block text-xs font-semibold ${
                    isCurrent ? 'text-secondary' : isCompleted ? 'text-primary' : 'text-slate-500'
                  }`}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="block text-[11px] text-slate-400">{step.description}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Stepper Compacto para Mobile / Tablet */}
      <div className="lg:hidden flex items-center justify-between bg-white px-4 py-3 rounded-card border border-slate-200 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-secondary text-white text-xs font-bold flex items-center justify-center">
            {currentStep}
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-primary">
              Paso {currentStep} de {steps.length}: {steps[currentStep - 1]?.title}
            </span>
            <span className="text-[11px] text-slate-500">
              {steps[currentStep - 1]?.description}
            </span>
          </div>
        </div>
        <div className="flex gap-1">
          {steps.map(step => (
            <span
              key={step.id}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                step.id === currentStep
                  ? 'w-6 bg-secondary'
                  : step.id < currentStep
                  ? 'w-3 bg-emerald-600'
                  : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
