'use client';

interface EnergyBadgeProps {
  energyClass: string;
}

const energyColors: Record<string, string> = {
  A: 'bg-green-500 text-white',
  B: 'bg-green-400 text-white',
  C: 'bg-yellow-400 text-gray-900',
  D: 'bg-yellow-500 text-gray-900',
  E: 'bg-orange-400 text-white',
  F: 'bg-red-400 text-white',
  G: 'bg-red-600 text-white',
};

export function EnergyBadge({ energyClass }: EnergyBadgeProps) {
  const letter = energyClass.toUpperCase().charAt(0);
  const color = energyColors[letter] || 'bg-gray-300 text-gray-700';

  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black ${color}`}>
      {letter}
    </span>
  );
}
