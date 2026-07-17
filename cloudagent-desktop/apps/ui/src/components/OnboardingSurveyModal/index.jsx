import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Stepper } from '../Stepper';
import {
  ROLE_OPTIONS,
  TOPIC_OPTIONS,
  PLATFORM_OPTIONS,
  saveIntent,
} from '../../helpers/onboardingIntentConfig';
import { analytics, ANALYTICS_EVENTS, getAnalyticsRoute } from '../../hooks/useAnalytics';
import {
  BarChart3,
  Code2,
  Briefcase,
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Check,
} from 'lucide-react';
import { Icons } from '../icons';

const ROLE_ICONS = {
  engineer: Code2,
  executive: BarChart3,
  sales: Briefcase,
  student: GraduationCap,
};

const PLATFORM_ICONS = {
  aws: Icons.aws,
  aws_org: Icons.aws,
  google_workspace: Icons.googleWorkspace,
  gcp: Icons.gcp,
  azure: Icons.azure,
  entra_id: Icons.entraId,
  github: Icons.gitHub,
  gitlab: Icons.gitlab,
};

const STEPS = ['About You', 'Connect'];
const CALENDAR_URL = 'https://calendar.app.google/VV2VtxYyjm1P3Vq96';

const RoleChip = ({ option, isSelected, onClick, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-200
      ${
        isSelected
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }
    `}
  >
    <Icon className={`h-4 w-4 ${isSelected ? 'text-primary-600' : 'text-gray-500'}`} />
    <span>{option.label}</span>
    {isSelected && <Check className="h-4 w-4" />}
  </button>
);

const TopicChip = ({ option, isSelected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-200
      ${
        isSelected
          ? 'border-primary-500 bg-primary-500 text-white'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
      }
    `}
  >
    {isSelected && <Check className="h-4 w-4" />}
    <span>{option.label}</span>
  </button>
);

const PlatformChip = ({ option, isSelected, onClick }) => {
  const IconComponent = PLATFORM_ICONS[option.value];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all duration-200
        ${
          isSelected
            ? 'border-primary-500 bg-primary-50 text-primary-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      {IconComponent && <IconComponent className="h-4 w-4" />}
      <span>{option.label}</span>
      {isSelected && <Check className="h-4 w-4" />}
    </button>
  );
};

const OnboardingSurveyModal = ({ isOpen, onComplete }) => {
  const [step, setStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [isConsultant, setIsConsultant] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [hasBookedDemo, setHasBookedDemo] = useState(false);

  const canContinue =
    Boolean(selectedRole) &&
    selectedPlatforms.length > 0 &&
    selectedTopics.length > 0;

  const hasUnavailablePlatforms = selectedPlatforms.some((platformValue) => {
    const platform = PLATFORM_OPTIONS.find((p) => p.value === platformValue);
    return platform && !platform.available;
  });

  const handleNext = () => {
    if (step === 0 && canContinue) {
      setStep(1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleTopic = (value) => {
    setSelectedTopics((current) => (
      current.includes(value)
        ? current.filter((topic) => topic !== value)
        : [...current, value]
    ));
  };

  const togglePlatform = (value) => {
    setSelectedPlatforms((current) => (
      current.includes(value)
        ? current.filter((platform) => platform !== value)
        : [...current, value]
    ));
  };

  const handleComplete = () => {
    const trimmedFeedback = feedback.trim();

    saveIntent({
      role: selectedRole,
      interests: selectedTopics,
      platforms: selectedPlatforms,
      isConsultant,
      feedback: trimmedFeedback,
      bookedDemo: hasBookedDemo,
    });
    analytics.track(ANALYTICS_EVENTS.ONBOARDING_SURVEY_COMPLETED, {
      onboarding_role: selectedRole,
      onboarding_interests: selectedTopics,
      onboarding_platforms: selectedPlatforms,
      onboarding_is_consultant: isConsultant,
      onboarding_feedback_present: Boolean(trimmedFeedback),
      ...(trimmedFeedback && { onboarding_feedback: trimmedFeedback }),
      onboarding_booked_demo: hasBookedDemo,
      route: getAnalyticsRoute(),
    });

    onComplete?.({
      role: selectedRole,
      interests: selectedTopics,
      platforms: selectedPlatforms,
      isConsultant,
      feedback: trimmedFeedback,
      bookedDemo: hasBookedDemo,
    });
  };

  const handleBookDemo = () => {
    setHasBookedDemo(true);
    window.open(CALENDAR_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-[640px] p-0 gap-0 bg-white [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="p-6 pb-0">
          <div>
            <DialogTitle className="text-xl font-bold text-gray-900">
              {step === 1 ? 'Book a Personalized Demo' : 'Tell us a bit about you'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1">
              {step === 1
                ? 'Schedule time with us and share any questions or feedback'
                : 'This helps us tailor your CloudAgent experience'}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="px-6 pt-4">
          <Stepper steps={STEPS} activeStep={step} />
        </div>

        <div className="px-6 pb-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-sm font-semibold text-gray-800">
                  1. What best describes your role?
                </p>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((option) => (
                    <RoleChip
                      key={option.value}
                      option={option}
                      isSelected={selectedRole === option.value}
                      onClick={() => setSelectedRole(option.value)}
                      icon={ROLE_ICONS[option.value] || Code2}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-gray-800">
                  2. What platforms do you use or plan to use?
                </p>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((option) => (
                    <PlatformChip
                      key={option.value}
                      option={option}
                      isSelected={selectedPlatforms.includes(option.value)}
                      onClick={() => togglePlatform(option.value)}
                    />
                  ))}
                </div>
                {hasUnavailablePlatforms && (
                  <p className="mt-3 text-xs text-amber-600">
                    Some platforms you selected are not available yet. We'll notify you when they're ready.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-gray-800">
                  3. What main topic(s) are you most interested in?
                </p>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_OPTIONS.map((option) => (
                    <TopicChip
                      key={option.value}
                      option={option}
                      isSelected={selectedTopics.includes(option.value)}
                      onClick={() => toggleTopic(option.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="onboarding-feedback"
                  className="mb-2 block text-sm font-semibold text-gray-800"
                >
                  Tell us what brought you to CloudAgent
                </label>
                <textarea
                  id="onboarding-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                  placeholder="Share any pain points or goals you'd like to achieve..."
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                <div className="pr-4">
                  <p className="font-medium text-gray-900">
                    I am an MSP or consultant
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    We will use this to better tailor demos and follow-up.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isConsultant}
                  onClick={() => setIsConsultant((current) => !current)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    isConsultant ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      isConsultant ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-2xl border border-primary-200 bg-primary-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-white p-2 shadow-sm">
                    <Calendar className="h-5 w-5 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      Book a personalized demo
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Meet with the CloudAgent team and get a walkthrough tailored to your interests.
                    </p>
                    <Button type="button" onClick={handleBookDemo} className="mt-4">
                      <Calendar className="mr-2 h-4 w-4" />
                      Open Calendar
                    </Button>
                    {hasBookedDemo && (
                      <p className="mt-2 text-xs text-primary-700">
                        Calendar opened in a new tab.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            {step === 1 ? (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step === 0 ? (
              <Button onClick={handleNext} disabled={!canContinue}>
                Continue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleComplete}>
                Finish
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingSurveyModal;
