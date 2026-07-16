import {
  M3_CONTAINER_TRANSFORM_ENTER_MS,
  M3_CONTAINER_TRANSFORM_RETURN_MS,
  M3_EMPHASIZED_ACCELERATE_EASING,
  M3_EMPHASIZED_DECELERATE_EASING,
} from "@/src/components/m3/m3-motion";

/** Shared motion for the reader settings strip slide + side sheet scrim (open). */
export const READER_SETTINGS_MENU_SPRING_OPEN = {
  duration: M3_CONTAINER_TRANSFORM_ENTER_MS,
  easing: M3_EMPHASIZED_DECELERATE_EASING,
  useNativeDriver: true as const,
};

/** Shared motion for the reader settings strip slide + side sheet scrim (close). */
export const READER_SETTINGS_MENU_SPRING_CLOSE = {
  duration: M3_CONTAINER_TRANSFORM_RETURN_MS,
  easing: M3_EMPHASIZED_ACCELERATE_EASING,
  useNativeDriver: true as const,
};
