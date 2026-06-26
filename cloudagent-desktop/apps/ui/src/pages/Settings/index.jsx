import React from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { signOut } from '@aws-amplify/auth';
import { logout } from '../../features/auth/authSlice';
import { useDispatch } from 'react-redux';
import { clearSuggestions } from '../../features/commandCenter/commandCenterSlice';
import { HelpCircle, ExternalLink, LogOut } from 'lucide-react';
import { analytics, ANALYTICS_EVENTS } from '../../hooks/useAnalytics';
import DashboardSidebar from '../../components/DashboardSidebar';
import { Button } from '../../components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';

const navItems = [
  { name: 'My Account', path: '/settings', end: true },
];

function SettingsTopBar({ onSignOut }) {
  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center justify-end px-4 gap-2">
      <TooltipProvider>
        {/* Help */}
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href="https://docs.cloudagent.io/guide"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="ghost" className="text-gray-500">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </a>
          </TooltipTrigger>
          <TooltipContent>Documentation</TooltipContent>
        </Tooltip>

        {/* Back to Website */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/">
              <Button size="sm" variant="ghost" className="text-gray-500">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Back to Website</TooltipContent>
        </Tooltip>

        {/* Sign Out */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-500"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sign Out</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function SettingsLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      dispatch(clearSuggestions());
      analytics.track(ANALYTICS_EVENTS.USER_SIGNED_OUT);
      analytics.reset();
      await signOut();
      dispatch(logout());
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex h-screen">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <SettingsTopBar onSignOut={handleSignOut} />
        <div className="flex-1 overflow-auto bg-gray-50">
          {/* Settings sub-navigation */}
          <nav className="flex space-x-1 p-4 px-6 bg-white border-b border-gray-200">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `p-2 px-4 rounded-[6px] flex-shrink-0 whitespace-nowrap text-sm ${
                    isActive
                      ? 'bg-primary-100 text-primary-600 font-medium'
                      : 'text-gray-500 hover:text-primary-600 hover:bg-gray-50'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>
          <div className="p-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
