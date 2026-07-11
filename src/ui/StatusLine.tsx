import './StatusLine.css';
import type { AppCategory } from '../data/types';

interface StatusLineProps {
  category: AppCategory | null;
  eventCount: number;
  visible: boolean;
}

export default function StatusLine({ category, eventCount, visible }: StatusLineProps) {
  if (!visible || !category) return null;

  return (
    <div className="status-line" id="status-line">
      <span className="status-category">{category.label}</span>
      <span className="status-divider"> — </span>
      <span className="status-count">{eventCount} ACTIVE</span>
    </div>
  );
}
