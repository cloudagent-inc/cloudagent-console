import React, { useState } from 'react';
import HelpChatModal from './HelpChatModal';
import { Icons } from './icons';

const ChatLauncher = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating launcher button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
        className="fixed right-4 bottom-16 z-50 h-12 rounded-full shadow-lg bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-2 px-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        <Icons.chatStar className="h-5 w-5" />
        <span className="text-sm font-medium">CloudAgent</span>
      </button>

      {/* Modal (mounted when open) */}
      {isOpen && (
        <HelpChatModal onClose={() => setIsOpen(false)} />
      )}
    </>
  );
};

export default ChatLauncher;


