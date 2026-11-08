import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Person, Relationship } from "@raices/shared";
import { demoFamilyParents, demoFamilyPartners } from "../lib/demo";
import { Badge, Copy, Icon, colors, styles } from "./ui";

const MAP_WIDTH = 2240;
const MAP_HEIGHT = 1140;
const NODE_WIDTH = 142;
const NODE_HEIGHT = 112;
const MAX_SCALE = 2;

type Point = { x: number; y: number };
type Viewport = { width: number; height: number };
type MapView = { x: number; y: number; scale: number };

const demoPositions: Record<string, Point> = {
  "demo-jose": { x: 150, y: 100 },
  "demo-carmen": { x: 320, y: 100 },
  "demo-francisco": { x: 650, y: 100 },
  "demo-teresa-leon": { x: 820, y: 100 },
  "demo-pedro": { x: 1400, y: 100 },
  "demo-isabel": { x: 1570, y: 100 },
  "demo-miguel": { x: 1900, y: 100 },
  "demo-rosa": { x: 2070, y: 100 },
  "demo-rafael": { x: 380, y: 360 },
  "demo-pilar": { x: 740, y: 360 },
  "demo-luis": { x: 1510, y: 360 },
  "demo-ana": { x: 1870, y: 360 },
  "demo-antonio": { x: 220, y: 650 },
  "demo-clara": { x: 400, y: 650 },
  "demo-teresa-sanchez": { x: 590, y: 650 },
  "demo-manuel": { x: 880, y: 650 },
  "demo-maria": { x: 1060, y: 650 },
  "demo-julia": { x: 1370, y: 650 },
  "demo-pablo": { x: 1550, y: 650 },
  "demo-fernando": { x: 1810, y: 650 },
  "demo-eva": { x: 1990, y: 650 },
  "demo-sofia": { x: 210, y: 970 },
  "demo-mateo": { x: 390, y: 970 },
  "demo-elena": { x: 900, y: 970 },
  "demo-diego": { x: 1080, y: 970 },
  "demo-lucia": { x: 1260, y: 970 },
  "demo-ines": { x: 1510, y: 970 },
  "demo-daniel": { x: 1900, y: 970 },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function fitScale(size: Viewport, width: number, height: number) {
  return Math.min((size.width - 24) / width, (size.height - 24) / height);
}

function bounded(
  view: MapView,
  size: Viewport,
  mapWidth: number,
  mapHeight: number,
): MapView {
  const scale = clamp(
    view.scale,
    fitScale(size, mapWidth, mapHeight),
    MAX_SCALE,
  );
  const width = mapWidth * scale;
  const height = mapHeight * scale;
  const x =
    width <= size.width
      ? (size.width - width) / 2
      : clamp(view.x, size.width - width - 60, 60);
  const y =
    height <= size.height
      ? (size.height - height) / 2
      : clamp(view.y, size.height - height - 60, 60);
  return { x, y, scale };
}

type FamilyGraph = {
  parentsByChild: Map<string, Set<string>>;
  partners: [string, string][];
};

function familyGraph(
  people: Person[],
  relationships: Relationship[],
): FamilyGraph {
  const ids = new Set(people.map((person) => person.id));
  const parentsByChild = new Map<string, Set<string>>();
  const partners = new Map<string, [string, string]>();
  for (const relation of relationships) {
    if (
      !ids.has(relation.fromId) ||
      !ids.has(relation.toId) ||
      relation.fromId === relation.toId
    )
      continue;
    const kind = relation.type
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^(es |su )/, "");
    let parent: string | undefined;
    let child: string | undefined;
    if (/^(padre|madre|progenitor(?:a)?)(?:\b|$)/.test(kind)) {
      [parent, child] = [relation.fromId, relation.toId];
    } else if (/^(hijo|hija)(?:\b|$)/.test(kind)) {
      [parent, child] = [relation.toId, relation.fromId];
    } else if (
      /^(pareja|conyuge|espos[oa]|marido|mujer|casad[oa])(?:\b|$)/.test(kind)
    ) {
      const pair = [relation.fromId, relation.toId].sort() as [string, string];
      partners.set(pair.join("|"), pair);
    }
    if (parent && child) {
      const parents = parentsByChild.get(child) || new Set<string>();
      parents.add(parent);
      parentsByChild.set(child, parents);
    }
  }
  return { parentsByChild, partners: [...partners.values()] };
}

