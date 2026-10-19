import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewStyle,
  type ColorValue,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLibrary } from "../state/LibraryProvider";
export const colors = {
  bg: "#f6fbf5",
  ink: "#181d1a",
  muted: "#5c6560",
  primary: "#385645",
  sage: "#506e5c",
  soft: "#f0f5f0",
  mint: "#c9ead4",
  line: "#e5e9e4",
  terra: "#8c4e2a",
  peach: "#ffdbca",
  white: "#ffffff",
};
export function Copy({
  children,
  kind = "body",
  style,
  ...props
}: TextProps & { kind?: "body" | "title" | "heading" | "small" | "label" }) {
  return (
    <Text {...props} style={[styles[kind], style]}>
      {children}
    </Text>
  );
}
export function Icon({
  name,
  size = 22,
  color = colors.primary,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  size?: number;
  color?: ColorValue;
}) {
  return <Feather name={name} size={size} color={color} />;
}
export function Button({
  label,
  onPress,
  icon,
  secondary = false,
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  secondary?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        style,
        { opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.primary : colors.white} />
      ) : (
        icon && (
          <Icon name={icon} color={secondary ? colors.primary : colors.white} />
        )
      )}
      <Copy
        kind="label"
        style={{
          color: secondary ? colors.primary : colors.white,
          textAlign: "center",
        }}
      >
        {label}
      </Copy>
    </Pressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Badge({
  children,
  warm = false,
}: {
  children: React.ReactNode;
  warm?: boolean;
}) {
  return (
    <View style={[styles.badge, warm && { backgroundColor: colors.peach }]}>
      <Copy
        kind="small"
        style={{ color: warm ? colors.terra : colors.primary }}
      >
        {children}
      </Copy>
    </View>
  );
}
export function Screen({
  children,
  back = false,
  title,
  scroll = true,
}: {
  children: React.ReactNode;
  back?: boolean;
  title?: string;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const library = useLibrary();
  return (
    <View
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
      <View style={styles.header}>
        <View style={styles.row}>
          {back ? (
            <Pressable
              accessibilityLabel="Volver"
              accessibilityRole="button"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              style={styles.iconButton}
            >
              <Icon name="arrow-left" />
            </Pressable>
          ) : (
            <View style={styles.logo}>
              <Icon name="git-branch" size={20} />
            </View>
          )}
          <Copy
            kind="heading"
            numberOfLines={1}
            style={{ flexShrink: 1, color: colors.primary }}
          >
            {title || "Raíces"}
          </Copy>
        </View>
        <Pressable
          accessibilityLabel="Ajustes"
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          style={styles.iconButton}
        >
          <Icon name="settings" />
        </Pressable>
      </View>
      {library.demo && (
        <Pressable
          onPress={() => library.setDemo(false)}
          accessibilityRole="button"
          style={styles.demo}
        >
          <Copy
            kind="small"
            style={{ textAlign: "center", color: colors.terra }}
          >
            Vista de ejemplo · Toca para volver a tus recuerdos
          </Copy>
        </Pressable>
      )}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: 32 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </View>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 36, gap: 14 }}>
      <View style={styles.logo}>
        <Icon name="book-open" />
      </View>
      <Copy kind="heading" style={{ textAlign: "center" }}>
        {title}
      </Copy>
      <Copy style={{ textAlign: "center", color: colors.muted }}>{text}</Copy>
      {action}
    </Card>
  );
}
export const styles = StyleSheet.create({
  body: {
    fontFamily: "Jakarta",
    fontSize: 16,
    lineHeight: 25,
    color: colors.ink,
  },
  title: {
    fontFamily: "Newsreader",
    fontSize: 34,
    lineHeight: 41,
    color: colors.ink,
  },
  heading: {
    fontFamily: "Newsreader",
    fontSize: 25,
    lineHeight: 31,
    color: colors.ink,
  },
  small: {
    fontFamily: "Jakarta",
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  label: {
    fontFamily: "JakartaSemi",
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink,
  },
  content: {
    padding: 22,
    gap: 22,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  header: {
    height: 72,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: "#e8f0e9",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    minHeight: 56,
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  secondary: { backgroundColor: "#e5ece6" },
  card: {
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: 22,
    gap: 12,
    borderWidth: 1,
    borderColor: "#eff3ee",
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#e3f0e6",
  },
  input: {
    minHeight: 56,
    backgroundColor: colors.soft,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: "Jakarta",
    fontSize: 16,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
  },
  demo: {
    backgroundColor: "#fff2e7",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  divider: { height: 1, backgroundColor: colors.line },
});
