import '~/global.css';

import { DarkTheme, DefaultTheme, Theme, ThemeProvider } from '@react-navigation/native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import * as React from 'react';
import { Platform, Text, Pressable } from 'react-native';
import { NAV_THEME } from '~/lib/constants';
import { useColorScheme } from '~/lib/useColorScheme';
import { PortalHost } from '@rn-primitives/portal';
import { ThemeToggle } from '~/components/ThemeToggle';
import { setAndroidNavigationBar } from '~/lib/android-navigation-bar';
import { CustomDrawerContent } from '~/components/CustomDrawerContent';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
} from 'expo-router';

export default function RootLayout() {
  const hasMounted = React.useRef(false);
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === 'web') {
      // Adds the background color to the html element to prevent white background on overscroll.
      document.documentElement.classList.add('bg-background');
    }
    setAndroidNavigationBar(colorScheme);
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
        <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} />
        <Drawer
          drawerContent={(props) => <CustomDrawerContent {...props} />}
          screenOptions={({ navigation }: { navigation: any }) => ({
            headerLeft: () => (
              <Pressable onPress={() => navigation.toggleDrawer()} className="px-4">
                <Text className="text-accent-foreground">☰</Text>
              </Pressable>
            ),
            headerRight: () => <ThemeToggle />,
          })}
        >
          {/* <Drawer.Screen
            name="index"
            options={({ navigation }) => ({
              headerShown: false,
              headerTitle: '',
              headerLeft: () => (
                <Pressable onPress={() => navigation.toggleDrawer()} className="px-4">
                  <Text className="text-accent-foreground">☰</Text>
                </Pressable>
              ),
              headerRight: () => null,
            })}
          /> */}
          <Drawer.Screen
            name="async-demo"
            options={{ title: 'Async Demo' }}
          />
        </Drawer>
        <PortalHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;
