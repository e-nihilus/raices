import { useEffect, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { formatTime, type Conversation } from "@raices/shared";
import { audioUrl } from "../lib/api";
import { Copy, Icon, colors, styles } from "./ui";
import { useLibrary } from "../state/LibraryProvider";
export function AudioPlayer({
  conversation,
  seek,
}: {
  conversation: Conversation;
  seek?: { time: number; nonce: number };
}) {
  const [uri, setUri] = useState<string | null>(null);
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const { run } = useLibrary();
  useEffect(() => {
    let active = true;
    let source: string | undefined;
    void audioUrl(conversation)
      .then((url) => {
        source = url;
        if (active) setUri(url);
        else if (Platform.OS === "web" && url.startsWith("blob:"))
          URL.revokeObjectURL(url);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (Platform.OS === "web" && source?.startsWith("blob:"))
        URL.revokeObjectURL(source);
    };
  }, [conversation]);
  useEffect(() => {
    if (seek && status.isLoaded)
      void run(async () => {
        await player.seekTo(seek.time);
        player.play();
      });
  }, [seek, player, status.isLoaded, run]);
  return (
    <View
      style={{
        backgroundColor: colors.soft,
        borderRadius: 22,
        padding: 16,
        gap: 16,
      }}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            status.playing ? "Pausar audio" : "Escuchar audio"
          }
          disabled={!uri || !status.isLoaded}
          onPress={() =>
            void run(async () => {
              if (status.playing) player.pause();
              else {
                if (status.didJustFinish) await player.seekTo(0);
                player.play();
              }
            })
          }
          style={{
            width: 52,
            height: 52,
            borderRadius: 28,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            opacity: uri ? 1 : 0.4,
          }}
        >
          <Icon name={status.playing ? "pause" : "play"} color="white" />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Copy kind="label">La voz original</Copy>
          <Copy kind="small">
            {uri
              ? `${formatTime(status.currentTime)} / ${formatTime(status.duration || conversation.duration)}`
              : conversation.demo
                ? "Ejemplo sin audio real"
                : "Cargando audio…"}
          </Copy>
        </View>
      </View>
      <View
        style={{
          height: 5,
          borderRadius: 4,
          backgroundColor: colors.line,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 5,
            backgroundColor: colors.sage,
            width: `${Math.min(100, status.duration ? (status.currentTime / status.duration) * 100 : 0)}%`,
          }}
        />
      </View>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retroceder 15 segundos"
          onPress={() =>
            void run(() => player.seekTo(Math.max(0, status.currentTime - 15)))
          }
          disabled={!status.isLoaded}
          style={{ padding: 10 }}
        >
          <Copy kind="small">↶ 15 s</Copy>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Avanzar 15 segundos"
          onPress={() =>
            void run(() =>
              player.seekTo(Math.min(status.duration, status.currentTime + 15)),
            )
          }
          disabled={!status.isLoaded}
          style={{ padding: 10 }}
        >
          <Copy kind="small">15 s ↷</Copy>
        </Pressable>
      </View>
    </View>
  );
}
