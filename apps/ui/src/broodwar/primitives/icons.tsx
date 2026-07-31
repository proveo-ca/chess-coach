import type { Component } from "solid-js";

interface IconProps {
  size?: number;
}

/** Mineral blocks. */
export const MineralsIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 18;
  return (
    <svg width={s()} height={s()} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="10" y="8" width="6" height="6" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="6" y="3" width="6" height="6" rx="1" fill="currentColor" />
    </svg>
  );
};

/** Vespene canister glyph. */
export const VespeneIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 18;
  return (
    <svg width={s()} height={s()} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="5"
        y="3"
        width="8"
        height="12"
        rx="2"
        stroke="currentColor"
        stroke-width="1.4"
        fill="currentColor"
        fill-opacity="0.25"
      />
      <rect x="7" y="1.5" width="4" height="2" rx="0.6" fill="currentColor" />
      <path
        d="M7.5 8.5c1.2-1.5 3.8-1.5 5 0"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        fill="none"
        opacity="0.85"
      />
    </svg>
  );
};

/** Blocks + people (supply / deploy). */
export const SupplyIcon: Component<IconProps> = (props) => {
  const s = () => props.size ?? 18;
  return (
    <svg width={s()} height={s()} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1.5" y="10" width="5" height="5" rx="0.8" fill="currentColor" opacity="0.7" />
      <rect x="5" y="6" width="5" height="5" rx="0.8" fill="currentColor" opacity="0.85" />
      <circle cx="13" cy="6.5" r="2.2" fill="currentColor" />
      <path
        d="M9.5 15.5c0-2 1.6-3.5 3.5-3.5s3.5 1.5 3.5 3.5"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  );
};