function realMapLayout(people: Person[], graph: FamilyGraph) {
  const level = new Map(people.map((person) => [person.id, 0]));
  // Keep known co-parents and partners together on the same generation.
  const pairs = [...graph.partners];
  for (const parents of graph.parentsByChild.values()) {
    const ids = [...parents];
    if (ids.length === 2) pairs.push([ids[0], ids[1]]);
  }
  for (let pass = 0; pass < people.length; pass++) {
    let changed = false;
    for (const [a, b] of pairs) {
      const rank = Math.max(level.get(a) || 0, level.get(b) || 0);
      if (level.get(a) !== rank || level.get(b) !== rank) changed = true;
      level.set(a, rank);
      level.set(b, rank);
    }
    for (const [child, parents] of graph.parentsByChild) {
      for (const parent of parents) {
        const next = Math.min(people.length, (level.get(parent) || 0) + 1);
        if (next > (level.get(child) || 0)) {
          level.set(child, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  const rows = new Map<number, Person[]>();
  for (const person of people) {
    const rank = level.get(person.id) || 0;
    rows.set(rank, [...(rows.get(rank) || []), person]);
  }
  // Place each known couple next to one another, and siblings with the same
  // recorded parents together. Do not infer relationships from names.
  for (const row of rows.values()) {
    row.sort((a, b) => {
      const group = (id: string) =>
        [...(graph.parentsByChild.get(id) || [])].sort().join("|");
      return (
        group(a.id).localeCompare(group(b.id)) ||
        a.name.localeCompare(b.name, "es")
      );
    });
    for (const [a, b] of pairs) {
      const first = row.findIndex((person) => person.id === a);
      const second = row.findIndex((person) => person.id === b);
      if (first >= 0 && second >= 0 && Math.abs(first - second) > 1) {
        const [partner] = row.splice(second, 1);
        row.splice(row.findIndex((person) => person.id === a) + 1, 0, partner);
      }
    }
  }
  const widest = Math.max(1, ...[...rows.values()].map((row) => row.length));
  const width = Math.max(720, widest * 190 + 120);
  const height = Math.max(430, (Math.max(0, ...rows.keys()) + 1) * 240 + 110);
  const positions: Record<string, Point> = {};
  for (const [rank, row] of rows) {
    const spacing = width / (row.length + 1);
    row.forEach((person, index) => {
      positions[person.id] = { x: spacing * (index + 1), y: 100 + rank * 240 };
    });
  }
  return { positions, width, height };
}

function zoomAround(view: MapView, nextScale: number, anchor: Point): MapView {
  const ratio = nextScale / view.scale;
  return {
    scale: nextScale,
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
}

function touchInfo(event: GestureResponderEvent) {
  const touches = event.nativeEvent.touches;
  if (!touches?.length) return null;
  const first = touches[0];
  const second = touches[1];
  if (!second) {
    return { count: 1, x: first.pageX, y: first.pageY, distance: 0 };
  }
  return {
    count: 2,
    x: (first.pageX + second.pageX) / 2,
    y: (first.pageY + second.pageY) / 2,
    distance: Math.hypot(
      first.pageX - second.pageX,
      first.pageY - second.pageY,
    ),
  };
}

type TouchInfo = NonNullable<ReturnType<typeof touchInfo>>;

type FamilyTreeMapProps = {
  people: Person[];
  relationships?: Relationship[];
  demo?: boolean;
  onOpenPerson: (id: string) => void;
};

export function FamilyTreeMap(props: FamilyTreeMapProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fade] = useState(() => new Animated.Value(0));
  const open = () => {
    fade.setValue(0);
    setFullscreen(true);
    Animated.timing(fade, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };
  const close = useCallback(
    (afterClose?: () => void) => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start(({ finished }) => {
        if (finished) {
          setFullscreen(false);
          afterClose?.();
        }
      });
    },
    [fade],
  );
  useEffect(() => {
    if (!fullscreen || Platform.OS !== "web") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, close]);
  return (
    <>
      <FamilyTreeCanvas {...props} onFullscreen={open} />
      <Modal
        visible={fullscreen}
        transparent
        animationType="none"
        onRequestClose={() => close()}
      >
        <Animated.View
          style={{ flex: 1, opacity: fade, backgroundColor: "#f3f7f1" }}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View
              style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 12 }}
            >
              <FamilyTreeCanvas
                {...props}
                fullscreen
                onFullscreen={() => close()}
                onOpenPerson={(id) => close(() => props.onOpenPerson(id))}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      </Modal>
    </>
  );
}

function FamilyTreeCanvas({
  people,
  relationships,
  demo = false,
  onOpenPerson,
  fullscreen = false,
  onFullscreen,
}: FamilyTreeMapProps & { fullscreen?: boolean; onFullscreen: () => void }) {
  const graph = useMemo(
    () => familyGraph(people, relationships || []),
    [people, relationships],
  );
  const layout = useMemo(
    () =>
      demo
        ? { positions: demoPositions, width: MAP_WIDTH, height: MAP_HEIGHT }
        : realMapLayout(people, graph),
    [demo, people, graph],
  );
  const { positions, width: mapWidth, height: mapHeight } = layout;
  const [view, setView] = useState<MapView>({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  const sizeRef = useRef<Viewport>({ width: 1, height: 1 });
  const containerRef = useRef<View>(null);
  const initialized = useRef(false);
  const lastTouch = useRef<TouchInfo | null>(null);
  const lastMouseDelta = useRef<Point>({ x: 0, y: 0 });
  const dragging = useRef(false);

  const apply = useCallback(
    (next: MapView) => {
      const value = bounded(next, sizeRef.current, mapWidth, mapHeight);
      viewRef.current = value;
      setView(value);
    },
    [mapWidth, mapHeight],
  );

  const fitAll = useCallback(() => {
    const size = sizeRef.current;
    const scale = fitScale(size, mapWidth, mapHeight);
    apply({
      scale,
      x: (size.width - mapWidth * scale) / 2,
      y: (size.height - mapHeight * scale) / 2,
    });
  }, [apply, mapWidth, mapHeight]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (!width || !height) return;
      sizeRef.current = { width, height };
      if (!initialized.current) {
        initialized.current = true;
        const fit = fitScale(sizeRef.current, mapWidth, mapHeight);
        const scale = width > 900 ? fit : Math.max(fit, 0.65);
        apply({
          scale,
          x: width / 2 - (mapWidth / 2) * scale,
          y: width > 900 ? (height - mapHeight * scale) / 2 : 34 - 100 * scale,
        });
      } else {
        apply(viewRef.current);
      }
    },
    [apply, mapWidth, mapHeight],
  );

  const zoom = useCallback(
    (factor: number, anchor?: Point) => {
      const size = sizeRef.current;
      apply(
        zoomAround(
          viewRef.current,
          clamp(
            viewRef.current.scale * factor,
            fitScale(size, mapWidth, mapHeight),
            MAX_SCALE,
          ),
          anchor || { x: size.width / 2, y: size.height / 2 },
        ),
      );
    },
    [apply, mapWidth, mapHeight],
  );

  const centerElena = useCallback(() => {
    const size = sizeRef.current;
    const scale = Math.max(fitScale(size, mapWidth, mapHeight), 0.8);
    apply({
      scale,
      x: size.width / 2 - demoPositions["demo-elena"].x * scale,
      y: size.height / 2 - demoPositions["demo-elena"].y * scale,
    });
  }, [apply, mapWidth, mapHeight]);

  const panResponder = useMemo(
    () =>
      // PanResponder registers these callbacks now; ref values are read only during gestures.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          gesture.numberActiveTouches > 1 ||
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.numberActiveTouches > 1 ||
          Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5,
        onPanResponderGrant: (event) => {
          lastTouch.current = touchInfo(event);
          lastMouseDelta.current = { x: 0, y: 0 };
        },
        onPanResponderMove: (event, gesture) => {
          const current = touchInfo(event);
          const previous = lastTouch.current;
          if (current && previous && current.count === previous.count) {
            const dx = current.x - previous.x;
            const dy = current.y - previous.y;
            let next = {
              ...viewRef.current,
              x: viewRef.current.x + dx,
              y: viewRef.current.y + dy,
            };
            if (current.count === 2 && previous.distance > 0) {
              const size = sizeRef.current;
              const newScale = clamp(
                next.scale * (current.distance / previous.distance),
                fitScale(size, mapWidth, mapHeight),
                MAX_SCALE,
              );
              next = zoomAround(next, newScale, {
                x: size.width / 2,
                y: size.height / 2,
              });
            }
            apply(next);
          } else if (!current) {
            apply({
              ...viewRef.current,
              x: viewRef.current.x + gesture.dx - lastMouseDelta.current.x,
              y: viewRef.current.y + gesture.dy - lastMouseDelta.current.y,
            });
            lastMouseDelta.current = { x: gesture.dx, y: gesture.dy };
          }
          lastTouch.current = current;
        },
        onPanResponderRelease: () => {
          lastTouch.current = null;
        },
        onPanResponderTerminate: () => {
          lastTouch.current = null;
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [apply, mapWidth, mapHeight],
  );

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = containerRef.current as unknown as HTMLElement | null;
    if (!element) return;
    element.style.touchAction = "none";
    element.style.userSelect = "none";
    const pointers = new Map<number, Point>();
    const initial = new Map<number, Point>();
    let previous: TouchInfo | null = null;
    const currentInfo = (): TouchInfo | null => {
      const points = [...pointers.values()];
      if (!points.length) return null;
      if (points.length === 1) {
        return { count: 1, x: points[0].x, y: points[0].y, distance: 0 };
      }
      return {
        count: 2,
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
        distance: Math.hypot(
          points[0].x - points[1].x,
          points[0].y - points[1].y,
        ),
      };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (pointers.size === 0) dragging.current = false;
      const point = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, point);
      initial.set(event.pointerId, point);
      previous = currentInfo();
      if (pointers.size > 1) dragging.current = true;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const current = currentInfo();
      if (!current || !previous) return;
      const start = initial.get(event.pointerId);
      if (
        !dragging.current &&
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4
      ) {
        dragging.current = true;
      }
      if (!dragging.current) return;
      event.preventDefault();
      if (!element.hasPointerCapture(event.pointerId)) {
        element.setPointerCapture(event.pointerId);
      }
      const size = sizeRef.current;
      let next = {
        ...viewRef.current,
        x: viewRef.current.x + current.x - previous.x,
        y: viewRef.current.y + current.y - previous.y,
      };
      if (
        current.count === 2 &&
        previous.count === 2 &&
        previous.distance > 0
      ) {
        next = zoomAround(
          next,
          clamp(
            next.scale * (current.distance / previous.distance),
            fitScale(size, mapWidth, mapHeight),
            MAX_SCALE,
          ),
          { x: size.width / 2, y: size.height / 2 },
        );
      }
      apply(next);
      previous = current;
    };
    const onPointerEnd = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      initial.delete(event.pointerId);
      previous = currentInfo();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoom(clamp(Math.exp(-event.deltaY * 0.0015), 0.8, 1.25), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerEnd);
    element.addEventListener("pointercancel", onPointerEnd);
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerEnd);
      element.removeEventListener("pointercancel", onPointerEnd);
      element.removeEventListener("wheel", onWheel);
    };
  }, [apply, zoom, mapWidth, mapHeight]);

  return (
    <View style={{ gap: 10, ...(fullscreen ? { flex: 1 } : {}) }}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Badge warm={demo}>
          {demo ? "MAPA FAMILIAR · EJEMPLO" : "MAPA FAMILIAR"}
        </Badge>
        <View style={[styles.row, { gap: 10 }]}>
          <Copy kind="small">{people.length} personas</Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              fullscreen
                ? "Cerrar pantalla completa"
                : "Abrir árbol en pantalla completa"
            }
            onPress={onFullscreen}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              padding: 8,
              borderRadius: 10,
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.line,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name={fullscreen ? "x" : "maximize"} size={18} />
            <Copy kind="small">
              {fullscreen ? "Cerrar" : "Pantalla completa"}
            </Copy>
          </Pressable>
        </View>
      </View>
      <View
        ref={containerRef}
        onLayout={onLayout}
        {...(Platform.OS === "web" ? {} : panResponder.panHandlers)}
        style={{
          ...(fullscreen ? { flex: 1 } : { height: 540 }),
          overflow: "hidden",
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: "#f3f7f1",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: view.x,
            top: view.y,
            width: mapWidth,
            height: mapHeight,
            transformOrigin: [0, 0, 0],
            transform: [{ scale: view.scale }],
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: mapWidth,
              height: mapHeight,
            }}
          >
            {demo &&
              [
                ["Bisabuelos", 30],
                ["Abuelos", 325],
                ["Padres y tíos", 615],
                ["Hermanos y primos", 935],
              ].map(([label, y]) => (
                <View
                  key={label}
                  style={{
                    position: "absolute",
                    left: 55,
                    top: Number(y),
                    gap: 8,
                  }}
                >
                  <Copy kind="heading" style={{ color: colors.primary }}>
                    {label}
                  </Copy>
                  <View
                    style={{
                      width: mapWidth - 110,
                      height: 1,
                      backgroundColor: "#dbe8db",
                    }}
                  />
                </View>
              ))}
            {demo ? demoFamilyLines() : realFamilyLines(graph, positions)}
          </View>
          {people.map((person) => {
            const point = positions[person.id];
            if (!point) return null;
            return (
              <MapPerson
                key={person.id}
                person={person}
                point={point}
                onPress={() => {
                  if (!dragging.current) onOpenPerson(person.id);
                  dragging.current = false;
                }}
              />
            );
          })}
        </View>
        <View
          style={{
            position: "absolute",
            right: 12,
            top: 12,
            gap: 8,
          }}
        >
          <MapControl label="Acercar" icon="plus" onPress={() => zoom(1.4)} />
          <MapControl
            label="Alejar"
            icon="minus"
            onPress={() => zoom(1 / 1.4)}
          />
          <MapControl
            label="Ver todo el árbol"
            icon="maximize-2"
            onPress={fitAll}
          />
          {demo && (
            <MapControl
              label="Centrar en Elena"
              icon="crosshair"
              onPress={centerElena}
            />
          )}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            backgroundColor: "rgba(255,255,255,0.94)",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 7,
          }}
        >
          <Copy kind="small">
            {Math.round(view.scale * 100)}% · Arrastra para moverte
          </Copy>
        </View>
      </View>
      <Copy kind="small" style={{ textAlign: "center" }}>
        Pellizca con dos dedos o usa la rueda para ampliar. Toca una persona
        para abrir su ficha.
      </Copy>
    </View>
  );
}

