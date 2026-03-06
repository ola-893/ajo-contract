import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface CycleCountdownProps {
  cycleStartTime: number;
  cycleDuration: number;
  currentCycle: number;
}

const CycleCountdown = ({
  cycleStartTime,
  cycleDuration,
  currentCycle,
}: CycleCountdownProps) => {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const nextCycleStart = cycleStartTime + currentCycle * cycleDuration;
      const diff = nextCycleStart - now;

      if (diff <= 0) {
        setTimeLeft("Cycle ready to advance");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

      setTimeLeft(parts.join(" "));
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [cycleStartTime, cycleDuration, currentCycle]);

  return (
    <div className="flex items-center justify-between bg-primary/10 rounded-lg p-4 border border-primary/20">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">
          Next Cycle Starts In:
        </span>
      </div>
      <span className="text-lg font-bold text-primary">{timeLeft}</span>
    </div>
  );
};

export default CycleCountdown;
