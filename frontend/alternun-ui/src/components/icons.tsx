import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export const IconGold = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 18h8l-1.5-5h-5zM13 18h8l-1.5-5h-5zM8 11h8l-1.5-5h-5z" /></svg>
);
export const IconMine = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 20l6-10 4 6 3-4 5 8z" /><path d="M14 6l2-2 2 2-2 2z" /></svg>
);
export const IconCoins = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3" /></svg>
);
export const IconLeaf = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" /><path d="M5 19c3-4 6-6 9-7" /></svg>
);
export const IconSun = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconDrop = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" /></svg>
);
export const IconShield = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const IconWallet = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M16 12.5h2M3 9h15a3 3 0 0 0-3-3" /></svg>
);
export const IconArrow = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconExternal = ({ size = 14, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconCopy = ({ size = 14, ...p }: P) => (
  <svg {...base(size)} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>
);
export const IconCheck = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M5 12l5 5 9-10" /></svg>
);
export const IconAlert = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></svg>
);
export const IconRefresh = ({ size = 16, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
);
export const IconClose = ({ size = 16, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconLayers = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>
);
export const IconKey = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></svg>
);

export const CategoryIcon = ({ category, size }: { category: string; size?: number }) =>
  category === "Solar" ? <IconSun size={size} /> : category === "Water" ? <IconDrop size={size} /> : <IconLeaf size={size} />;
