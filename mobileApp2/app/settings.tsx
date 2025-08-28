import * as React from "react";
import { View } from "react-native";
import { Text } from "../components/ui/text";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { useColorScheme } from "~/lib/useColorScheme";

export default function SettingsScreen() {
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <View className="flex-1 p-4 gap-6">
      <Text className="text-2xl font-semibold">Settings</Text>

      <View className="gap-2">
        <Text className="text-sm text-muted-foreground">Theme</Text>
        <ToggleGroup
          type="single"
          value={colorScheme as any}
          onValueChange={(v) => {
            if (!v) return;
            setColorScheme(v as any);
          }}
          className="bg-card rounded-xl p-1"
        >
          <ToggleGroupItem
            value="light"
            className="flex-1 px-4 py-2 rounded-lg"
          >
            <Text>Light</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="flex-1 px-4 py-2 rounded-lg">
            <Text>Dark</Text>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="system"
            className="flex-1 px-4 py-2 rounded-lg"
          >
            <Text>System</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </View>
    </View>
  );
}
