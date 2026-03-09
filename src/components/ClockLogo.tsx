"use client";

import { useEffect, useState } from "react";

export default function ClockLogo() {
  const [seconds, setSeconds] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [hours, setHours] = useState(0);

  useEffect(() => {
    function updateTime() {
      const now = new Date();
      setSeconds(now.getSeconds());
      setMinutes(now.getMinutes());
      setHours(now.getHours() % 12);
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const secondAngle = seconds * 6;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const hourAngle = hours * 30 + minutes * 0.5;

  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Outer ring */}
        <circle cx="50" cy="50" r="48" fill="none" stroke="#8b6914" strokeWidth="2" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#5c3a21" strokeWidth="1" />

        {/* Clock face */}
        <circle cx="50" cy="50" r="44" fill="#2d1a0e" />
        <circle cx="50" cy="50" r="42" fill="none" stroke="#3d2517" strokeWidth="0.5" />

        {/* Hour markers */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x1 = 50 + 36 * Math.cos(angle);
          const y1 = 50 + 36 * Math.sin(angle);
          const x2 = 50 + 40 * Math.cos(angle);
          const y2 = 50 + 40 * Math.sin(angle);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#c9a84c"
              strokeWidth={i % 3 === 0 ? "2.5" : "1"}
              strokeLinecap="round"
            />
          );
        })}

        {/* Roman numerals at 12, 3, 6, 9 */}
        <text x="50" y="22" textAnchor="middle" fill="#c9a84c" fontSize="8" fontFamily="serif">XII</text>
        <text x="80" y="53" textAnchor="middle" fill="#c9a84c" fontSize="7" fontFamily="serif">III</text>
        <text x="50" y="84" textAnchor="middle" fill="#c9a84c" fontSize="7" fontFamily="serif">VI</text>
        <text x="20" y="53" textAnchor="middle" fill="#c9a84c" fontSize="7" fontFamily="serif">IX</text>

        {/* Hour hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 22 * Math.cos((hourAngle - 90) * (Math.PI / 180))}
          y2={50 + 22 * Math.sin((hourAngle - 90) * (Math.PI / 180))}
          stroke="#c9a84c"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Minute hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 30 * Math.cos((minuteAngle - 90) * (Math.PI / 180))}
          y2={50 + 30 * Math.sin((minuteAngle - 90) * (Math.PI / 180))}
          stroke="#f5e6c8"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Second hand */}
        <line
          x1="50"
          y1="50"
          x2={50 + 34 * Math.cos((secondAngle - 90) * (Math.PI / 180))}
          y2={50 + 34 * Math.sin((secondAngle - 90) * (Math.PI / 180))}
          stroke="#8b3a3a"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx="50" cy="50" r="3" fill="#c9a84c" />
        <circle cx="50" cy="50" r="1.5" fill="#2d1a0e" />
      </svg>
    </div>
  );
}
