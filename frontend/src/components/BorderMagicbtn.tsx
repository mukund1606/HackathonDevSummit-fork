import React from "react";

const BorderMagicButton = () => {
  return (
    <button className="relative px-6 py-3 text-white font-bold bg-black rounded-full border border-transparent transition-all duration-300 
                       before:absolute before:inset-0 before:rounded-full before:border before:border-blue-500 before:opacity-50 
                       hover:before:opacity-100 hover:before:scale-105">
      Border Magic
    </button>
  );
};

export default BorderMagicButton;
