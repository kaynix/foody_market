interface EmptyImagePlaceholderProps {
  width?: number;
  height?: number;
  className?: string;
  title?: string;
}

const EmptyImagePlaceholder = ({ 
  width = 400, 
  height = 400, 
  className = "",
  title = "No Image Available"
}: EmptyImagePlaceholderProps) => {
  return (
    <div className={`flex items-center justify-center bg-base-200 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-60"
      >
        {/* Background */}
        <rect width="400" height="400" fill="currentColor" className="text-base-300" fillOpacity="0.1"/>
        
        {/* Mountain silhouette */}
        <path
          d="M0 280 L80 180 L150 220 L200 160 L280 200 L350 140 L400 180 L400 400 L0 400 Z"
          fill="currentColor"
          className="text-base-300"
          fillOpacity="0.3"
        />
        
        {/* Sun */}
        <circle
          cx="320"
          cy="100"
          r="30"
          fill="currentColor"
          className="text-base-300"
          fillOpacity="0.4"
        />
        
        {/* Camera icon */}
        <g transform="translate(170, 170)">
          <rect
            x="0"
            y="10"
            width="60"
            height="40"
            rx="4"
            fill="currentColor"
            className="text-base-content"
            fillOpacity="0.3"
          />
          <rect
            x="15"
            y="0"
            width="30"
            height="8"
            rx="4"
            fill="currentColor"
            className="text-base-content"
            fillOpacity="0.3"
          />
          <circle
            cx="30"
            cy="30"
            r="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-base-content"
            strokeOpacity="0.5"
          />
          <circle
            cx="30"
            cy="30"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-base-content"
            strokeOpacity="0.4"
          />
          <rect
            x="45"
            y="15"
            width="6"
            height="4"
            rx="1"
            fill="currentColor"
            className="text-base-content"
            fillOpacity="0.3"
          />
        </g>
        
        {/* Decorative dots */}
        <circle cx="50" cy="120" r="3" fill="currentColor" className="text-base-300" fillOpacity="0.4"/>
        <circle cx="80" cy="100" r="2" fill="currentColor" className="text-base-300" fillOpacity="0.3"/>
        <circle cx="100" cy="80" r="2.5" fill="currentColor" className="text-base-300" fillOpacity="0.5"/>
        
        {/* Text */}
        <text
          x="200"
          y="280"
          textAnchor="middle"
          fill="currentColor"
          className="text-base-content text-sm font-medium"
          fillOpacity="0.6"
        >
          {title}
        </text>
      </svg>
    </div>
  );
};

export default EmptyImagePlaceholder;