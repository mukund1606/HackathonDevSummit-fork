import Link from 'next/link';
import React from 'react'
import { ModeToggle } from './ToggleSwitch';

export default function Navbar() {
  return (
    <nav className="w-full py-4 px-6 flex items-center justify-between bg-background border-border shadow-md">
      {/* Highlighted SonicBridge Title */}
      <Link href="/">
      <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 dark:from-white dark:to-gray-300">
  SonicBridge
</h1>

      </Link>

      {/* Mode Toggle */}
      <ModeToggle />
    </nav>
  );
}
