import RulesClient from './RulesClient';

export const metadata = {
  title: 'Compliance & Commentary Rules | Stochos',
  description: 'Monitor financial validations and enforce narrative commentary gates before period closes.',
};

export default function RulesPage() {
  return <RulesClient />;
}
