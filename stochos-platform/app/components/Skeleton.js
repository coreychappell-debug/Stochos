'use client';

/**
 * Skeleton Loader Component
 * Renders a shimmering placeholder block that represents loading content.
 */
export default function Skeleton({
  width = '100%',
  height = '16px',
  circle = false,
  style = {},
  className = ''
}) {
  const skeletonStyle = {
    width,
    height,
    borderRadius: circle ? '50%' : 'var(--radius-sm)',
    ...style
  };

  return (
    <span
      className={`skeleton-shimmer ${className}`}
      style={skeletonStyle}
      aria-hidden="true"
    />
  );
}
