import { cn } from "@/lib/utils";
import React from "react";

export const Home: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M14 2h-4v2H8v2H6v2H4v2H2v2h2v10h7v-6h2v6h7V12h2v-2h-2V8h-2V6h-2V4h-2V2zm0 2v2h2v2h2v2h2v2h-2v8h-3v-6H9v6H6v-8H4v-2h2V8h2V6h2V4h4z"
      fill="currentColor"
    />
  </svg>
);

export const Calendar: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M15 2h2v2h4v18H3V4h4V2h2v2h6V2zM5 8h14V6H5v2zm0 2v10h14V10H5z"
      fill="currentColor"
    />
  </svg>
);

export const Sliders: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M17 4h2v10h-2V4zm0 12h-2v2h2v2h2v-2h2v-2h-4zm-4-6h-2v10h2V10zm-8 2H3v2h2v6h2v-6h2v-2H5zm8-8h-2v2H9v2h6V6h-2V4zM5 4h2v6H5V4z"
      fill="currentColor"
    />
  </svg>
);

export const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M4 2h14v2H4v16h2v-6h12v6h2V6h2v16H2V2h2zm4 18h8v-4H8v4zM20 6h-2V4h2v2zM6 6h9v4H6V6z"
      fill="currentColor"
    />
  </svg>
);

export const EditIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M18 2h-2v2h-2v2h-2v2h-2v2H8v2H6v2H4v2H2v6h6v-2h2v-2h2v-2h2v-2h2v-2h2v-2h2V8h2V6h-2V4h-2V2zm0 8h-2v2h-2v2h-2v2h-2v2H8v-2H6v-2h2v-2h2v-2h2V8h2V6h2v2h2v2zM6 16H4v4h4v-2H6v-2z"
      fill="currentColor"
    />
  </svg>
);

export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M5 5h2v2H5V5zm4 4H7V7h2v2zm2 2H9V9h2v2zm2 0h-2v2H9v2H7v2H5v2h2v-2h2v-2h2v-2h2v2h2v2h2v2h2v-2h-2v-2h-2v-2h-2v-2zm2-2v2h-2V9h2zm2-2v2h-2V7h2zm0 0V5h2v2h-2z"
      fill="currentColor"
    />
  </svg>
);

export const ChevronLeftIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props
) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M16 5v2h-2V5h2zm-4 4V7h2v2h-2zm-2 2V9h2v2h-2zm0 2H8v-2h2v2zm2 2v-2h-2v2h2zm0 0h2v2h-2v-2zm4 4v-2h-2v2h2z"
      fill="currentColor"
    />
  </svg>
);

export const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props
) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M8 5v2h2V5H8zm4 4V7h-2v2h2zm2 2V9h-2v2h2zm0 2h2v-2h-2v2zm-2 2v-2h2v2h-2zm0 0h-2v2h2v-2zm-4 4v-2h2v2H8z"
      fill="currentColor"
    />
  </svg>
);

export const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M18 6h2v2h-2V6zm-2 4V8h2v2h-2zm-2 2v-2h2v2h-2zm-2 2h2v-2h-2v2zm-2 2h2v-2h-2v2zm-2 0v2h2v-2H8zm-2-2h2v2H6v-2zm0 0H4v-2h2v2z"
      fill="currentColor"
    />
  </svg>
);

export const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z" fill="currentColor" />
  </svg>
);

export const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    {...props}
    className={cn("pixelart-icons-font", props.className)}
  >
    <path
      d="M16 2v4h6v2h-2v14H4V8H2V6h6V2h8zm-2 2h-4v2h4V4zm0 4H6v12h12V8h-4zm-5 2h2v8H9v-8zm6 0h-2v8h2v-8z"
      fill="currentColor"
    />
  </svg>
);
