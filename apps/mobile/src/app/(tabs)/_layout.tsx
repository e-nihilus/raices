import { Tabs } from "expo-router";
import { Icon, colors } from "../../components/ui";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: "#edf2ed",
          height: 86,
          paddingTop: 10,
          paddingBottom: 22,
        },
        tabBarLabelStyle: { fontFamily: "JakartaSemi", fontSize: 12 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Grabar",
          tabBarIcon: ({ color }) => <Icon name="mic" color={color} />,
        }}
      />
      <Tabs.Screen
        name="memories"
        options={{
          title: "Recuerdos",
          tabBarIcon: ({ color }) => <Icon name="book-open" color={color} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: "Familia",
          tabBarIcon: ({ color }) => <Icon name="users" color={color} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: "Archivo IA",
          tabBarIcon: ({ color }) => <Icon name="zap" color={color} />,
        }}
      />
    </Tabs>
  );
}
