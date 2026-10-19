import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { Newsreader_400Regular } from "@expo-google-fonts/newsreader/400Regular";
import { Newsreader_400Regular_Italic } from "@expo-google-fonts/newsreader/400Regular_Italic";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LibraryProvider, useLibrary } from "../state/LibraryProvider";
import { colors, Copy, Icon } from "../components/ui";
function Shell() {
  const { error, setError } = useLibrary();
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recording" options={{ gestureEnabled: false }} />
      </Stack>
      {Boolean(error) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso"
          onPress={() => setError("")}
          style={{
            position: "absolute",
            top: 70,
            left: 16,
            right: 16,
            padding: 18,
            borderRadius: 18,
            backgroundColor: "#ffeadf",
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            maxWidth: 528,
            alignSelf: "center",
          }}
        >
          <Copy style={{ flex: 1, fontSize: 14, color: colors.terra }}>
            {error}
          </Copy>
          <Icon name="x" color={colors.terra} />
        </Pressable>
      )}
    </View>
  );
}
export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Newsreader: Newsreader_400Regular,
    NewsreaderItalic: Newsreader_400Regular_Italic,
    Jakarta: PlusJakartaSans_400Regular,
    JakartaSemi: PlusJakartaSans_600SemiBold,
  });
  if (!loaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <LibraryProvider>
        <StatusBar style="dark" />
        <Shell />
      </LibraryProvider>
    </SafeAreaProvider>
  );
}
