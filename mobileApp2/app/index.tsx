import * as React from "react";
import { View, FlatList, Dimensions } from "react-native";
import { useSocketData, useSocket } from "~/providers/socket";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { Circle, Shield, ShieldOff, AlertTriangle } from "lucide-react-native";
import { Switch } from "~/components/ui/switch";

export default function Screen() {
  const { data, isConnected } = useSocketData();
  const { url } = useSocket();

  const [loading, setLoading] = React.useState<
    Record<string, "arm" | "disarm" | null>
  >({});

  const buildings = React.useMemo(
    () => Object.keys(data?.logs ?? {}),
    [data?.logs]
  );

  function countDoorEntriesBuilding(building: string): {
    armed: number;
    disarmed: number;
  } {
    let armedCount = 0;
    let disarmedCount = 0;
    const doors = (data?.logs as any)?.[building] || {};
    for (const door in doors) {
      if (doors[door]?.armed) armedCount++;
      else disarmedCount++;
    }
    return { armed: armedCount, disarmed: disarmedCount };
  }

  function checkArmedState(
    armed: number,
    disarmed: number
  ): "Armed" | "Disarmed" | "Partially armed" | "Unknown" {
    if (armed === 0 && disarmed === 0) return "Unknown";
    if (armed > 0 && disarmed > 0) return "Partially armed";
    if (armed > 0 && disarmed === 0) return "Armed";
    return "Disarmed";
  }

  async function armBuilding(building: string) {
    if (!url) return;
    setLoading((s) => ({ ...s, [building]: "arm" }));
    try {
      await fetch(
        `${url}/api/v1/buildings/${encodeURIComponent(building)}/arm`,
        { method: "POST" }
      );
    } finally {
      setLoading((s) => ({ ...s, [building]: null }));
    }
  }

  async function disarmBuilding(building: string) {
    if (!url) return;
    setLoading((s) => ({ ...s, [building]: "disarm" }));
    try {
      await fetch(
        `${url}/api/v1/buildings/${encodeURIComponent(building)}/disarm`,
        { method: "POST" }
      );
    } finally {
      setLoading((s) => ({ ...s, [building]: null }));
    }
  }

  function StateBadge({
    state,
  }: {
    state: "Armed" | "Disarmed" | "Partially armed" | "Unknown";
  }) {
    const color =
      state === "Armed"
        ? "bg-red-500/15 text-red-500 border-red-500/30"
        : state === "Disarmed"
        ? "bg-green-500/15 text-green-500 border-green-500/30"
        : state === "Partially armed"
        ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
        : "bg-muted text-muted-foreground border-border";
    const Icon =
      state === "Armed"
        ? Shield
        : state === "Disarmed"
        ? ShieldOff
        : AlertTriangle;
    return (
      <View
        className={`flex-row items-center gap-1 px-2 py-1 rounded-full border ${color}`}
      >
        <Icon size={14} color="currentColor" />
        <Text className="text-xs font-medium">{state}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 p-4 gap-4">
      {/* Greeting and quick status */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Circle
            size={10}
            color={isConnected ? "#22c55e" : "#ef4444"}
            fill={isConnected ? "#22c55e" : "#ef4444"}
          />
          <Text className="text-sm text-muted-foreground">
            {isConnected ? "Online" : "Offline"}
          </Text>
        </View>
      </View>

      {/* Building list */}
      <FlatList
        data={buildings}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item: building }) => {
          const { armed, disarmed } = countDoorEntriesBuilding(building);
          const state = checkArmedState(armed, disarmed);
          const isArmed = state === "Armed";
          const isDisarmed = state === "Disarmed";
          const busy = loading[building];

          return (
            <Card
              className="border border-border bg-card"
              style={{
                height: Math.floor(Dimensions.get("window").height * 0.5),
              }}
            >
              <CardHeader className="flex-row items-center justify-between">
                <View className="gap-1">
                  <CardTitle>{building}</CardTitle>
                  <CardDescription>
                    Doors: {armed + disarmed} • Armed: {armed} • Disarmed:{" "}
                    {disarmed}
                  </CardDescription>
                </View>
                <StateBadge state={state} />
              </CardHeader>
              <CardContent className="flex-1 items-center justify-center">
                <View className="items-center gap-3">
                  <Text className="text-sm text-muted-foreground">
                    Toggle to arm/disarm this building
                  </Text>
                  <Switch
                    checked={isArmed}
                    disabled={!url || !!busy}
                    onCheckedChange={(val) => {
                      if (val) {
                        armBuilding(building);
                      } else {
                        disarmBuilding(building);
                      }
                    }}
                  />
                  {busy && (
                    <Text className="text-xs text-muted-foreground">
                      {busy === "arm" ? "Arming..." : "Disarming..."}
                    </Text>
                  )}
                </View>
              </CardContent>
            </Card>
          );
        }}
        ListEmptyComponent={() => (
          <Card>
            <CardContent className="py-8 items-center">
              <Text className="text-muted-foreground">No buildings yet.</Text>
            </CardContent>
          </Card>
        )}
      />
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}
