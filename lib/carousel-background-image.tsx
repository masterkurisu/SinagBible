import { useCallback, useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";

/** Crossfade duration when a carousel photo becomes ready to display. */
export const CAROUSEL_PHOTO_CROSSFADE_MS = 200;

/** URIs that have completed `onDisplay` this process — paint opaque on remount. */
const displayedCarouselPhotoUris = new Set<string>();

type CarouselBackgroundImageProps = {
  uri: string;
  /** Stable per-card identity. Prefer `verseId:uri` so Home and Journal do not pool bitmaps. */
  recyclingKey?: string;
  /** Session already has this URL — skip the first-decode fade. */
  cached?: boolean;
};

/**
 * Photo layer for carousel / home verse cards. Cached / already-displayed photos paint
 * opaque. First decode stays transparent until expo-image reports `onDisplay`, then fades
 * in over the gradient below.
 *
 * Opacity is animated on a wrapper View — expo-image must not be wrapped with
 * Animated.createAnimatedComponent (crashes on Hermes / Android).
 *
 * URI changes hide the photo during render (not in useEffect) so a recycled bitmap
 * cannot paint for a frame. `onDisplay` is ignored unless it matches the current URI.
 */
export function CarouselBackgroundImage({
  uri,
  recyclingKey,
  cached = false,
}: CarouselBackgroundImageProps) {
  const paintOpaque = cached || displayedCarouselPhotoUris.has(uri);
  const opacity = useRef(new Animated.Value(paintOpaque ? 1 : 0)).current;
  const fadeAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const currentUriRef = useRef(uri);
  const pendingUriRef = useRef(uri);
  const paintOpaqueRef = useRef(paintOpaque);

  currentUriRef.current = uri;

  if (pendingUriRef.current !== uri) {
    pendingUriRef.current = uri;
    fadeAnimRef.current?.stop();
    fadeAnimRef.current = null;
    opacity.setValue(paintOpaque ? 1 : 0);
    paintOpaqueRef.current = paintOpaque;
  } else if (paintOpaque && !paintOpaqueRef.current) {
    paintOpaqueRef.current = true;
    fadeAnimRef.current?.stop();
    fadeAnimRef.current = null;
    opacity.setValue(1);
  }

  useEffect(() => {
    return () => {
      fadeAnimRef.current?.stop();
      fadeAnimRef.current = null;
    };
  }, []);

  const handleDisplay = useCallback(() => {
    if (currentUriRef.current !== uri) return;
    const alreadyDisplayed = displayedCarouselPhotoUris.has(uri);
    displayedCarouselPhotoUris.add(uri);
    fadeAnimRef.current?.stop();
    if (cached || alreadyDisplayed) {
      opacity.setValue(1);
      fadeAnimRef.current = null;
      return;
    }
    const displayedUri = uri;
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: CAROUSEL_PHOTO_CROSSFADE_MS,
      useNativeDriver: true,
    });
    fadeAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (
        finished &&
        fadeAnimRef.current === anim &&
        currentUriRef.current === displayedUri
      ) {
        fadeAnimRef.current = null;
      }
    });
  }, [cached, opacity, uri]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey ?? uri}
        transition={0}
        onDisplay={handleDisplay}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}
