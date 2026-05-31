import RegistryClient from './RegistryClient';

export const metadata = {
  title: 'Metric Registry & Calculations Manager | Stochos',
  description: 'Manage institutional metrics, calculations formulas, cyclic dependencies, and dual-user approval gates.',
};

export default function RegistryPage() {
  return <RegistryClient />;
}
