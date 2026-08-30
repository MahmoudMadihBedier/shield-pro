// UI Components Index Barrel (OCP - Open/Closed Principle for easy extension)

// Toast System
export { ToastProvider, useToast } from './Toast';
export type { Toast, ToastType } from './Toast';

// Validation Components
export { ValidationMessage, FormField } from './ValidationMessage';

// ERPNext-style shared primitives
export { StatusBadge } from './StatusBadge';
export { EmptyState } from './EmptyState';
export { Modal } from './Modal';
export { ConfirmProvider, useConfirm } from './ConfirmDialog';
export { Tabs } from './Tabs';
export type { TabDef } from './Tabs';
export { PageHeader } from './PageHeader';
export { StatCard } from './StatCard';
export { DocList } from './DocList';
export type { DocColumn } from './DocList';
export { DocForm } from './DocForm';
export { NumberInput, MoneyInput, QtyInput } from './NumberInput';
export { EntitySelect } from './EntitySelect';
export type { EntityOption } from './EntitySelect';

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