import React from 'react';

/**
 * GoogleMapsLocationIcon
 * Authentic Google Maps GPS crosshairs icon with outer ticks, central ring, and center dot.
 * Supports loading animation (smooth spin/pulse) when acquiring GPS coordinates.
 */
export default function GoogleMapsLocationIcon({
  loading = false,
  size = 20,
  color = '#1A73E8',
  className = '',
  style = {},
  ...props
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`gmaps-location-icon ${loading ? 'is-loading' : ''} ${className}`.trim()}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      {...props}
    >
      {/* Outer central ring */}
      <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="2" fill="none" />
      
      {/* Central solid location dot */}
      <circle cx="12" cy="12" r="3" fill={color} />
      
      {/* Outer crosshair tick marks at 12, 3, 6, 9 o'clock */}
      <line x1="12" y1="2" x2="12" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="12" x2="5" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="12" x2="22" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
