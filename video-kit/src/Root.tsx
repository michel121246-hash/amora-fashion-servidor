import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { EfeitosDemo, DEMO_DUR } from "./EfeitosDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition id="EfeitosDemo" component={EfeitosDemo} durationInFrames={DEMO_DUR} fps={30} width={1080} height={1920} />
    </>
  );
};
