import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";

/** Crossfade duration when a carousel photo becomes ready to display. */
export const CAROUSEL_PHOTO_CROSSFADE_MS = 200;

type CarouselBackgroundImageProps = {
  uri: string;
  recyclingKey?: string;
};

/**
 * Photo layer for carousel / home verse cards. Stays transparent until expo-image
 * reports the bitmap is ready (`onDisplay`), then fades in over the gradient below.
 *
 * Opacity is animated on a wrapper View — expo-image must not be wrapped with
 * Animated.createAnimatedComponent (crashes on Hermes / Android).
 */
export function CarouselBackgroundImage({ uri, recyclingKey }: CarouselBackgroundImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const fadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    opacity.setValue(0);
    fadeAnimRef.current?.stop();
    fadeAnimRef.current = null;
    return () => {
      fadeAnimRef.current?.stop();
      fadeAnimRef.current = null;
    };
  }, [opacity, uri]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={recyclingKey ?? uri}
        transition={0}
        onDisplay={() => {
          fadeAnimRef.current?.stop();
          const anim = Animated.timing(opacity, {
            toValue: 1,
            duration: CAROUSEL_PHOTO_CROSSFADE_MS,
            useNativeDriver: true,
          });
          fadeAnimRef.current = anim;
          anim.start(({ finished }) => {
            if (finished && fadeAnimRef.current === anim) {
              fadeAnimRef.current = null;
            }
          });
        }}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}
