import { useEffect, useRef } from 'react';
import './Cursor.css';

export default function Cursor() {
  const cursorRef  = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isOnInteractive = useRef(false);
  const isOnScrollable = useRef(false);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    let rafId = 0;
    let mx = -100, my = -100;

    const label = cursor.querySelector('.cursor-label') as HTMLDivElement | null;

    const updateLabel = () => {
      if (!label) return;
      if (isDragging.current) {
        label.textContent = 'DRAG';
        label.style.opacity = '1';
      } else if (isOnInteractive.current) {
        label.textContent = 'SELECT';
        label.style.opacity = '1';
      } else if (isOnScrollable.current) {
        label.textContent = 'SCROLL';
        label.style.opacity = '1';
      } else {
        label.textContent = '';
        label.style.opacity = '0';
      }
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        cursor.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      });
    };

    const onDown = () => {
      isDragging.current = true;
      cursor.classList.add('cursor--drag');
      updateLabel();
    };

    const onUp = () => {
      isDragging.current = false;
      cursor.classList.remove('cursor--drag');
      updateLabel();
    };

    // Detect hovering over clickable or scrollable elements
    const onOver = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;

      const interactive = el.closest('button, a, [role="button"], select, option, [data-cursor="pointer"]');
      const scrollable = el.closest('.ev-scroll-container, .category-list, .ev-list ul');

      if (interactive) {
        cursor.classList.add('cursor--pointer');
        cursor.classList.remove('cursor--scroll');
        isOnInteractive.current = true;
        isOnScrollable.current = false;
      } else if (scrollable) {
        cursor.classList.add('cursor--scroll');
        cursor.classList.remove('cursor--pointer');
        isOnInteractive.current = false;
        isOnScrollable.current = true;
      } else {
        cursor.classList.remove('cursor--pointer');
        cursor.classList.remove('cursor--scroll');
        isOnInteractive.current = false;
        isOnScrollable.current = false;
      }
      updateLabel();
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousemove', onOver, { passive: true });
    window.addEventListener('mousedown', onDown, { passive: true });
    window.addEventListener('mouseup', onUp, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousemove', onOver);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="cursor" ref={cursorRef} aria-hidden="true">
      {/* Crosshair lines */}
      <div className="cursor-h" />
      <div className="cursor-v" />
      {/* Outer ring */}
      <div className="cursor-ring" />
      {/* Text label details */}
      <div className="cursor-label" />
    </div>
  );
}
