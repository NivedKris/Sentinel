import './ScrollHint.css';

interface ScrollHintProps {
  visible: boolean;
  onClick: () => void;
}

export default function ScrollHint({ visible, onClick }: ScrollHintProps) {
  if (!visible) return null;

  return (
    <button
      className="scroll-hint"
      id="scroll-hint"
      onClick={onClick}
      aria-label="Enter the experience"
    >
      <div className="scroll-hint-line" />
    </button>
  );
}
