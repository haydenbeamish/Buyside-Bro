import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LoginGateModalProps {
  open: boolean;
  onClose: () => void;
}

export function LoginGateModal({ open, onClose }: LoginGateModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-xl">Sign in for access</DialogTitle>
          <DialogDescription className="text-zinc-400 text-base pt-2">
            Sign in to access Portfolio, Watchlist, Analysis, Earnings, News, Ask Bro, and market wrap emails.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-3 pt-4">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
            Not now
          </Button>
          <a href="/api/login">
            <Button className="neon-button">Sign in</Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
