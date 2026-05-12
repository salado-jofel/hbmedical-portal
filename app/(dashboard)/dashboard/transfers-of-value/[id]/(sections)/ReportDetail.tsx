"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransferEntriesTab } from "../(components)/TransferEntriesTab";
import { GroupMealsTab } from "../(components)/GroupMealsTab";
import { SamplesTab } from "../(components)/SamplesTab";
import { ConsultingTab } from "../(components)/ConsultingTab";
import { ComplianceFlagsTab } from "../(components)/ComplianceFlagsTab";

export function ReportDetail({ canEdit }: { canEdit: boolean }) {
  return (
    <Tabs defaultValue="transfers" className="w-full">
      {/* Wrap TabsList in an overflow-x-auto div so the active-tab
          underline (positioned via ::after below the trigger) doesn't
          trip implicit overflow-y on TabsList itself. */}
      <div className="w-full overflow-x-auto pb-1">
        <TabsList variant="line" className="w-max flex-nowrap">
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="group_meals">Group Meals</TabsTrigger>
          <TabsTrigger value="samples">Samples</TabsTrigger>
          <TabsTrigger value="consulting">Consulting</TabsTrigger>
          <TabsTrigger value="flags">Compliance Flags</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="transfers" className="pt-4">
        <TransferEntriesTab canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="group_meals" className="pt-4">
        <GroupMealsTab canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="samples" className="pt-4">
        <SamplesTab canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="consulting" className="pt-4">
        <ConsultingTab canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="flags" className="pt-4">
        <ComplianceFlagsTab canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}
