import { useState, useEffect } from 'react';
import './TimeDisplay.css';

function pad(n: number): string { return String(n).padStart(2, '0'); }
function formatDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default function TimeDisplay({ visible }: { visible: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!visible) return null;
  return (
    <div className="time-display" id="time-display">
      <span className="time-clock">
        {pad(now.getUTCHours())}:{pad(now.getUTCMinutes())}:{pad(now.getUTCSeconds())} UTC
      </span>
      <span className="time-date">{formatDate(now)}</span>
    </div>
  );
}
