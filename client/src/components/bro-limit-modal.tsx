import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BroLimitModalProps {
  open: boolean;
  onClose: () => void;
}

export function BroLimitModal({ open, onClose }: BroLimitModalProps) {
  const [, navigate] = useLocation();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-xl">Want more Bro help?</DialogTitle>
          <DialogDescription className="text-zinc-400 text-base pt-2 space-y-2">
            <span className="block">Starter — $10/month for 5 Bro queries per day.</span>
            <span className="block">Pro — $100/month for 50 queries per month, plus hedging tools and trade tracker.</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
            Not now
          </Button>
          <Button
            className="neon-button"
            onClick={() => {
              onClose();
              navigate("/subscription");
            }}
          >
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
