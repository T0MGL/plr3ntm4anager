import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export const Chevron = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path d="m9 6 6 6-6 6" strokeWidth="2" />
  </svg>
);

export const Heart = (props: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path
      d="M20.8 8.6a5 5 0 0 0-8.1-3.7L12 5.5l-.7-.6a5 5 0 0 0-8.1 3.7c0 5.4 8.8 10 8.8 10s8.8-4.6 8.8-10z"
      strokeWidth="1.8"
    />
  </svg>
);

export const RightArrow = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    aria-hidden="true"
    focusable="false"
    {...props}
    style={{
      display: "block",
      fill: "none",
      height: "12px",
      width: "12px",
      stroke: "currentcolor",
      strokeWidth: "4",
      overflow: "visible",
      ...props.style,
    }}
  >
    <path fill="none" d="m12 4 11.3 11.3a1 1 0 0 1 0 1.4L12 28"></path>
  </svg>
);

export const LeftArrow = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    aria-hidden="true"
    focusable="false"
    {...props}
    style={{
      display: "block",
      fill: "none",
      height: "12px",
      width: "12px",
      stroke: "currentcolor",
      strokeWidth: "4",
      overflow: "visible",
      ...props.style,
    }}
  >
    <path fill="none" d="M20 28 8.7 16.7a1 1 0 0 1 0-1.4L20 4"></path>
  </svg>
);