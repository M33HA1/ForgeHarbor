import React from 'react';
import { Fish, Waves, Circle } from 'lucide-react';

const FloatingElements = () => {
  // Generate fewer floating fish for better performance
  const fish = Array.from({ length: 4 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 80 + 10,
    delay: Math.random() * 8,
    duration: Math.random() * 5 + 10,
    size: Math.random() * 8 + 20,
    opacity: Math.random() * 0.2 + 0.2
  }));

  // Generate fewer bubbles
  const bubbles = Array.from({ length: 6 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 6,
    size: Math.random() * 6 + 8,
    opacity: Math.random() * 0.1 + 0.1
  }));

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Floating Fish */}
      {fish.map(fish => (
        <Fish
          key={`fish-${fish.id}`}
          size={fish.size}
          className="absolute animate-float"
          style={{
            left: `${fish.left}%`,
            top: `${fish.top}%`,
            animationDelay: `${fish.delay}s`,
            animationDuration: `${fish.duration}s`,
            opacity: fish.opacity,
            color: '#4ECDC4',
            transform: Math.random() > 0.5 ? 'scaleX(-1)' : 'scaleX(1)'
          }}
        />
      ))}

      {/* Floating Bubbles */}
      {bubbles.map(bubble => (
        <Circle
          key={`bubble-${bubble.id}`}
          size={bubble.size}
          className="absolute animate-bubble"
          style={{
            left: `${bubble.left}%`,
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.size * 0.8 + 6}s`,
            opacity: bubble.opacity,
            color: '#A8E6CF'
          }}
        />
      ))}

      {/* Subtle Wave Elements */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Waves
          key={`wave-${i}`}
          size={24}
          className="absolute animate-wave"
          style={{
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 60 + 20}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${Math.random() * 2 + 4}s`,
            opacity: 0.08,
            color: '#4ECDC4'
          }}
        />
      ))}
    </div>
  );
};

export default FloatingElements;