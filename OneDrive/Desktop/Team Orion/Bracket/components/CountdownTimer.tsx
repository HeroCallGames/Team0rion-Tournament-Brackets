import React, { useState, useEffect } from 'react';
import { Card } from './ui';

interface CountdownTimerProps {
  targetDate: string;
}

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

const TimePart = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
        <div className="text-4xl md:text-6xl font-orbitron font-black" style={{ textShadow: '0 0 5px #f87171, 0 0 8px #f87171' }}>
            {String(value).padStart(2, '0')}
        </div>
        <div className="text-sm uppercase tracking-widest">{label}</div>
    </div>
);

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const calculateTimeLeft = (): Partial<TimeLeft> => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft: Partial<TimeLeft> = {};

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Avoids hydration mismatch and ensures timer starts on client
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearTimeout(timer);
  });

  if (!isMounted) {
    return null;
  }
  
  const hasTimeLeft = timeLeft.days !== undefined;

  return (
    <Card className="my-8">
      <div className="text-center text-red-400">
        {hasTimeLeft ? (
          <>
            <h3 className="text-xl font-orbitron font-bold mb-4 tracking-wider text-red-300" style={{ textShadow: '0 0 3px #f87171' }}>
              --- Starting In ---
            </h3>
            <div className="flex justify-center items-start gap-4 md:gap-8">
              <TimePart value={timeLeft.days!} label="Days" />
              <TimePart value={timeLeft.hours!} label="Hours" />
              <TimePart value={timeLeft.minutes!} label="Minutes" />
              <TimePart value={timeLeft.seconds!} label="Seconds" />
            </div>
          </>
        ) : (
          <div className="text-4xl font-orbitron font-bold" style={{ textShadow: '0 0 1px #f87171, 0 0 3px #f87171' }}>
            Starting Soon
          </div>
        )}
      </div>
    </Card>
  );
};

export default CountdownTimer;