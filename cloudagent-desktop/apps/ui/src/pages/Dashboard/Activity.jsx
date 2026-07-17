import React from 'react';
import { NavLink } from 'react-router-dom';

export default function ActivityWrapper({ children }) {
  const activityTabs = [
    { name: 'Agent Runs', path: '/dashboard/agents' },
    { name: 'Workflow History', path: '/dashboard/workflow-history' },
  ];

  return (
    <div>
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {activityTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                `py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`
              }
            >
              {tab.name}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="py-4">{children}</div>
    </div>
  );
}
