"use client";

import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Post-processing for the "realistic" look: soft ambient occlusion where blocks meet,
 * HDR bloom on anything brighter than white (headlights, coins, warning lights, sunlit
 * snow), filmic tone mapping and a light vignette.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={1.2} distanceFalloff={0.8} intensity={3.5} quality="medium" halfRes />
      <Bloom mipmapBlur luminanceThreshold={0.82} luminanceSmoothing={0.25} intensity={1.3} radius={0.8} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.45} />
    </EffectComposer>
  );
}
