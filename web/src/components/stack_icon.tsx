import React from "react";

interface StackIconsProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  background?: string;
  opacity?: number;
  rotation?: number;
  shadow?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  padding?: number;
  className?: string;
}

const StackIcons: React.FC<StackIconsProps> = ({
  size = 16,
  color = "currentColor",
  strokeWidth = 0,
  background = "transparent",
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0,
  className,
}) => {
  const transforms: string[] = [];

  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push("scaleX(-1)");
  if (flipVertical) transforms.push("scaleY(-1)");

  const viewBoxSize = 24 + padding * 2;
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="currentColor"
      stroke={strokeWidth > 0 ? color : "none"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        opacity,
        transform: transforms.length ? transforms.join(" ") : undefined,
        filter:
          shadow > 0
            ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))`
            : undefined,
        backgroundColor:
          background !== "transparent" ? background : undefined,
      }}
    >
      <path
        fill="currentColor"
        d="M12.525 16q.95 0 1.863-.4t1.587-1.2q.175-.2.075-.45t-.35-.3q-.95-.15-1.8-.713t-1.375-1.487q-.5-.875-.587-1.887T12.2 7.6q.1-.25-.062-.45T11.7 7q-1.725.325-2.725 1.625t-1 2.875q0 1.875 1.338 3.188T12.525 16M12 22q-3.475-.875-5.738-3.988T4 11.1V5l8-3l8 3v6.1q0 3.8-2.262 6.913T12 22m0-2.1q2.6-.825 4.3-3.3t1.7-5.5V6.375l-6-2.25l-6 2.25V11.1q0 3.025 1.7 5.5t4.3 3.3m0-7.9"
      />
    </svg>
  );
};

export default StackIcons;