// UI Components Index Barrel (OCP - Open/Closed Principle for easy extension)

// Toast System
export { ToastProvider, useToast } from './Toast';
export type { Toast, ToastType } from './Toast';

// Validation Components
export { ValidationMessage, FormField } from './ValidationMessage';

// Animation Components
export {
  AnimatedContainer,
  StaggerContainer,
  StaggerItem,
  AnimationVariants,
  AnimationTransitions,
} from './animations/AnimatedContainer';

export {
  CardAnimation,
  ListItemAnimation,
  ButtonAnimation,
  ModalAnimation,
  TabContentAnimation,
} from './animations/CardAnimation';

// Tooltip Components
export { Tooltip, HelpTooltip, InfoTooltip, FieldHelp } from './Tooltip';