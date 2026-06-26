import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PermissionPage from '../Settings/Permission';
import WorkspacesTab from '@/components/WorkspacesTab';

export default function CloudSetupPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="environments">
        <TabsList>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
        </TabsList>
        <TabsContent value="environments">
          <PermissionPage />
        </TabsContent>
        <TabsContent value="workspaces">
          <WorkspacesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
