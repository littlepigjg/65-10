import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  className?: string;
  scrollTop?: number;
  onScroll?: (scrollTop: number) => void;
  getKey?: (item: T, index: number) => string | number;
  style?: React.CSSProperties;
  height?: number | string;
}

const DEFAULT_OVERSCAN = 5;

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = DEFAULT_OVERSCAN,
  className,
  scrollTop: controlledScrollTop,
  onScroll,
  getKey,
  style,
  height = '100%',
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalScrollTop, setInternalScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const scrollTop = controlledScrollTop ?? internalScrollTop;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      controlledScrollTop !== undefined &&
      containerRef.current &&
      containerRef.current.scrollTop !== controlledScrollTop
    ) {
      containerRef.current.scrollTop = controlledScrollTop;
    }
  }, [controlledScrollTop]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setInternalScrollTop(newScrollTop);
      onScroll?.(newScrollTop);
    },
    [onScroll]
  );

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const offsetY = startIndex * itemHeight;

  const visibleItems = [];
  for (let i = startIndex; i < endIndex; i++) {
    const item = items[i];
    if (item !== undefined) {
      const key = getKey ? getKey(item, i) : i;
      visibleItems.push(
        <div
          key={key}
          style={{
            position: 'absolute',
            top: i * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          }}
        >
          {renderItem(item, i)}
        </div>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'auto',
        height,
        ...style,
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>{visibleItems}</div>
      </div>
    </div>
  );
}
