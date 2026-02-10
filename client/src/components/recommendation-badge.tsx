import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";

export function RecommendationBadge({ action, confidence }: { action: string; confidence: number }) {
  const actionLower = action?.toLowerCase() || "hold";
  let bgColor = "bg-zinc-700";
  let textColor = "text-zinc-300";
  let Icon = Minus;

  if (actionLower === "buy" || actionLower === "strong buy") {
    bgColor = "bg-green-600";
    textColor = "text-white";
    Icon = ThumbsUp;
  } else if (actionLower === "sell" || actionLower === "strong sell") {
    bgColor = "bg-red-600";
    textColor = "text-white";
    Icon = ThumbsDown;
  }

  return (
    <div className="flex items-center gap-3">
      <div className={`${bgColor} ${textColor} px-3 sm:px-4 py-2 rounded-lg flex items-center gap-2 font-bold text-base sm:text-lg`}>
        <Icon className="h-5 w-5" />
        {action?.toUpperCase() || "HOLD"}
      </div>
      <div className="text-sm text-zinc-400">
        <span className="font-mono text-white">{confidence}%</span> confidence
      </div>
    </div>
  );
}
