interface TicketIconProps {
  size?: number;
  className?: string;
}

export default function TicketIcon({ size = 24, className = "" }: TicketIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Ticket outline with semicircular notches on left and right sides */}
      <path d="M3 5 L21 5 Q23 5 23 7 L23 9.5 A2.5 2.5 0 0 0 23 14.5 L23 17 Q23 19 21 19 L3 19 Q1 19 1 17 L1 14.5 A2.5 2.5 0 0 0 1 9.5 L1 7 Q1 5 3 5 Z" />
    </svg>
  );
}
