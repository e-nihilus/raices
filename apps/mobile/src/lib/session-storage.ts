import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
// Sessions may exceed SecureStore's per-value limit. Store bounded chunks on native.
export const sessionStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    if (!count || count > 64) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${i}`),
      ),
    );
    return parts.some((x) => x === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") return AsyncStorage.setItem(key, value);
    const oldCount = Number(await SecureStore.getItemAsync(`${key}.count`));
    const count = Math.ceil(value.length / 1800);
    if (count > 64) throw new Error("La sesión supera el tamaño admitido");
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        `${key}.${i}`,
        value.slice(i * 1800, (i + 1) * 1800),
      );
    await SecureStore.setItemAsync(`${key}.count`, String(count));
    for (let i = count; i < oldCount; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") return AsyncStorage.removeItem(key);
    const count = Math.min(
      64,
      Number(await SecureStore.getItemAsync(`${key}.count`)) || 0,
    );
    await SecureStore.deleteItemAsync(`${key}.count`);
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
};
