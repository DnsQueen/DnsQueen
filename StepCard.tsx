interface StepCardProps {
  number: number;
  title: string;
  description: string;
  icon: string;
  color: string;
  details?: string[];
}

export default function StepCard({ number, title, description, icon, color, details }: StepCardProps) {
  return (
    <div className={`relative p-5 rounded-xl border ${color} bg-gray-900/50 backdrop-blur-sm`}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-xl border border-gray-700">
            {icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Step {number}</span>
          </div>
          <h3 className="text-white font-semibold text-base mb-1">{title}</h3>
          <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
          {details && details.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {details.map((d, i) => (
                <li key={i} className="text-gray-500 text-xs flex items-start gap-1.5">
                  <span className="text-gray-600 mt-0.5">›</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
          <span className="text-gray-400 text-xs font-bold">{number}</span>
        </div>
      </div>
    </div>
  );
}
