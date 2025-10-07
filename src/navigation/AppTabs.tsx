import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import HomeScreen from "../screens/Home/HomeScreen";
import CreateStack from "./CreateStack";
import HistoryStack from "./HistoryStack";
import ProfileScreen from "../screens/Profile/ProfileScreen";
import { theme } from "../styles/theme";
import Icon, { IconName } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

export type AppTabsParamList = {
  Home: undefined;
  Create: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

const TabBarIcon: React.FC<{
  focused: boolean;
  iconName: IconName;
  tabName: string;
}> = ({ focused, iconName, tabName }) => {
  return (
    <View style={{ justifyContent: "center", alignItems: "center" }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: focused
            ? theme.colors.primary + "15"
            : "transparent",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Icon
          name={iconName}
          size={20}
          color={focused ? theme.colors.primary : theme.colors.textSecondary}
        />
      </View>
      {/* <Text
        style={{
          fontSize: 10,
          color: focused ? theme.colors.primary : theme.colors.textSecondary,
          marginTop: 1,
          textAlign: "center",
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {tabName}
      </Text> */}
    </View>
  );
};

const AppTabs: React.FC = () => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const navigation = useNavigation();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          // height: 50,
          paddingBottom: insets.bottom + 8,
          paddingTop: 10,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          color: theme.colors.text,
          fontSize: theme.fontSize.title,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              focused={focused}
              iconName="home"
              tabName={t("navigation.home")}
            />
          ),
          // tabBarIconStyle: {

          // },
          tabBarLabel: t("navigation.home"),
          // tabBarLabelStyle: { marginBottom: 10 },
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateStack}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              focused={focused}
              iconName="plus"
              tabName={t("navigation.add")}
            />
          ),
          tabBarLabel: t("navigation.add"),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryStack}
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              focused={focused}
              iconName="chart"
              tabName={t("navigation.history")}
            />
          ),
          tabBarLabel: t("navigation.history"),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t("navigation.profile"),
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              focused={focused}
              iconName="user"
              tabName={t("navigation.me")}
            />
          ),

          tabBarLabel: t("navigation.me"),
        }}
      />
    </Tab.Navigator>
  );
};

export default AppTabs;
