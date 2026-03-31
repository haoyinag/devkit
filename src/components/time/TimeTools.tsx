import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeDashboard } from "./TimeDashboard";
import { TimestampConverter } from "./TimestampConverter";
import { TimeDiffCalculator } from "./TimeDiffCalculator";
import { TimeRangeGenerator } from "./TimeRangeGenerator";

export function TimeTools() {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h2 className="text-2xl font-bold tracking-tight">时间工具</h2>
      <Tabs defaultValue="range" className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="range">接口时间范围</TabsTrigger>
          <TabsTrigger value="clock">当前时间</TabsTrigger>
          <TabsTrigger value="convert">时间戳转换</TabsTrigger>
          <TabsTrigger value="diff">时间差计算</TabsTrigger>
        </TabsList>
        <TabsContent value="range" className="mt-4 overflow-y-auto">
          <TimeRangeGenerator />
        </TabsContent>
        <TabsContent value="clock" className="mt-4">
          <TimeDashboard />
        </TabsContent>
        <TabsContent value="convert" className="mt-4 overflow-y-auto">
          <TimestampConverter />
        </TabsContent>
        <TabsContent value="diff" className="mt-4 overflow-y-auto">
          <TimeDiffCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
