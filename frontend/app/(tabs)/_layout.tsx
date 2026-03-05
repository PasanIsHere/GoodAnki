import React from 'react';
import { Pressable, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Decks',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/import')}
              style={{ marginRight: 16, paddingVertical: 4, paddingHorizontal: 2 }}
            >
              <Text style={{ color: Colors[colorScheme].tint, fontSize: 16, fontWeight: '500' }}>
                Import
              </Text>
            </Pressable>
          ),
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'rectangle.stack', android: 'cards', web: 'cards' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'gear', android: 'settings', web: 'settings' }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
