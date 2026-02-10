import { useState, useEffect } from "react";
import {
  Loader2,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import logoImg from "@assets/image_1770442846290.png";

export function ThinkingLoader({ messages }: { messages?: string[] }) {
  const [statusIndex, setStatusIndex] = useState(0);
  const statuses = messages || [
    "Analyzing your positions...",
    "Reviewing sector allocation...",
    "Checking risk exposure...",
    "Evaluating diversification...",
    "Researching your holdings...",
    "Preparing recommendations...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % statuses.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [statuses.length]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative mb-6">
        <img
          src={logoImg}
          alt="Loading"
          className="w-20 h-20 object-contain animate-pulse drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]"
        />
        <Loader2 className="absolute -bottom-2 -right-2 w-6 h-6 text-amber-500 animate-spin" />
      </div>
      <p className="text-lg text-amber-400 font-medium mb-2">Bro is thinking...</p>
      <p className="text-sm text-zinc-400 animate-pulse">{statuses[statusIndex]}</p>

      <div className="flex items-center gap-4 sm:gap-8 mt-8">
        {[
          { icon: BarChart3, label: "Analysis" },
          { icon: Target, label: "Targets" },
          { icon: AlertTriangle, label: "Risks" },
          { icon: CheckCircle, label: "Actions" },
        ].map((item, idx) => (
          <div key={item.label} className="flex flex-col items-center gap-2">
            <div className={`p-3 rounded-full bg-zinc-800 border border-zinc-800 ${idx <= statusIndex % 4 ? 'border-amber-500/50' : ''}`}>
              <item.icon className={`w-5 h-5 ${idx <= statusIndex % 4 ? 'text-amber-500' : 'text-zinc-600'}`} />
            </div>
            <span className={`text-xs ${idx <= statusIndex % 4 ? 'text-amber-400' : 'text-zinc-600'}`}>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="w-64 h-1 bg-zinc-800 rounded-full mt-8 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full animate-[loading_2s_ease-in-out_infinite]"
             style={{ width: '60%' }} />
      </div>
    </div>
  );
}
