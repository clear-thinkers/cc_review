"use client";

/**
 * Coin Animation Component
 *
 * Displays an animated floating coin that fades out.
 * Used to provide visual feedback when coins are earned.
 *
 * Last updated: 2026-03-04
 */

import { useEffect, useState } from "react";
import styles from "./coins.animation.module.css";

export interface CoinAnimationProps {
  /**
   * X coordinate (pixels) where animation should start
   */
  x: number;
  /**
   * Y coordinate (pixels) where animation should start
   */
  y: number;
  /**
   * Callback when animation completes
   */
  onComplete?: () => void;
  /**
   * Animation duration in milliseconds (default: 300)
   */
  duration?: number;
}

/**
 * CoinAnimation renders a single animated coin sprite.
 *
 * The coin floats upward from the starting position while fading out.
 * Animation is GPU-accelerated via CSS transforms.
 *
 * Props:
 * - x, y: Starting coordinates
 * - onComplete: Called when animation finishes
 * - duration: Animation length (ms)
 */
export function CoinAnimation({
  x,
  y,
  onComplete,
  duration = 300,
}: CoinAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!isAnimating) {
      onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [isAnimating, duration, onComplete]);

  if (!isAnimating) {
    return null;
  }

  return (
    <div
      className={styles.coinContainer}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        animation: `${styles.coinFloat} ${duration}ms ease-out forwards`,
      }}
    >
      <span className={styles.coinEmoji}>🪙</span>
    </div>
  );
}
