import { useState, useEffect } from 'react';

interface Props {
    createdAt: string;
    durationMinutes: number;
    status: string;
    onPhaseChange?: () => void;
}

export default function AuctionTimer({ createdAt, durationMinutes, status, onPhaseChange }: Props) {
    const [timeLeft, setTimeLeft] = useState("");
    const [phaseLabel, setPhaseLabel] = useState("");

    useEffect(() => {
        const updateTimer = () => {
            const start = new Date(createdAt).getTime();
            const totalMs = durationMinutes * 60 * 1000;
            const biddingMs = totalMs * 0.9;
            const now = new Date().getTime();

            let targetTime = 0;
            let label = "";

            if (status === 'OPEN') {
                targetTime = start + biddingMs;
                label = "Bidding ends in";
            } else if (status === 'REVEAL') {
                targetTime = start + totalMs; //end of auction
                label = "Reveal ends in";
            } else {
                setTimeLeft("Ended");
                setPhaseLabel("Auction");
                return;
            }

            const diff = targetTime - now;

            if (diff <= 0) {
                setTimeLeft("00:00");
                if (onPhaseChange) onPhaseChange(); // parent refresh
            } else {
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${m}m ${s}s`);
                setPhaseLabel(label);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [createdAt, durationMinutes, status, onPhaseChange]);

    if (status === 'CLOSED') return <span className="text-grey">(Closed)</span>;

    return (
        <span className="auction-timer-container">
            {phaseLabel}: <strong className="mono-font">{timeLeft}</strong>
        </span>
    );
}