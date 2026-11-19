import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { PortalSection } from '../types/health';

interface TopBarProps {
  activeSection: PortalSection;
  onSelectSection: (section: PortalSection) => void;
  onLogout: () => void;
}

const NAV_ITEMS: { id: PortalSection; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'awareness', label: 'Awareness' },
  { id: 'food', label: 'Healthy Food' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'chat', label: 'Hygiene Chat' },
];

export function TopBar({ activeSection, onSelectSection, onLogout }: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (section: PortalSection) => {
    onSelectSection(section);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#DCE6E0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="text-lg font-bold tracking-tight text-[#14241B] whitespace-nowrap shrink-0 hover:text-[#146C43] transition-colors cursor-pointer"
        >
          Health &amp; Hygiene
        </button>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#146C43] font-semibold'
                    : 'text-[#495D52] hover:text-[#14241B]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#146C43]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="hidden md:inline-flex items-center justify-center px-4 py-2 min-h-10 text-sm font-medium text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Logout
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#DCE6E0] text-[#14241B] hover:bg-[#F3F7F5] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#DCE6E0] bg-white px-4 py-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF6F1] text-[#146C43] font-semibold'
                    : 'text-[#495D52] hover:bg-[#F5F8F6] hover:text-[#14241B]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onSelectSection('contact');
            }}
            className={`w-full text-left px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeSection === 'contact'
                ? 'bg-[#EEF6F1] text-[#146C43] font-semibold'
                : 'text-[#495D52] hover:bg-[#F5F8F6] hover:text-[#14241B]'
            }`}
          >
            Contact
          </button>
          <div className="pt-2 border-t border-[#DCE6E0]">
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-2.5 px-4 min-h-11 text-sm font-medium text-white bg-[#146C43] rounded-lg hover:bg-[#0F5333] transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
