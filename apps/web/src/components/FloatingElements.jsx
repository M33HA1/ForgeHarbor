import React from 'react';
import { Fish, Waves, Circle, Anchor } from 'lucide-react';

const FloatingElements = () => {
  // Generate floating fish
  const fish = Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 80 + 10,
    delay: Math.random() * 8,
    duration: Math.random() * 10 + 15,
    size: Math.random() * 12 + 16,
    color: '#4ECDC4',
    opacity: 0.3
  }));

  // Generate floating bubbles
  const bubbles = Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 6,
    size: Math.random() * 8 + 6,
    opacity: 0.2
  }));

  // Generate sea stars
  const seaStars = Array.from({ length: 4 }).map((_, i) => ({
    id: i,
    left: Math.random() * 80 + 10,
    bottom: Math.random() * 20 + 5,
    delay: Math.random() * 4,
    size: Math.random() * 8 + 12,
    opacity: 0.4
  }));

  // Generate coral formations
  const corals = Array.from({ length: 6 }).map((_, i) => ({
    id: i,
    left: Math.random() * 90 + 5,
    bottom: Math.random() * 15 + 5,
    height: Math.random() * 30 + 20,
    delay: Math.random() * 3,
    opacity: 0.3
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
            color: fish.color,
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
            animationDuration: `${bubble.size * 0.5 + 8}s`,
            opacity: bubble.opacity,
            color: '#A8E6CF'
          }}
        />
      ))}

      {/* Subtle Wave Elements */}
      {Array.from({ length: 5 }).map((_, i) => (
        <Waves
          key={`wave-${i}`}
          size={20}
          className="absolute animate-wave"
          style={{
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 60 + 20}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${Math.random() * 2 + 4}s`,
            opacity: 0.1,
            color: '#4ECDC4'
          }}
        />
      ))}

      {/* Coral Formations */}
      {/*
      {corals.map(coral => (
        <div
          key={`coral-${coral.id}`}
          className="absolute animate-pulse-slow"
          style={{
            left: `${coral.left}%`,
            bottom: `${coral.bottom}%`,
            height: `${coral.height}px`,
            width: '4px',
            background: 'linear-gradient(to top, #FF6B6B, #4ECDC4)',
            borderRadius: '2px',
            animationDelay: `${coral.delay}s`,
            opacity: coral.opacity
          }}
        />
      ))}
      */}

      {/* Floating Seaweed */}
      {/*
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`seaweed-${i}`}
          className="absolute animate-pulse-slow"
          style={{
            left: `${Math.random() * 90 + 5}%`,
            bottom: `${Math.random() * 15 + 5}%`,
            height: `${Math.random() * 40 + 20}px`,
            width: '2px',
            background: 'linear-gradient(to top, #4CAF50, #8BC34A)',
            borderRadius: '1px',
            animationDelay: `${Math.random() * 3}s`,
            opacity: 0.4
          }}
        />
      ))}
      */}

      {/* Jellyfish-like Elements */}
      {/* {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={`jellyfish-${i}`}
          className="absolute animate-float"
          style={{
            left: `${Math.random() * 80 + 10}%`,
            top: `${Math.random() * 40 + 30}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${Math.random() * 3 + 6}s`,
            opacity: 0.2
          }}
        >
          <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
          <div className="w-1 h-8 bg-purple-300 mx-auto mt-1 opacity-60"></div>
        </div>
      ))} */}
    </div>
  );
};

export default FloatingElements;
