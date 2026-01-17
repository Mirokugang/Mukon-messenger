import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { theme } from './src/theme';
import { WalletProvider, useWallet } from './src/contexts/WalletContext';
import WalletConnectScreen from './src/screens/WalletConnectScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import ChatScreen from './src/screens/ChatScreen';
import AddContactScreen from './src/screens/AddContactScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.textPrimary,
    border: theme.colors.surface,
  },
};

function AppNavigator() {
  const { connected } = useWallet();

  if (!connected) {
    return <WalletConnectScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.surface,
          },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Contacts"
          component={ContactsScreen}
          options={{ title: 'Mukon Messenger' }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ headerBackTitleVisible: false }}
        />
        <Stack.Screen
          name="AddContact"
          component={AddContactScreen}
          options={{ title: 'Add Contact' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <PaperProvider theme={theme}>
        <AppNavigator />
      </PaperProvider>
    </WalletProvider>
  );
}