function MapControl({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: "plus" | "minus" | "maximize-2" | "crosshair";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 13,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={19} />
    </Pressable>
  );
}

function MapPerson({
  person,
  point,
  onPress,
}: {
  person: Person;
  point: Point;
  onPress: () => void;
}) {
  const active = person.id === "demo-elena";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver ficha de ${person.name}`}
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        left: point.x - NODE_WIDTH / 2,
        top: point.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        borderRadius: 20,
        borderWidth: active ? 2 : 1,
        borderColor: active ? colors.primary : "#d5e2d6",
        backgroundColor: colors.white,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: active ? colors.primary : colors.mint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name="user"
          size={26}
          color={active ? colors.white : colors.primary}
        />
      </View>
      <Copy
        kind="label"
        numberOfLines={1}
        style={{ fontSize: 12, textAlign: "center", width: 130 }}
      >
        {person.name}
      </Copy>
      <Copy
        kind="small"
        numberOfLines={1}
        style={{ fontSize: 10, textAlign: "center", width: 130 }}
      >
        {person.aliases[0]}
      </Copy>
    </Pressable>
  );
}

function demoFamilyLines() {
  const lineColor = "#647f69";
  const childrenByCouple = new Map<string, string[]>();
  for (const [child, parentIds] of Object.entries(demoFamilyParents)) {
    const key = [...parentIds].sort().join("|");
    childrenByCouple.set(key, [...(childrenByCouple.get(key) || []), child]);
  }
  return demoFamilyPartners.flatMap(([firstId, secondId]) => {
    const first = demoPositions[firstId];
    const second = demoPositions[secondId];
    const key = [firstId, secondId].sort().join("|");
    const children = childrenByCouple.get(key) || [];
    if (!first || !second || !children.length) return [];
    const parentY = first.y + 46;
    const midpoint = (first.x + second.x) / 2;
    const childPoints = children.map((id) => demoPositions[id]).filter(Boolean);
    const barY = Math.min(...childPoints.map((point) => point.y)) - 70;
    const leftChild = Math.min(...childPoints.map((point) => point.x));
    const rightChild = Math.max(...childPoints.map((point) => point.x));
    const segments = [
      {
        x1: Math.min(first.x, second.x) + NODE_WIDTH / 2,
        y1: parentY,
        x2: Math.max(first.x, second.x) - NODE_WIDTH / 2,
        y2: parentY,
      },
      { x1: midpoint, y1: parentY, x2: midpoint, y2: barY },
      {
        x1: Math.min(midpoint, leftChild),
        y1: barY,
        x2: Math.max(midpoint, rightChild),
        y2: barY,
      },
      ...childPoints.map((point) => ({
        x1: point.x,
        y1: barY,
        x2: point.x,
        y2: point.y,
      })),
    ];
    return segments.map((segment, index) => (
      <View
        key={`${key}-${index}`}
        style={{
          position: "absolute",
          left: Math.min(segment.x1, segment.x2),
          top: Math.min(segment.y1, segment.y2),
          width: Math.max(2, Math.abs(segment.x2 - segment.x1)),
          height: Math.max(2, Math.abs(segment.y2 - segment.y1)),
          backgroundColor: lineColor,
          borderRadius: 2,
        }}
      />
    ));
  });
}

function realFamilyLines(graph: FamilyGraph, positions: Record<string, Point>) {
  type Segment = { x1: number; y1: number; x2: number; y2: number };
  const segments: Segment[] = [];
  const couples = new Set<string>();
  const addCouple = (a: string, b: string) => {
    const key = [a, b].sort().join("|");
    const first = positions[a];
    const second = positions[b];
    if (couples.has(key) || !first || !second || first.y !== second.y) return;
    couples.add(key);
    segments.push({
      x1: Math.min(first.x, second.x) + NODE_WIDTH / 2,
      y1: first.y + NODE_HEIGHT / 2,
      x2: Math.max(first.x, second.x) - NODE_WIDTH / 2,
      y2: first.y + NODE_HEIGHT / 2,
    });
  };
  graph.partners.forEach(([a, b]) => addCouple(a, b));
  const families = new Map<string, { parents: string[]; children: string[] }>();
  for (const [child, parentIds] of graph.parentsByChild) {
    const parents = [...parentIds].sort();
    const key = parents.join("|");
    const family = families.get(key) || { parents, children: [] };
    family.children.push(child);
    families.set(key, family);
  }
  for (const { parents, children } of families.values()) {
    const parentPoints = parents.map((id) => positions[id]).filter(Boolean);
    const childPoints = children.map((id) => positions[id]).filter(Boolean);
    if (!parentPoints.length || !childPoints.length) continue;
    if (parents.length === 2) addCouple(parents[0], parents[1]);
    const x =
      parentPoints.reduce((sum, point) => sum + point.x, 0) /
      parentPoints.length;
    const startY =
      parents.length === 2 && parentPoints[0].y === parentPoints[1].y
        ? parentPoints[0].y + NODE_HEIGHT / 2
        : Math.max(...parentPoints.map((point) => point.y)) + NODE_HEIGHT;
    const barY =
      (Math.max(...parentPoints.map((point) => point.y + NODE_HEIGHT)) +
        Math.min(...childPoints.map((point) => point.y))) /
      2;
    segments.push({ x1: x, y1: startY, x2: x, y2: barY });
    segments.push({
      x1: Math.min(x, ...childPoints.map((point) => point.x)),
      y1: barY,
      x2: Math.max(x, ...childPoints.map((point) => point.x)),
      y2: barY,
    });
    childPoints.forEach((point) =>
      segments.push({ x1: point.x, y1: barY, x2: point.x, y2: point.y }),
    );
  }
  return segments.map((segment, index) => (
    <View
      key={index}
      style={{
        position: "absolute",
        left: Math.min(segment.x1, segment.x2),
        top: Math.min(segment.y1, segment.y2),
        width: Math.max(2, Math.abs(segment.x2 - segment.x1)),
        height: Math.max(2, Math.abs(segment.y2 - segment.y1)),
        backgroundColor: "#647f69",
        borderRadius: 2,
      }}
    />
  ));
}
