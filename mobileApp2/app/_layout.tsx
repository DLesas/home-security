import "~/global.css";

import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { Platform, Text, Pressable, View } from "react-native";
import { NAV_THEME } from "~/lib/constants";
import { useColorScheme } from "~/lib/useColorScheme";
import { PortalHost } from "@rn-primitives/portal";
import { SocketProvider } from "~/providers/socketProvider";
import { SocketDataProvider } from "~/providers/socketDataProvider";
import { ThemeToggle } from "~/components/ThemeToggle";
import { setAndroidNavigationBar } from "~/lib/android-navigation-bar";
import { Bell, Home, Boxes, ScrollText, Settings } from "lucide-react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const queryClient = new QueryClient();

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export default function RootLayout() {
  const hasMounted = React.useRef(false);
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === "web") {
      // Adds the background color to the html element to prevent white background on overscroll.
      document.documentElement.classList.add("bg-background");
    }
    setAndroidNavigationBar(colorScheme);
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  if (!isColorSchemeLoaded) {
    return null;
  }
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
          <SocketProvider>
            <SocketDataProvider>
              <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
              <Tabs
                screenOptions={{
                  headerTitleAlign: "left",
                  headerShadowVisible: false,
                  headerStyle: {
                    borderBottomWidth: 0,
                    elevation: 0,
                    shadowOpacity: 0,
                  },
                  headerTitle: () => (
                    <View>
                      <Text className="text-md text-primary">
                        {getGreeting()}
                      </Text>
                      <Text className="text-lg font-bold">Robin Robert</Text>
                    </View>
                  ),
                  headerRight: () => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost">
                          <Bell
                            size={20}
                            color={isDarkColorScheme ? "#fff" : "#111"}
                          />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        side={"bottom"}
                        insets={contentInsets}
                        className="w-80"
                      >
                        <View className="flex-row items-center gap-2">
                          <Text className="font-medium leading-none native:text-xl">
                            Dimensions
                        </Text>
                          <Text className="text-sm text-muted-foreground">
                            Set the dim
                          </Text>
                        </View>
                      </PopoverContent>
                    </Popover>
                  ),
                  tabBarActiveTintColor:
                    NAV_THEME[isDarkColorScheme ? "dark" : "light"].primary,
                  tabBarStyle: { height: 64 },
                }}
              >
                <Tabs.Screen
                  name="index"
                  options={{
                    tabBarIcon: ({ color }) => (
                      <Home color={color as string} size={22} />
                    ),
                  }}
                />
                <Tabs.Screen
                  name="async-demo"
                  options={{
                    title: "Devices",
                    tabBarIcon: ({ color }) => (
                      <Boxes color={color as string} size={22} />
                    ),
                  }}
                />
                <Tabs.Screen
                  name="logs"
                  options={{
                    title: "Logs",
                    tabBarIcon: ({ color }) => (
                      <ScrollText color={color as string} size={22} />
                    ),
                  }}
                />
                <Tabs.Screen
                  name="settings"
                  options={{
                    title: "Settings",
                    tabBarIcon: ({ color }) => (
                      <Settings color={color as string} size={22} />
                    ),
                  }}
                />
              </Tabs>
              <PortalHost />
            </SocketDataProvider>
          </SocketProvider>
        </ThemeProvider>
      </QueryClientProvider>
      <PortalHost />
    </>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === "web" && typeof window === "undefined"
    ? React.useEffect
    : React.useLayoutEffect;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}
