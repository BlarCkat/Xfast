"use client";

import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

/**
 * Post-processing for the "realistic" look: soft ambient occlusion where blocks meet,
 * HDR bloom on anything brighter than white (headlights, coins, warning lights, sunlit
 * snow), filmic tone mapping and a light vignette. The lighter version used on phones
 * drops ambient occlusion and anti-aliasing and blurs the bloom at half resolution.
 */
export function Effects({ full }: { full: boolean }) {
  return (
    <EffectComposer key={full ? "full" : "lite"} multisampling={full ? 4 : 0}>
      {full ? <N8AO aoRadius={1.2} distanceFalloff={0.8} intensity={3.5} quality="medium" halfRes /> : <></>}
      <Bloom
        mipmapBlur
        luminanceThreshold={0.82}
        luminanceSmoothing={0.25}
        intensity={1.3}
        radius={0.8}
        resolutionScale={full ? 1 : 0.5}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.45} />
    </EffectComposer>
  );
}
