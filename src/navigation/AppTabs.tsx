import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import HomeScreen from '../screens/Home/HomeScreen';
import CreateStack from './CreateStack';
import HistoryStack from './HistoryStack';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import { theme } from '../styles/theme';
import Icon, { IconName } from '../components/Icon';

export type AppTabsParamList = {
  Home: undefined;
  Create: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

const TabBarIcon: React.FC<{ focused: boolean; iconName: IconName }> = ({ focused, iconName }) => {
  return (
    <View style={{
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: focused ? theme.colors.primary + '15' : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Icon
        name={iconName}
        size={20}
        color={focused ? theme.colors.primary : theme.colors.textSecondary}
      />
    </View>
  );
};

const AppTabs: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text,
          fontSize: theme.fontSize.title,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} iconName="home" />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateStack}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} iconName="plus" />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryStack}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} iconName="chart" />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('navigation.profile'),
          tabBarIcon: ({ focused }) => <TabBarIcon focused={focused} iconName="user" />,
          tabBarLabel: () => null,
        }}
      />
    </Tab.Navigator>
  );
};

export default AppTabs;