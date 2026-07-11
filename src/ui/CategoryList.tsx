import { useEffect, useRef, useState } from 'react';
import './CategoryList.css';
import type { AppCategory } from '../data/types';
import AnimatedItem from '../animations/AnimatedItem';
import SpotlightCard from '../animations/SpotlightCard';

const CATEGORIES: AppCategory[] = [
  { id: 'wildfires',    label: 'Wildfires' },
  { id: 'severeStorms', label: 'Severe Storms' },
  { id: 'volcanoes',    label: 'Volcanoes' },
  { id: 'seaLakeIce',   label: 'Sea & Lake Ice' },
  { id: 'floods',       label: 'Floods' },
  { id: 'drought',      label: 'Drought' },
  { id: 'landslides',   label: 'Landslides' },
  { id: 'tempExtremes', label: 'Temp Extremes' },
];

// Duplicate category items to create an infinite horizontal carousel on mobile
const TRIPLE_CATEGORIES = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];

interface CategoryListProps {
  visible: boolean;
  selectedId: string | null;
  onSelect: (category: AppCategory) => void;
}

export default function CategoryList({ visible, selectedId, onSelect }: CategoryListProps) {
  const scrollRef = useRef<HTMLUListElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Monitor resize to switch between infinite mobile slider and standard desktop list
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize scroll position to the center copy on mobile mount / display
  useEffect(() => {
    if (!visible || !isMobile) return;
    const el = scrollRef.current;
    if (!el) return;

    // Run measurement after elements render
    const timer = setTimeout(() => {
      const singleWidth = el.scrollWidth / 3;
      el.scrollLeft = singleWidth;
    }, 50);

    return () => clearTimeout(timer);
  }, [visible, isMobile]);

  // Seamless horizontal warping logic for infinite looping on mobile
  const handleScroll = () => {
    if (!isMobile) return;
    const el = scrollRef.current;
    if (!el) return;

    const singleWidth = el.scrollWidth / 3;

    if (el.scrollLeft >= singleWidth * 2) {
      el.scrollLeft = el.scrollLeft - singleWidth;
    } else if (el.scrollLeft <= 2) {
      el.scrollLeft = el.scrollLeft + singleWidth;
    }
  };

  if (!visible) return null;

  const itemsToRender = isMobile ? TRIPLE_CATEGORIES : CATEGORIES;

  return (
    <nav className="cat-list" id="category-list" aria-label="Event categories">
      <p className="cat-label">Select a category {isMobile ? '(swipe for more)' : ''}</p>
      <ul ref={scrollRef} onScroll={handleScroll}>
        {itemsToRender.map((cat, i) => {
          const key = `${cat.id}-${i}`;
          return (
            <li key={key}>
              <AnimatedItem index={i % CATEGORIES.length} delay={(i % CATEGORIES.length) * 0.04}>
                <SpotlightCard spotlightColor="rgba(255, 255, 255, 0.08)">
                  <button
                    id={`cat-${cat.id}-${i}`}
                    className={`cat-item${selectedId === cat.id ? ' cat-item--active' : ''}`}
                    onClick={() => onSelect(cat)}
                    aria-pressed={selectedId === cat.id}
                  >
                    {cat.label}
                  </button>
                </SpotlightCard>
              </AnimatedItem>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { CATEGORIES };
