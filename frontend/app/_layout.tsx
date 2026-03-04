import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { getDatabase } from '@/src/db/database';
import { seedDatabase } from '@/src/db/seed';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const colorScheme = useColorScheme();

  useEffect(() => {
    async function init() {
      await getDatabase();
      await seedDatabase();
      setDbReady(true);
      SplashScreen.hideAsync();
    }
    init();
  }, []);

  if (!dbReady) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="deck/[id]"
            options={{ title: 'Deck', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="deck/[id]/review"
            options={{ title: 'Review', headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="card/create"
            options={{ title: 'Add Card', presentation: 'modal' }}
          />
          <Stack.Screen
            name="import"
            options={{ title: 'Import Deck', presentation: 'modal' }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
